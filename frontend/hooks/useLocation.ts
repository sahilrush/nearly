import { useState, useEffect } from "react";
import { Alert } from "react-native";
import * as Location from "expo-location";

const useLocation = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setErrorMsg("Permission denied");
        showPopup("Location Permission", "Location access was denied.");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLocation(location);
      showPopup("Location Access", `Your location is ${location.coords.latitude}, ${location.coords.longitude}`);
    } catch (error) {
      setErrorMsg("Failed to fetch location");
    }
  };

  // Function to show a popup
  const showPopup = (title: string, message: string) => {
    Alert.alert(title, message, [{ text: "OK", onPress: () => console.log("Popup closed") }]);
  };

  return { location, errorMsg, requestLocationPermission };
};

export default useLocation;
