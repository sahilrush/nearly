import { StyleSheet, View, Text } from "react-native";

export default function Notifications() {
  return (
    <View style={style.container}>
      <Text style={style.text}>Notifications</Text>
    </View>
  );
}

const style = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 24, fontWeight: "bold" },
});
