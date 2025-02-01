"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const webSocketService_1 = __importDefault(require("./utils/webSocketService"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use("/auth", authRoutes_1.default);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on ${PORT}`);
});
webSocketService_1.default;
console.log("WebSocket Server started on port 8080");
