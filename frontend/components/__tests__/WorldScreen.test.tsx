import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { AuthProvider } from "@/context/AuthContext";
import WorldScreen from "@/app/(tabs)/WorldScreen";

// Mock required modules
jest.mock("expo-font");
jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}));

jest.mock("expo-blur", () => ({
  BlurView: "BlurView",
}));

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Create a mock WebSocket class
class MockWebSocket {
  onopen: ((ev: any) => void) | null = null;
  onmessage: ((ev: any) => void) | null = null;
  onclose: (() => void) | null = null;
  send: jest.Mock;
  readyState: number;
  static instances: MockWebSocket[] = [];

  constructor() {
    MockWebSocket.instances.push(this);
    this.readyState = WebSocket.CONNECTING;
    this.send = jest.fn((data) => {
      if (this.onmessage && JSON.parse(data).type === "getUserDetails") {
        this.onmessage({
          data: JSON.stringify({
            type: "nearby_users",
            users: [
              {
                id: "1",
                username: "John Doe",
                image: "https://example.com/john.jpg",
                distance: 5,
                angle: 0,
              },
              {
                id: "2",
                username: "Jane Smith",
                image: "https://example.com/jane.jpg",
                distance: 8,
                angle: 1,
              },
            ],
          }),
        });
      }
    });

    // Simulate successful connection
    Promise.resolve().then(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen({} as Event);
    });
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose();
    }
  }
}

// Mock the global WebSocket
global.WebSocket = MockWebSocket as any;

describe("WorldScreen", () => {
  beforeEach(() => {
    MockWebSocket.instances = []; // Clear instances
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Close any open WebSocket connections
    MockWebSocket.instances.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
  });

  it("renders correctly and displays users within 10 meters proximity", async () => {
    const { getByText } = render(
      <AuthProvider>
        <WorldScreen />
      </AuthProvider>
    );

    // Initial render check
    expect(getByText("People Nearby")).toBeTruthy();

    // Wait for users to be displayed
    await waitFor(
      () => {
        expect(getByText("John Doe")).toBeTruthy();
        expect(getByText("5.0m away")).toBeTruthy();
        expect(getByText("Jane Smith")).toBeTruthy();
        expect(getByText("8.0m away")).toBeTruthy();
      },
      { timeout: 3000 }
    );
  });
});
