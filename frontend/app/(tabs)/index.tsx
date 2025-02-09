import BottomTabs from "@/navigation/BottomTabs";
import React from "react";
import { registerRootComponent } from "expo";
import { AuthProvider } from "@/context/AuthContext";

export default function App() {
  return <BottomTabs />;
}

registerRootComponent(App);
