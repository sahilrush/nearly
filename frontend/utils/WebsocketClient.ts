import { LocationUpdate, NearbyUsers, UserProximity } from "@/types/locaiton";
import * as Location from "expo-location";

type EventCallback = (data: any) => void;

class WebSocketClient {
  private static instance: WebSocketClient | null = null;
  private ws: WebSocket | null = null;
  private userId: string;
  private serverUrl: string;
  private locationWatcher: Location.LocationSubscription | null = null;
  private eventListeners: { [eventType: string]: EventCallback[] } = {};
  private onNearbyUserCallback: ((userIds: string[]) => void) | null = null;

  private constructor(userId: string, serverUrl: string) {
    this.userId = userId;
    this.serverUrl = serverUrl;
  }

  public static getInstance(
    userId: string,
    serverUrl: string
  ): WebSocketClient {
    if (
      !WebSocketClient.instance ||
      WebSocketClient.instance.userId !== userId
    ) {
      WebSocketClient.instance = new WebSocketClient(userId, serverUrl);
    }
    return WebSocketClient.instance;
  }

  public connect() {
    if (this.ws) {
      console.warn("WebSocket is already connected.");
      return;
    }

    this.ws = new WebSocket(this.serverUrl);

    this.ws.onopen = () => {
      console.log("✅ Connected to WebSocket server");
      this.register();
      this.startLocationTracking();
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleServerMessage(data);
    };

    this.ws.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
    };

    this.ws.onclose = () => {
      console.warn("⚠️ WebSocket disconnected. Reconnecting...");
      this.stopLocationTracking();
      this.ws = null;
      setTimeout(() => this.connect(), 5000); // Retry connection
    };
  }

  private register() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "register", userId: this.userId }));
    }
  }

  private async startLocationTracking() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.error("❌ Location permission denied");
        return;
      }

      this.locationWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (location) => {
          this.sendLocationUpdate(
            location.coords.latitude,
            location.coords.longitude
          );
        }
      );
    } catch (error) {
      console.error("❌ Error starting location tracking:", error);
    }
  }

  private sendLocationUpdate(latitude: number, longitude: number) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const update: LocationUpdate = {
        type: "update_location",
        userId: this.userId,
        latitude,
        longitude,
      };
      this.ws.send(JSON.stringify(update));
    }
  }

  private handleServerMessage(data: NearbyUsers | UserProximity) {
    console.log("📩 WebSocket message received:", data);

    switch (data.type) {
      case "nearby_users":
        this.emit("nearby_users", data.users);
        break;
      case "user_entered_proximity":
        console.log(`👥 User ${data.userId} entered proximity`);
        this.emit("user_entered_proximity", data);
        break;
      default:
        console.warn("⚠️ Unknown WebSocket message type:", data);
    }
  }

  public on(eventType: string, callback: EventCallback) {
    if (!this.eventListeners[eventType]) {
      this.eventListeners[eventType] = [];
    }
    this.eventListeners[eventType].push(callback);
  }

  private emit(eventType: string, data: any) {
    if (this.eventListeners[eventType]) {
      this.eventListeners[eventType].forEach((callback) => callback(data));
    }
  }

  private stopLocationTracking() {
    if (this.locationWatcher) {
      this.locationWatcher.remove();
      this.locationWatcher = null;
    }
  }

  setOnNearbyUsersCallback(callback: (userIds: string[]) => void) {
    this.onNearbyUserCallback = callback;
  }

  public disconnect() {
    this.stopLocationTracking();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    console.log("🔌 WebSocket disconnected.");
  }
}

export default WebSocketClient;
