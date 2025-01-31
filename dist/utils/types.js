"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signinSchenma = exports.signupSchema = void 0;
const zod_1 = require("zod");
exports.signupSchema = zod_1.z.object({
    username: zod_1.z.string().min(3),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6)
});
exports.signinSchenma = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string()
});
