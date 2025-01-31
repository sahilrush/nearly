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
const redis = new ioredis_1.default();
class WebSocketService {
    constructor() {
        this.clients = new Map();
        this.wss = new ws_1.default.Server({ port: 8000 });
        this.setupListeners(); // Ensure WebSocket starts listening
    }
    static getInstance() {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }
    setupListeners() {
        this.wss.on("connection", (ws) => {
            //  Fixed event name
            console.log("Client connected");
            ws.on("message", (message) => this.handleMessage(ws, message));
            ws.on("close", () => console.log("Client disconnected"));
        });
        // Subscribe to Redis Pub/Sub for proximity updates
        redis.subscribe("proximity_updates", (err, count) => {
            if (err)
                console.error("Redis Sub error", err);
            console.log(`Sub to ${count} channels.`);
        });
        redis.on("message", (channel, message) => {
            if (channel === "proximity_updates") {
                const data = JSON.parse(message);
                this.notifyUser(data.userId, data);
            }
        });
    }
    handleMessage(ws, message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === "update_location") {
                    const { userId, latitude, longitude } = data;
                    //store locaiton in geosptial index
                    yield redis.geoadd("user_locations", longitude, latitude, userId);
                    const nearbyUser = yield redis.georadius("user_location", longitude, latitude, 10, "m");
                    //notifying the user via pub/sub
                    redis.publish("proximity_updates", JSON.stringify({ userId, latitude, longitude }));
                    const lastLocation = yield prisma.location.findUnique({
                        where: { userId },
                    });
                    if (!lastLocation ||
                        this.hasMovedSignificantly(lastLocation, latitude, longitude)) {
                        yield prisma.location.upsert({
                            where: { userId },
                            update: { latitude, longitude, updatedAt: new Date() },
                            create: { userId, latitude, longitude },
                        });
                    }
                }
            }
            catch (err) {
                console.error("Error processing the message:", err);
            }
        });
    }
    notifyUser(userId, data) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === ws_1.default.OPEN) {
                client.send(JSON.stringify(Object.assign({ type: "nearbyUser" }, data)));
            }
        });
    }
    hasMovedSignificantly(lastLocation, lat, lon) {
        const distance = this.harversineDistance(lastLocation.latitude, lastLocation.longitude, lat, lon);
        return distance > 50;
    }
    harversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in meters
    }
}
exports.default = WebSocketService.getInstance();
