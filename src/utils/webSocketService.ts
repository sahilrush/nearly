import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import WebSocket from "ws";

const prisma = new PrismaClient();
const redis = new Redis();

class WebSocketService {
  private static instance: WebSocketService;
  private wss: WebSocket.Server;
  private clients: Map<string, WebSocket> = new Map();

  private constructor() {
    this.wss = new WebSocket.Server({ port: 8000 });
    this.setupListeners(); // Ensure WebSocket starts listening
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  private setupListeners() {
    this.wss.on("connection", (ws) => {
      //  Fixed event name
      console.log("Client connected");

      ws.on("message", (message: any) => this.handleMessage(ws, message));
      ws.on("close", () => console.log("Client disconnected"));
    });

    // Subscribe to Redis Pub/Sub for proximity updates
    redis.subscribe("proximity_updates", (err, count) => {
      if (err) console.error("Redis Sub error", err);
      console.log(`Sub to ${count} channels.`);
    });

    redis.on("message", (channel, message) => {
      if (channel === "proximity_updates") {
        const data = JSON.parse(message);
        this.notifyUser(data.userId, data);
      }
    });
  }
  private async handleMessage(ws: WebSocket, message: WebSocket.RawData) {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "update_location") {
        const { userId, latitude, longitude } = data;

        //store locaiton in geosptial index
        await redis.geoadd("user_locations", longitude, latitude, userId);
        const nearbyUser = await redis.georadius(
          "user_location",
          longitude,
          latitude,
          10,
          "m"
        );
        //notifying the user via pub/sub
        redis.publish(
          "proximity_updates",
          JSON.stringify({ userId, latitude, longitude })
        );
        const lastLocation = await prisma.location.findUnique({
          where: { userId },
        });
        if (
          !lastLocation ||
          this.hasMovedSignificantly(lastLocation, latitude, longitude)
        ) {
          await prisma.location.upsert({
            where: { userId },
            update: { latitude, longitude, updatedAt: new Date() },
            create: { userId, latitude, longitude },
          });
        }
      }
    } catch (err) {
      console.error("Error processing the message:", err);
    }
  }

  private notifyUser(userId: string, data: any) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "nearbyUser", ...data }));
      }
    });
  }

  private hasMovedSignificantly(
    lastLocation: any,
    lat: number,
    lon: number
  ): boolean {
    const distance = this.harversineDistance(
      lastLocation.latitude,
      lastLocation.longitude,
      lat,
      lon
    );
    return distance > 50;
  }

  private harversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  }
}

export default WebSocketService.getInstance();
