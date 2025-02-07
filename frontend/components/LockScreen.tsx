import React from "react";
import { View, Text, Button } from "react-native";
import useLocation from "../hooks/useLocation";

const LocationScreen = () => {
  const { location, errorMsg, requestLocationPermission } = useLocation();

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 18, fontWeight: "bold" }}>Your Location:</Text>
      {errorMsg ? (
        <Text style={{ color: "red" }}>{errorMsg}</Text>
      ) : location ? (
        <Text>
          Latitude: {location.coords.latitude}, Longitude:{" "}
          {location.coords.longitude}
        </Text>
      ) : (
        <Text>Fetching location</Text>
      )}

      <Button
        title="Request Permission Again"
        onPress={requestLocationPermission}
      />
    </View>
  );
};

export default LocationScreen;
