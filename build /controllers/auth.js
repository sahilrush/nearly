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
const types_1 = require("../utils/types");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = "2121";
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
//signup funciton
function signUp(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { email, password } = types_1.signinSchenma.parse(req.body);
            const userExists = yield prisma.user.findUnique({ where: { email } });
            if (!userExists) {
                res.status(401).json({ message: "User not found" });
                return;
            }
            const hashPassowrd = yield bcrypt_1.default.hash(password, 10);
            yield prisma.user.create({
                data: {
                    email,
                    password: hashPassowrd,
                },
            });
            res.status(201).json({ message: "User Registered Successfully" });
            return;
        }
        catch (err) {
            res.status(500).json({ err: "Internal server error" });
            return;
        }
    });
}
//signin funciton
function signIn(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { email, password } = types_1.signinSchenma.parse(req.body);
            const user = yield prisma.user.findUnique({ where: { email } });
            if (!user) {
                res.status(401).json({ message: "Invalid Creaditionals" });
                return;
            }
            const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
                expiresIn: "1h",
            });
            res.status(200).json({ message: "Login successful", token });
            return;
        }
        catch (err) {
            res.status(500).json({ err: "Internal server error" });
            return;
        }
    });
}
