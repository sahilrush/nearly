import express from "express";
import authRoutes from "./routes/authRoutes";
import webSocketService from "./utils/webSocketService";
const app = express();

app.use(express.json());

app.use("/auth", authRoutes);
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
webSocketService;
console.log("WebSocket Server started on port 8080");
