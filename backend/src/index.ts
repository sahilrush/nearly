import express from "express";
import authRoutes from "./routes/authRoutes";

const app = express();
app.use(express.json());

app.use("/auth", authRoutes);

const PORT = process.env.PORT || 3000; 
app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});


console.log("WebSocket Server started on port 8080");
