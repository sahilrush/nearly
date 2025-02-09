import { Request, Response } from "express";
import { signinSchema, signupSchema } from "../utils/types";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const JWT_SECRET = "2121";
const prisma = new PrismaClient();

// Signup function
export async function signUp(req: Request, res: Response) {
  try {
    const { email, password, username } = signupSchema.parse(req.body);

    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      res.status(409).json({ message: "User already exists" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: { email, username, password: hashedPassword },
    });

    res.status(201).json({ message: "User registered successfully" });
    return;
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Internal server error" });
    return;
  }
}
// Signin function
export async function signIn(req: Request, res: Response) {
  try {
    const { email, password } = signinSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({ message: "Login successful", token });
    return;
  } catch (err) {
    console.error("Signin error:", err);
    res.status(500).json({ error: "Internal server error" });
    return;
  }
}
