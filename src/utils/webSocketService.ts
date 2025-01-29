import { PrismaClient } from "@prisma/client";
import WebSocket from "ws";

const prisma = new PrismaClient();

class WebSocketService {
  private static instance: WebSocketService;
  private wss: WebSocket.Server;
  private clients: Map<string, WebSocket> = new Map();

  private constructor() {
    this.wss = new WebSocket.Server({ port: 8000 });
    this.setupListeners(); // ✅ Ensure WebSocket starts listening
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  private setupListeners() {
    this.wss.on("connection", (ws) => {
      // ✅ Fixed event name
      console.log("Client connected");

      ws.on("message", (message: any) => this.handleMessage(ws, message));
      ws.on("close", () => console.log("Client disconnected"));
    });
  }

  private async handleMessage(ws: WebSocket, message: WebSocket.RawData) {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === "update_location") {
        const { userId, latitude, longitude } = data;

        // ✅ Store the WebSocket connection for this user
        this.clients.set(userId, ws);

        // ✅ Update user location in the database
        await prisma.location.upsert({
          where: { userId },
          update: { latitude, longitude, updatedAt: new Date() },
          create: { userId, latitude, longitude },
        });

        // ✅ Find nearby users
        const nearbyUsers = await this.findNearbyUsers(latitude, longitude, 10);

        // ✅ Notify nearby users
        nearbyUsers.forEach((user: { id: string }) => {
          const client = this.clients.get(user.id);
          if (client) {
            client.send(
              JSON.stringify({
                type: "nearbyUser",
                userId,
                latitude,
                longitude,
              })
            );
          }
        });
      }
    } catch (err) {
      console.error("Error processing the message:", err);
    }
  }

  private async findNearbyUsers(lat: number, lon: number, radius: number) {
    return prisma.$queryRaw<
      { id: string; username: string; latitude: number; longitude: number }[]
    >`
      SELECT u.id, u.username, l.latitude, l.longitude
      FROM "User" u
      JOIN "Location" l ON u.id = l.userId
      WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326),
        ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326),
        ${radius}
      );
    `;
  }
}

export default WebSocketService.getInstance();
