"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const ws_1 = __importDefault(require("ws"));
const prisma = new client_1.PrismaClient();
class WebSocketService {
    constructor() {
        this.clients = new Map();
        this.wss = new ws_1.default.Server({ port: 8000 });
        this.setupListeners(); // ✅ Ensure WebSocket starts listening
    }
    static getInstance() {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }
    setupListeners() {
        this.wss.on("connection", (ws) => {
            // ✅ Fixed event name
            console.log("Client connected");
            ws.on("message", (message) => this.handleMessage(ws, message));
            ws.on("close", () => console.log("Client disconnected"));
        });
    }
    handleMessage(ws, message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === "update_location") {
                    const { userId, latitude, longitude } = data;
                    // ✅ Store the WebSocket connection for this user
                    this.clients.set(userId, ws);
                    // ✅ Update user location in the database
                    yield prisma.location.upsert({
                        where: { userId },
                        update: { latitude, longitude, updatedAt: new Date() },
                        create: { userId, latitude, longitude },
                    });
                    // ✅ Find nearby users
                    const nearbyUsers = yield this.findNearbyUsers(latitude, longitude, 10);
                    // ✅ Notify nearby users
                    nearbyUsers.forEach((user) => {
                        const client = this.clients.get(user.id);
                        if (client) {
                            client.send(JSON.stringify({
                                type: "nearbyUser",
                                userId,
                                latitude,
                                longitude,
                            }));
                        }
                    });
                }
            }
            catch (err) {
                console.error("Error processing the message:", err);
            }
        });
    }
    findNearbyUsers(lat, lon, radius) {
        return __awaiter(this, void 0, void 0, function* () {
            return prisma.$queryRaw `
      SELECT u.id, u.username, l.latitude, l.longitude
      FROM "User" u
      JOIN "Location" l ON u.id = l.userId
      WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(l.longitude, l.latitude), 4326),
        ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326),
        ${radius}
      );
    `;
        });
    }
}
exports.default = WebSocketService.getInstance();
