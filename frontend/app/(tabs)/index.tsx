import React from "react";
import { registerRootComponent } from "expo";
import { AuthProvider } from "@/context/AuthContext";
import BottomTabs from "@/utils/BottomTabs";

export default function App() {
  return (
    <>
      <BottomTabs />
    </>
  );
}

registerRootComponent(App);
