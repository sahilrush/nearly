import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import WebSocket from "ws";

const prisma = new PrismaClient();
const redisClient = new Redis();

class WebSocketService {
  private static instance: WebSocketService;
  private wss: WebSocket.Server;
  private clients: Map<string, WebSocket> = new Map();

  private constructor() {
    this.wss = new WebSocket.Server({ port: 8000 });
    this.setupListeners();
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
            redisClient.zrem("user_locations", userId);
          }
        });
      });
    });
  }

  private async handleMessage(ws: WebSocket, message: WebSocket.RawData) {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "update_location") {
        const { userId, latitude, longitude } = data;
        console.log(`Location update from ${userId}`);

        const userExists = await prisma.user.findUnique({
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
        await redisClient.geoadd("user_locations", longitude, latitude, userId);

        // Find nearby users within 10 meters
        const nearbyUsers = await redisClient.georadius(
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
          const lastLocation = await prisma.location.findUnique({
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
            await prisma.location.upsert({
              where: { userId },
              update: {
                latitude: latitude.toString(),
                longitude: longitude.toString(),
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
