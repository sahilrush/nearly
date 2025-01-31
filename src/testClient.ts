import WebSocket from "ws";

(() => {
  const ws = new WebSocket("ws://localhost:8000");

  ws.on("open", () => {
    console.log("Connected to WebSocket server");

    ws.send(
      JSON.stringify({
        type: "update_location",
        userId: "user123",
        latitude: 37.7749,
        longitude: -122.4194,
      })
    );
  });

  ws.on("message", (data) => {
    console.log("Message from server:", data.toString());
  });

  ws.on("close", () => console.log("Disconnected from server"));
})();
