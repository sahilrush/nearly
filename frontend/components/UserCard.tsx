import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";

interface UserCardProps {
  username: string;
  image: string;
  distance: number;
  angle: number;
}

export function UserCard({ username, image, distance }: UserCardProps) {
  return (
    <View style={styles.card}>
      <Image source={{ uri: image }} style={styles.avatar} />
      <Text style={styles.username}>{username}</Text>
      <Text style={styles.distance}>{distance.toFixed(1)}m away</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    marginVertical: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
  },
  username: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  distance: {
    fontSize: 14,
    color: "#666",
  },
});
