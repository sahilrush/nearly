import useLocation from "@/hooks/useLocation";
import React from "react";
import { View, Text, Button } from "react-native";

export default function App() {
  const { location, errorMsg, requestLocationPermission } = useLocation();

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 18, fontWeight: "bold" }}>Location</Text>

      {errorMsg ? <Text style={{ color: "red" }}>{errorMsg}</Text> : null}

      {location ? (
        <Text>
          my location: {location.coords.latitude}, {location.coords.longitude}
        </Text>
      ) : (
        <Text>fetching location...</Text>
      )}

      <Button title="Request Location" onPress={requestLocationPermission} />
    </View>
  );
}
