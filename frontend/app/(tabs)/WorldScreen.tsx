// frontend/app/(tabs)/WorldScreen.tsx

import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect, useRef } from "react";
import { UserCard } from "@/components/UserCard";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WS_URL } from "@/config";

const { width } = Dimensions.get("window");
const CIRCLE_SIZE = width * 0.85;

interface User {
  id: string;
  username: string;
  image: string;
  distance: number;
  angle: number;
}

export default function WorldScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Add error handling and logging
    try {
      console.log("Connecting to WebSocket...");
      wsRef.current = new WebSocket(WS_URL);
      const ws = wsRef.current;

      ws.onopen = () => {
        console.log("WebSocket Connected");
        ws.send(JSON.stringify({ type: "getUserDetails" }));
      };

      ws.onmessage = (event) => {
        console.log("Received message:", event.data);
        try {
          const message = JSON.parse(event.data);
          if (message.type === "nearby_users") {
            const nearbyUsers = message.users.filter(
              (user: User) => user.distance <= 10
            );
            console.log("Nearby users:", nearbyUsers);
            setUsers(nearbyUsers);
          } else if (message.type === "error") {
            console.error("WebSocket error:", message.message);
          }
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed");
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    } catch (error) {
      console.error("Error setting up WebSocket:", error);
    }
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem("userToken");
    router.replace("/auth");
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#FF4B6B", "#7B52AB", "#4568DC"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <Ionicons name="menu" size={24} color="#fff" />
        <Text style={styles.headerText}>People Nearby</Text>
        <Ionicons name="notifications-outline" size={24} color="#fff" />
      </View>

      <View style={styles.circleContainer}>
        <BlurView intensity={40} tint="dark" style={styles.mainCircle}>
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <UserCard
                username={item.username}
                image={item.image}
                distance={item.distance}
                angle={item.angle}
              />
            )}
            contentContainerStyle={styles.listContainer}
          />
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
  },
  circleContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  mainCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    overflow: "hidden",
  },
  listContainer: {
    padding: 20,
  },
  actionButton: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "white",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF4B6B",
  },
});
