import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  Animated,
  FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useAuth } from "@/context/AuthContext";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import WebSocketClient from "@/utils/WebsocketClient";

const { width } = Dimensions.get("window");
const CIRCLE_SIZE = width * 0.85;
const ITEM_SIZE = 60;
const PROXIMITY_RADIUS = CIRCLE_SIZE / 2;

interface User {
  id: string;
  username: string;
  image: string;
  distance: number;
  angle: number;
}

export default function World() {
  const { logout, userId } = useAuth();
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000");

    ws.onopen = () => {
      console.log("Connected to WebSocket");
      ws.send(
        JSON.stringify({ type: "getUserDetails", userId: "your-user-id" })
      );
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "nearby_users") {
        setUsers(message.users);
      } else if (message.type === "error") {
        console.error(message.message);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
    };

    return () => {
      ws.close();
    };
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
      <TouchableOpacity style={styles.actionButton} onPress={handleLogout}>
        <Text>Logout</Text>
      </TouchableOpacity>
      <View style={styles.circleContainer}>
        <BlurView intensity={40} tint="dark" style={styles.mainCircle}>
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Animated.View
                style={[
                  styles.userContainer,
                  {
                    transform: [
                      {
                        translateX:
                          (CIRCLE_SIZE / 2 - ITEM_SIZE / 2) *
                          Math.cos(item.angle),
                      },
                      {
                        translateY:
                          (CIRCLE_SIZE / 2 - ITEM_SIZE / 2) *
                          Math.sin(item.angle),
                      },
                    ],
                  },
                ]}
              >
                <Image source={{ uri: item.image }} style={styles.userImage} />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.username}</Text>
                  <Text style={styles.userDistance}>
                    {item.distance.toFixed(1)}m
                  </Text>
                  <View style={styles.container}>
                    {users.map((user) => (
                      <View key={user.id} style={styles.userCard}>
                        <Image
                          source={{ uri: user.image }}
                          style={styles.userImage}
                        />
                        <Text style={styles.userName}>{user.username}</Text>
                        <Text style={styles.userDistance}>
                          {user.distance.toFixed(1)}m away
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Animated.View>
            )}
          />
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerText: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  circleContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  mainCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  userInfo: { position: "absolute", bottom: -30, alignItems: "center" },
  actionButton: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    padding: 10,
    backgroundColor: "white",
    borderRadius: 8,
  },
  userContainer: { flex: 1, padding: 20 },
  userCard: { marginBottom: 20, alignItems: "center" },
  userImage: { width: 100, height: 100, borderRadius: 50 },
  userName: { fontSize: 18, fontWeight: "bold", marginTop: 10 },
  userDistance: { fontSize: 14, color: "gray" },
});
