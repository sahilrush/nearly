import * as Location from "expo-location";

class WebSocketClient {
  private static instance: WebSocketClient;
  private ws: WebSocket | null = null;
  private userId: string;
  private locationWatcher: Location.LocationSubscription | null = null;
  private onNearbyUsersCallback: ((users: string[]) => void) | null = null;

  private constructor(userId: string) {
    this.userId = userId;
  }
}
