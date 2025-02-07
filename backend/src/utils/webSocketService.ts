import Redis from "ioredis";
import WebSocket from "ws";
import { CONFIG } from "./config";
import { RateLimiter } from "limiter";
import {
  ErrorMessage,
  LocationUpdateMessage,
  NearbyUserMessage,
  RegisterMessage,
  UserProximityMessage,
  WebSocketMessage,
} from "./messages";

import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
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
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
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

  private validateLocation(latitude: number, longitude: number): boolean {
    return (
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= -180
    );
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
    throw new Error("All retry attemps failed");
  }

  private setupListeners() {
    this.wss.on("connection", (ws) => {
      console.log("Client connected");

      ws.on("message", (message: WebSocket.RawData) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === "register" && data.userId) {
            this.clients.set(data.userId, ws);
            console.log(`User ${data.userId} registered`);
          } else {
            this.handleMessage(ws, message);
          }
        } catch (err) {
          console.error("Error processing message:", err);
        }
      });

      ws.on("close", () => {
        console.log("Client disconnected");
        Array.from(this.clients.entries()).forEach(([userId, client]) => {
          if (client === ws) {
            this.clients.delete(userId);
            console.log(`User ${userId} removed from tracking`);
            // Remove from Redis when user disconnects
            this.redis.zrem("user_locations", userId);
          }
        });
      });
    });
  }

  private async handleMessage(ws: WebSocket, rawMessage: WebSocket.RawData) {
    try {
      const data = JSON.parse(rawMessage.toString()) as WebSocketMessage;

      switch (data.type) {
        case "register":
          await this.handleRegistration(data);
          break;
        case "update_location":
          await this.handleLocationUpdate(data);
          break;
      }

      if (data.type === "update_location") {
        const { userId, latitude, longitude } = data;
        console.log(`Location update from ${userId}`);

        const userExists = await this.prisma.user.findUnique({
          where: { id: userId },
        });

        if (!userExists) {
          console.error(`User ${userId} not found in database`);
          this.sendToUser(userId, {
            type: "error",
            message: "user not found",
          });
          return;
        }

        // Update Redis geospatial index
        await this.redis.geoadd("user_locations", longitude, latitude, userId);

        // Find nearby users within 10 meters
        const nearbyUsers = await this.redis.georadius(
          "user_locations",
          longitude,
          latitude,
          10,
          "m"
        );

        // Process nearby users
        const otherUsers = nearbyUsers
          .map((id) => id as string)
          .filter((id) => id !== userId);

        if (otherUsers.length > 0) {
          console.log(`Found ${otherUsers.length} nearby users for ${userId}`);

          // Notify current user about others
          this.sendToUser(userId, {
            type: "nearby_users",
            users: otherUsers,
            yourLocation: { latitude, longitude },
          });

          // Notify other users about current user
          otherUsers.forEach((otherUserId: string) => {
            this.sendToUser(otherUserId, {
              type: "user_entered_proximity",
              userId,
              location: { latitude, longitude },
            });
          });
        }

        try {
          // Update database if significant movement
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
            message: "Failed to update locaition in database",
          });
        }
      }
    } catch (err) {
      console.error("Error processing message:", err);
    }
  }

  private async handleRegistration(message: RegisterMessage) {
    const { userId } = message;
    const ws = this.clients.get(userId);
    if (ws) this.clients.set(userId, ws);
    console.log(`User ${userId} Registered `);
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
      } as unknown as ErrorMessage);
      return;
    }

    if (!this.validateLocation(latitude, longitude)) {
      this.sendToUser(userId, {
        type: "error",
        message: "Invalid location coordinates",
      } as unknown as ErrorMessage);
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
        } as unknown as ErrorMessage);
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
        .map((item: GeoRadiusResponse) => item[0]);

      //notify current user
      if (otherUsers.length > 0) {
        this.sendToUser(userId, {
          type: "nearby_users",
          users: otherUsers,
          yourLocation: { latitude, longitude },
        } as unknown as NearbyUserMessage);

        // Notify other users
        otherUsers.forEach((otherUserId: string) => {
          this.sendToUser(otherUserId, {
            type: "user_entered_proximity",
            userId,
            location: { latitude, longitude },
          } as unknown as UserProximityMessage);
        });
      }

      await this.updateDatabaseLocation(userId, latitude, longitude);
    } catch (error) {
      this.sendToUser(userId, {
        type: "error",
        message: "Server error occurred while processing location",
      } as unknown as ErrorMessage);
    }
  }

  private async updateDatabaseLocation(
    userId: string,
    latitude: number,
    longitude: number
  ) {
    try {
      const existingLocation = await this.prisma.location.findUnique({
        where: { userId },
      });
      if (existingLocation) {
        await this.prisma.location.update({
          where: { userId },
          data: {
            latitude: new Decimal(latitude),
            longitude: new Decimal(longitude),
            //updatedAt wull automically updated by prisma
          },
        });
      } else {
        await this.prisma.location.create({
          data: {
            userId,
            latitude: new Decimal(latitude),
            longitude: new Decimal(longitude),
          },
        });
      }
    } catch (error) {
      console.error("Error updating location in database:", error);
      throw new Error("Failed to update location in database");
    }
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
    return distance > 50; // 50 meters threshold
  }

  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

export default WebSocketService.getInstance();

