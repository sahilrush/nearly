import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { AuthProvider } from "@/context/AuthContext";
import WorldScreen from "@/app/(tabs)/WorldScreen";

// Add these mock setups
jest.mock("expo-font");
jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons", // Mock the specific icon component you're using
}));

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Mock expo-font's loadAsync function
jest.mock("expo-font", () => ({
  loadAsync: jest.fn().mockResolvedValue(true),
}));

describe("WorldScreen", () => {
  it("renders correctly and displays users within 10 meters proximity", async () => {
    const { getByText } = render(
      <AuthProvider>
        <WorldScreen />
      </AuthProvider>
    );

    expect(getByText("People Nearby")).toBeTruthy();

    const mockWebSocket = new WebSocket("ws://localhost:8000");
    mockWebSocket.onopen = () => {
      mockWebSocket.send(
        JSON.stringify({
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
        })
      );
    };

    await waitFor(() => {
      expect(getByText("John Doe")).toBeTruthy();
      expect(getByText("5.0m away")).toBeTruthy();
      expect(getByText("Jane Smith")).toBeTruthy();
      expect(getByText("8.0m away")).toBeTruthy();
    });
  });
});
