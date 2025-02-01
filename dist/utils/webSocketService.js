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
const ioredis_1 = __importDefault(require("ioredis"));
const ws_1 = __importDefault(require("ws"));
const prisma = new client_1.PrismaClient();
const redisClient = new ioredis_1.default();
class WebSocketService {
    constructor() {
        this.clients = new Map();
        this.wss = new ws_1.default.Server({ port: 8000 });
        this.setupListeners();
    }
    static getInstance() {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }
    setupListeners() {
        this.wss.on("connection", (ws) => {
            console.log("Client connected");
            ws.on("message", (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    if (data.type === "register" && data.userId) {
                        this.clients.set(data.userId, ws);
                        console.log(`User ${data.userId} registered`);
                    }
                    else {
                        this.handleMessage(ws, message);
                    }
                }
                catch (err) {
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
    handleMessage(ws, message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === "update_location") {
                    const { userId, latitude, longitude } = data;
                    console.log(`Location update from ${userId}`);
                    const userExists = yield prisma.user.findUnique({
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
                    yield redisClient.geoadd("user_locations", longitude, latitude, userId);
                    // Find nearby users within 10 meters
                    const nearbyUsers = yield redisClient.georadius("user_locations", longitude, latitude, 10, "m");
                    // Process nearby users
                    const otherUsers = nearbyUsers
                        .map((id) => id)
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
                        otherUsers.forEach((otherUserId) => {
                            this.sendToUser(otherUserId, {
                                type: "user_entered_proximity",
                                userId,
                                location: { latitude, longitude },
                            });
                        });
                    }
                    try {
                        // Update database if significant movement
                        const lastLocation = yield prisma.location.findUnique({
                            where: { userId },
                        });
                        const shouldUpdate = !lastLocation ||
                            this.hasMovedSignificantly(lastLocation
                                ? {
                                    latitude: parseFloat(lastLocation.latitude.toString()),
                                    longitude: parseFloat(lastLocation.longitude.toString()),
                                }
                                : null, latitude, longitude);
                        if (shouldUpdate) {
                            yield prisma.location.upsert({
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
                    }
                    catch (err) {
                        console.error(`Database failed for user`);
                        this.sendToUser(userId, {
                            type: "error",
                            message: "Failed to update locaition in database",
                        });
                    }
                }
            }
            catch (err) {
                console.error("Error processing message:", err);
            }
        });
    }
    sendToUser(userId, message) {
        const client = this.clients.get(userId);
        if (client && client.readyState === ws_1.default.OPEN) {
            client.send(JSON.stringify(message));
        }
        else {
            console.warn(`User ${userId} not connected - notification skipped`);
        }
    }
    hasMovedSignificantly(lastLocation, newLat, newLon) {
        if (!lastLocation)
            return true;
        const distance = this.haversineDistance(lastLocation.latitude, lastLocation.longitude, newLat, newLon);
        return distance > 50; // 50 meters threshold
    }
    haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth radius in meters
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
exports.default = WebSocketService.getInstance();
