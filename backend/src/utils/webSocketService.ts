import Redis from "ioredis";
import WebSocket from "ws";
import { CONFIG } from "./config";
import { RateLimiter } from "limiter";
import {
  ErrorMessage,
  LocationUpdateMessage,
  RegisterMessage,
  WebSocketMessage,
} from "./messages";

import { PrismaClient } from "@prisma/client";
import { GeoRadiusResponse } from "./types";

class WebSocketService {
  private static instance: WebSocketService;
  private wss: WebSocket.Server;
  private clients: Map<string, WebSocket> = new Map();
  private updateLimiters: Map<string, RateLimiter> = new Map();
  private prisma: PrismaClient;
  private redis: Redis;

  private constructor() {
    this.prisma = new PrismaClient();
    this.redis = new Redis();
    this.wss = new WebSocket.Server({ port: CONFIG.WEBSOCKET_PORT });

    this.setupListeners();
    this.setupHeartbeat();

    console.log(`WebSocket Server started on port ${CONFIG.WEBSOCKET_PORT}`);
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  private setupListeners() {
    this.wss.on("connection", (ws) => {
      console.log("Client connected");

      ws.on("message", (message: WebSocket.RawData) => {
        try {
          const data = JSON.parse(message.toString()) as WebSocketMessage;
          this.handleMessage(ws, data);
        } catch (err) {
          console.error("Error processing message:", err);
        }
      });

      ws.on("close", () => {
        console.log("Client disconnected");
        this.clients.forEach((clientWs, userId) => {
          if (clientWs === ws) {
            this.clients.delete(userId);
            console.log(`User ${userId} removed from tracking`);
            this.redis.zrem("user_locations", userId);
          }
        });
      });
    });
  }

  private setupHeartbeat() {
    setInterval(() => {
      this.clients.forEach((ws, userId) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          this.handleDisconnection(userId, ws);
        }
      });
    }, CONFIG.HEARTBEAT_INTERVAL_MS);
  }

  private async handleDisconnection(userId: string, ws: WebSocket) {
    this.clients.delete(userId);
    this.updateLimiters.delete(userId);
    await this.redis.zrem("user_connection", userId);
    ws.terminate();
  }

  private async handleMessage(ws: WebSocket, data: WebSocketMessage) {
    switch (data.type) {
      case "register":
        await this.handleRegistration(data);
        break;
      case "update_location":
        await this.handleLocationUpdate(data);
        break;
    }
  }

  private async handleRegistration(message: RegisterMessage) {
    const { userId } = message;
    const ws = this.clients.get(userId);
    try {
      if (ws) this.clients.set(userId, ws);
      console.log(`User ${userId} Registered `);
    } catch (err) {
      console.error(`Failed to register user ${userId}:`, err);
    }
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    attempts: number = CONFIG.DB_RETRY_ATTEMPTS
  ): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await operation();
      } catch (err) {
        if (i === attempts - 1) throw err;
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, i))
        );
      }
    }
    throw new Error("All retry attempts failed");
  }

  private async handleLocationUpdate(message: LocationUpdateMessage) {
    const { userId, latitude, longitude } = message;

    // Check rate limit
    const limiter = this.getRateLimiter(userId);
    if (!(await limiter.tryRemoveTokens(1))) {
      this.sendToUser(userId, {
        type: "error",
        message:
          "Rate limit exceeded. Please wait before updating location again.",
      } as ErrorMessage);
      return;
    }

    if (!this.validateLocation(latitude, longitude)) {
      this.sendToUser(userId, {
        type: "error",
        message: "Invalid location coordinates",
      } as ErrorMessage);
      return;
    }

    try {
      const userExists = await this.retryOperation(() =>
        this.prisma.user.findUnique({
          where: { id: userId },
        })
      );

      if (!userExists) {
        this.sendToUser(userId, {
          type: "error",
          message: "User not found",
        } as ErrorMessage);
        return;
      }

      await this.redis.geoadd("user_locations", longitude, latitude, userId);

      const nearbyUsers = await this.redis.georadius(
        "user_locations",
        longitude,
        latitude,
        CONFIG.PROXIMITY_RADIUM_METERS,
        "m",
        "WITHCOORD",
        "WITHDIST"
      );

      const otherUsers = nearbyUsers
        .filter(
          (item): item is GeoRadiusResponse =>
            Array.isArray(item) && item[0] !== userId
        )
        .map((item: GeoRadiusResponse) => ({
          id: item[0],
          distance: parseFloat(item[1]),
          coordinates: item[2],
        }));

      if (otherUsers.length > 0) {
        const userDetails = await Promise.all(
          otherUsers.map(async (user) => {
            const details = await this.getUserDetails(user.id);
            return {
              ...details,
              distance: user.distance,
            };
          })
        );

        this.sendToUser(userId, {
          type: "nearby_users",
          users: userDetails
            .filter((u): u is NonNullable<typeof u> => u !== null)
            .map((user) => ({
              id: user.id || "",
              name: user.username || "Unknown",
              image: user.image || "",
              distance: user.distance,
            })),
          yourLocation: { latitude, longitude },
        });

        otherUsers.forEach((otherUser) => {
          const otherUserId = otherUser.id;
          this.sendToUser(otherUserId, {
            type: "user_entered_proximity",
            userId,
            location: { latitude, longitude },
          });
        });
      }

      const lastLocation = await this.prisma.location.findUnique({
        where: { userId },
      });

      const shouldUpdate =
        !lastLocation ||
        this.hasMovedSignificantly(
          lastLocation
            ? {
                latitude: parseFloat(lastLocation.latitude.toString()),
                longitude: parseFloat(lastLocation.longitude.toString()),
              }
            : null,
          latitude,
          longitude
        );

      if (shouldUpdate) {
        await this.prisma.location.upsert({
          where: { userId },
          update: {
            latitude: latitude,
            longitude: longitude,
            updatedAt: new Date(),
          },
          create: {
            userId,
            latitude: latitude.toString(),
            longitude: longitude.toString(),
          },
        });
        console.log(`Updated database location for ${userId}`);
      }
    } catch (err) {
      console.error(`Database failed for user`);
      this.sendToUser(userId, {
        type: "error",
        message: "Failed to update location in database",
      });
    }
  }

  private getRateLimiter(userId: string): RateLimiter {
    if (!this.updateLimiters.has(userId)) {
      this.updateLimiters.set(
        userId,
        new RateLimiter({
          tokensPerInterval: CONFIG.MAX_UPDATE_PER_MINUTE,
          interval: "minute",
        })
      );
    }
    return this.updateLimiters.get(userId)!;
  }

  private async getUserDetails(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          image: true,
        },
      });
      return user;
    } catch (err) {
      console.error("Error fetching user details:", err);
    }
  }

  private validateLocation(latitude: number, longitude: number): boolean {
    return (
      latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
    );
  }

  private sendToUser(userId: string, message: any) {
    const client = this.clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    } else {
      console.warn(`User ${userId} not connected - notification skipped`);
    }
  }

  private hasMovedSignificantly(
    lastLocation: { latitude: number; longitude: number } | null,
    newLat: number,
    newLon: number
  ): boolean {
    if (!lastLocation) return true;

    const distance = this.haversineDistance(
      lastLocation.latitude,
      lastLocation.longitude,
      newLat,
      newLon
    );
    return distance > CONFIG.SIGNIFICANT_MOVEMENT_METERS;
  }

  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3;
    const a1 = (lat1 * Math.PI) / 180;
    const a2 = (lat2 * Math.PI) / 180;
    const a3 = ((lat2 - lat1) * Math.PI) / 180;
    const a4 = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(a3 / 2) * Math.sin(a3 / 2) +
      Math.cos(a1) * Math.cos(a2) * Math.sin(a4 / 2) * Math.sin(a4 / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

export default WebSocketService;
