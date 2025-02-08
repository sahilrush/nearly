import BottomTabs from "@/navigation/BottomTabs";
import { NavigationContainer } from "@react-navigation/native";
import React from "react";
import { registerRootComponent } from "expo";

export default function App() {
  return (
    
      <BottomTabs />
    
  );
}

registerRootComponent(App);
