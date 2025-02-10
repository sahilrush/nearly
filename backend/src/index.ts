import express from "express";
import authRoutes from "./routes/authRoutes";
import WebSocketService from "./utils/webSocketService";

const app = express();
app.use(express.json());

app.use("/auth", authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});

WebSocketService.getInstance();

console.log("WebSocket Server started on port 8080");
