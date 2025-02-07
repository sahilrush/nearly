import { Decimal } from "@prisma/client/runtime/library";
import Redis from "ioredis";
import WebSocket from "ws";
import { RateLimiter } from "limiter";
import { LocationUpdateMessage, RegisterMessage } from "../../utils/messages";
import { CONFIG } from "../../utils/config";
import { PrismaClient } from "@prisma/client";

// Mock interfaces to match the actual types
interface MockWebSocket extends WebSocket {
  send: jest.Mock;
  terminate: jest.Mock;
  ping: jest.Mock;
}

// Mock the external dependencies
jest.mock(".prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findUnique: jest.fn(),
    },
    location: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  })),
}));

jest.mock("ioredis");
jest.mock("ws");
jest.mock("limiter");

describe("WebSocketService", () => {
  let service: any;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockRedis: jest.Mocked<Redis>;
  let mockWs: MockWebSocket;
  let mockWsServer: jest.Mocked<WebSocket.Server>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup WebSocket mock
    mockWs = {
      send: jest.fn(),
      terminate: jest.fn(),
      ping: jest.fn(),
      readyState: WebSocket.OPEN,
      on: jest.fn(),
    } as unknown as MockWebSocket;

    mockWsServer = {
      on: jest.fn(),
    } as unknown as jest.Mocked<WebSocket.Server>;

    (WebSocket.Server as unknown as jest.Mock).mockImplementation(
      () => mockWsServer
    );

    // Initialize service
    const WebSocketService = require("./WebSocketService").default;
    service = WebSocketService;

    // Get mock instances
    mockPrisma = (PrismaClient as jest.Mock).mock
      .instances[0] as jest.Mocked<PrismaClient>;
    mockRedis = (Redis as unknown as jest.Mock).mock
      .instances[0] as jest.Mocked<Redis>;
  });

  describe("Connection Management", () => {
    it("should handle new client connection", () => {
      // Get connection handler
      const connectionHandler = mockWsServer.on.mock.calls.find(
        ([event]) => event === "connection"
      )?.[1];
      expect(connectionHandler).toBeDefined();

      // Simulate connection
      connectionHandler!.call(mockWsServer, mockWs);

      // Verify event listeners were set up
      expect(mockWs.on).toHaveBeenCalledWith("message", expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith("close", expect.any(Function));
    });

    it("should handle client registration", () => {
      const userId = "test-user";
      const registerMessage: RegisterMessage = {
        type: "register",
        userId,
      };

      // Get message handler
      const messageHandler = (mockWs.on as jest.Mock).mock.calls.find(
        ([event]: [string]) => event === "message"
      )?.[1];

      // Simulate registration message
      messageHandler!(Buffer.from(JSON.stringify(registerMessage)));

      // Verify client was registered
      expect(service["clients"].get(userId)).toBe(mockWs);
    });

    it("should handle client disconnection", () => {
      const userId = "test-user";
      service["clients"].set(userId, mockWs);

      // Get close handler
      const closeHandler = (mockWs.on as jest.Mock).mock.calls.find(
        ([event]) => event === "close"
      )?.[1];

      // Simulate disconnection
      closeHandler!();

      // Verify cleanup
      expect(service["clients"].has(userId)).toBeFalsy();
      expect(mockRedis.zrem).toHaveBeenCalledWith("user_locations", userId);
    });
  });

  describe("Location Updates", () => {
    const userId = "test-user";
    const validLocation: LocationUpdateMessage = {
      type: "update_location",
      userId,
      latitude: 37.7749,
      longitude: -122.4194,
    };

    beforeEach(() => {
      service["clients"].set(userId, mockWs);
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        name: "Test User",
      });
    });

    it("should process valid location update", async () => {
      mockRedis.georadius.mockResolvedValue([]);

      await service["handleLocationUpdate"](validLocation);

      expect(mockRedis.geoadd).toHaveBeenCalledWith(
        "user_locations",
        validLocation.longitude,
        validLocation.latitude,
        userId
      );

      expect(mockPrisma.location.upsert).toHaveBeenCalled();
    });

    it("should handle nearby user notifications", async () => {
      const nearbyUserId = "nearby-user";
      const nearbyUserWs = { ...mockWs, send: jest.fn() };

      service["clients"].set(nearbyUserId, nearbyUserWs);

      mockRedis.georadius.mockResolvedValue([
        [nearbyUserId, "5", ["-122.4194", "37.7749"]],
      ]);

      await service["handleLocationUpdate"](validLocation);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("nearby_users")
      );
      expect(nearbyUserWs.send).toHaveBeenCalledWith(
        expect.stringContaining("user_entered_proximity")
      );
    });

    it("should enforce rate limits", async () => {
      const rateLimiter = new RateLimiter({
        tokensPerInterval: CONFIG.MAX_UPDATE_PER_MINUTE,
        interval: "minute",
      });

      service["updateLimiters"].set(userId, rateLimiter);
      rateLimiter.tryRemoveTokens = jest.fn().mockResolvedValue(false);

      await service["handleLocationUpdate"](validLocation);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("Rate limit exceeded")
      );
      expect(mockRedis.geoadd).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid location coordinates", async () => {
      const invalidLocation: LocationUpdateMessage = {
        type: "update_location",
        userId: "test-user",
        latitude: 100, // Invalid latitude
        longitude: -122.4194,
      };

      await service["handleLocationUpdate"](invalidLocation);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("Invalid location coordinates")
      );
    });

    it("should handle database errors", async () => {
      const userId = "test-user";
      const validLocation: LocationUpdateMessage = {
        type: "update_location",
        userId,
        latitude: 37.7749,
        longitude: -122.4194,
      };

      (mockPrisma.location.upsert as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      await service["handleLocationUpdate"](validLocation);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining("Server error occurred")
      );
    });
  });
});
