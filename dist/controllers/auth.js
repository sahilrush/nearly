"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signUp = signUp;
exports.signIn = signIn;
const types_1 = require("../utils/types"); // Ensure this schema is properly defined and validated
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const JWT_SECRET = "2121"; // Ideally, use an environment variable for the secret
const prisma = new client_1.PrismaClient();
// Signup function
function signUp(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { email, password, username } = types_1.signupSchema.parse(req.body); // Ensure proper validation with zod or similar library
            // Check if user already exists
            const userExists = yield prisma.user.findUnique({ where: { email } });
            if (userExists) {
                res.status(409).json({ message: "User already exists" }); // Conflict error
                return;
            }
            // Hash the password
            const hashedPassword = yield bcrypt_1.default.hash(password, 10);
            // Create a new user
            yield prisma.user.create({
                data: {
                    email,
                    username,
                    password: hashedPassword,
                },
            });
            res.status(201).json({ message: "User Registered Successfully" });
        }
        catch (err) {
            console.error("Signup error:", err);
            res.status(500).json({ error: "Internal server error" });
            return;
        }
    });
}
// Signin function
function signIn(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { email, password } = types_1.signinSchenma.parse(req.body); // Ensure proper validation with zod or similar library
            // Find the user by email
            const user = yield prisma.user.findUnique({ where: { email } });
            if (!user) {
                res.status(401).json({ message: "Invalid Credentials" }); // Unauthorized error
                return;
            }
            // Compare the password with the stored hashed password
            const isPasswordValid = yield bcrypt_1.default.compare(password, user.password);
            if (!isPasswordValid) {
                res.status(401).json({ message: "Invalid Credentials" }); // Unauthorized error
                return;
            }
            // Generate a JWT token
            const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
                expiresIn: "1h", // Token expiration time
            });
            res.status(200).json({ message: "Login successful", token });
        }
        catch (err) {
            console.error("Signin error:", err); // Log the error for debugging
            res.status(500).json({ err: "Internal server error" });
        }
    });
}
