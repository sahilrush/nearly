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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

const { width } = Dimensions.get("window");
const CIRCLE_SIZE = width * 0.85;
const ITEM_SIZE = 60;
const INNER_CIRCLE_RADIUS = CIRCLE_SIZE * 0.3;

interface User {
  id: string;
  name: string;
  image: string;
  distance: string;
  size: number;
  angle: Animated.Value;
  currentAngle: number;
  speed: number;
  direction: number;
}

const createUser = (
  id: string,
  name: string,
  image: string,
  distance: string,
  startAngle: number,
  size = ITEM_SIZE
): User => {
  return {
    id,
    name,
    image,
    distance,
    size,
    angle: new Animated.Value(startAngle),
    currentAngle: startAngle,
    speed: 0.001 + Math.random() * 0.001,
    direction: 1,
  };
};

export default function World() {
  const animationRef = useRef<number>();
  const [users, setUsers] = useState<User[]>([
    createUser(
      "1",
      "sahil",
      "https://pbs.twimg.com/profile_images/1862742390190063616/OlJWrU_3_400x400.jpg",
      "0.5 mi",
      0,
      ITEM_SIZE * 0.9
    ),
    createUser(
      "2",
      "sargam",
      "https://media.licdn.com/dms/image/v2/D5603AQH9LnII_HXrHQ/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1698821079941?e=2147483647&v=beta&t=1XGvRit2_LVRAtb-8y_e9mbtqXF102Ia_fX88-OvEI0",
      "1.2 mi",
      Math.PI * 0.4,
      ITEM_SIZE * 1.1
    ),
    createUser(
      "3",
      "anurag",
      "https://pbs.twimg.com/profile_images/1768753668017266688/aPodKd2q_400x400.jpg",
      "0.8 mi",
      Math.PI * 0.8,
      ITEM_SIZE
    ),

    createUser(
      "5",
      "pradeep",
      "https://media.licdn.com/dms/image/v2/D4E03AQGe7iyJ3AC2lg/profile-displayphoto-shrink_200_200/profile-displayphoto-shrink_200_200/0/1715067163067?e=2147483647&v=beta&t=qrLXLcAYF47zsV1t9LXQDq5h7AALUTQqSUkCUjpl_bw",
      "2.0 mi",
      Math.PI * 1.6,
      ITEM_SIZE * 1.05
    ),
  ]);

  const checkCollision = (user1: User, user2: User) => {
    const x1 = Math.cos(user1.currentAngle) * INNER_CIRCLE_RADIUS;
    const y1 = Math.sin(user1.currentAngle) * INNER_CIRCLE_RADIUS;
    const x2 = Math.cos(user2.currentAngle) * INNER_CIRCLE_RADIUS;
    const y2 = Math.sin(user2.currentAngle) * INNER_CIRCLE_RADIUS;

    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

    return distance < (user1.size + user2.size) / 2;
  };

  const updatePositions = () => {
    const newUsers = users.map((user) => ({
      ...user,
      currentAngle: user.currentAngle + user.speed * user.direction,
    }));

    // Check collisions
    for (let i = 0; i < newUsers.length; i++) {
      for (let j = i + 1; j < newUsers.length; j++) {
        if (checkCollision(newUsers[i], newUsers[j])) {
          // Reverse directions and slightly adjust speeds
          newUsers[i].direction *= -1;
          newUsers[j].direction *= -1;
          newUsers[i].speed *= 1.1;
          newUsers[j].speed *= 1.1;

          // Cap the speed
          newUsers[i].speed = Math.min(newUsers[i].speed, 0.003);
          newUsers[j].speed = Math.min(newUsers[j].speed, 0.003);
        }
      }
    }

    // Update animated values
    newUsers.forEach((user) => {
      user.angle.setValue(user.currentAngle);
    });

    setUsers(newUsers);
    animationRef.current = requestAnimationFrame(updatePositions);
  };

  useEffect(() => {
    animationRef.current = requestAnimationFrame(updatePositions);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <LinearGradient
        colors={["#FF4B6B", "#7B52AB", "#4568DC"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.backgroundCircle, styles.circle1]} />
      <View style={[styles.backgroundCircle, styles.circle2]} />
      <View style={[styles.backgroundCircle, styles.circle3]} />

      <View style={styles.header}>
        <Ionicons name="menu" size={24} color="#fff" />
        <Text style={styles.headerText}>People Nearby</Text>
        <Ionicons name="notifications-outline" size={24} color="#fff" />
      </View>

      <View style={styles.circleContainer}>
        <BlurView intensity={40} tint="dark" style={styles.mainCircle}>
          {users.map((user) => (
            <Animated.View
              key={user.id}
              style={[
                styles.userContainer,
                {
                  transform: [
                    {
                      translateX: user.angle.interpolate({
                        inputRange: [
                          0,
                          Math.PI / 2,
                          Math.PI,
                          (Math.PI * 3) / 2,
                          Math.PI * 2,
                        ],
                        outputRange: [
                          INNER_CIRCLE_RADIUS,
                          0,
                          -INNER_CIRCLE_RADIUS,
                          0,
                          INNER_CIRCLE_RADIUS,
                        ],
                      }),
                    },
                    {
                      translateY: user.angle.interpolate({
                        inputRange: [
                          0,
                          Math.PI / 2,
                          Math.PI,
                          (Math.PI * 3) / 2,
                          Math.PI * 2,
                        ],
                        outputRange: [
                          0,
                          INNER_CIRCLE_RADIUS,
                          0,
                          -INNER_CIRCLE_RADIUS,
                          0,
                        ],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity>
                <Image
                  source={{ uri: user.image }}
                  style={[
                    styles.userImage,
                    { width: user.size, height: user.size },
                  ]}
                />
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userDistance}>{user.distance}</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </BlurView>
      </View>

      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="heart" size={24} color="#FF4B6B" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.mainActionButton]}
        >
          <Ionicons name="chatbubble" size={32} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="camera" size={24} color="#333" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundCircle: {
    position: "absolute",
    borderRadius: 1000,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  circle1: {
    width: width * 1.5,
    height: width * 1.5,
    top: -width * 0.4,
    left: -width * 0.25,
    backgroundColor: "rgba(255, 107, 107, 0.2)",
  },
  circle2: {
    width: width * 1.3,
    height: width * 1.3,
    top: width * 0.2,
    right: -width * 0.3,
    backgroundColor: "rgba(78, 205, 196, 0.15)",
  },
  circle3: {
    width: width,
    height: width,
    bottom: -width * 0.2,
    left: width * 0.1,
    backgroundColor: "rgba(69, 183, 209, 0.1)",
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
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  userContainer: {
    position: "absolute",
    alignItems: "center",
    left: CIRCLE_SIZE / 2 - ITEM_SIZE / 2,
    top: CIRCLE_SIZE / 2 - ITEM_SIZE / 2,
  },
  userImage: {
    borderRadius: ITEM_SIZE / 2,
    borderWidth: 3,
    borderColor: "#fff",
  },
  userInfo: {
    position: "absolute",
    bottom: -40,
    alignItems: "center",
    width: ITEM_SIZE * 2,
    left: -ITEM_SIZE / 2,
  },
  userName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  userDistance: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
  },
  bottomActions: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingVertical: 20,
    paddingBottom: 40,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  mainActionButton: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: "#FF4B6B",
    elevation: 5,
  },
});

