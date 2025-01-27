import express from "express";
import authRoutes from "./routes/authRoutes";
const app = express();


app.use(express.json())


app.use('/auth',authRoutes);
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
