import { Request, Response } from "express";
import { signinSchenma } from "../utils/types"; // Ensure this schema is properly defined and validated
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const JWT_SECRET = "2121"; // Ideally, use an environment variable for the secret
const prisma = new PrismaClient();

// Signup function
export async function signUp(req: Request, res: Response) {
  try {
    const { email, password } = signinSchenma.parse(req.body); // Ensure proper validation with zod or similar library

    // Check if user already exists
    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
      res.status(409).json({ message: "User already exists" }); // Conflict error
      return;
    }
    

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    res.status(201).json({ message: "User Registered Successfully" });
  } catch (err) {
    console.error("Signup error:", err); // Log the error for debugging
    res.status(500).json({ err: "Internal server error" });
  }
}

// Signin function
export async function signIn(req: Request, res: Response) {
  try {
    const { email, password } = signinSchenma.parse(req.body); // Ensure proper validation with zod or similar library

    // Find the user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ message: "Invalid Credentials" }); // Unauthorized error
      return;
    }

    // Compare the password with the stored hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: "Invalid Credentials" }); // Unauthorized error
      return;
    }

    // Generate a JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h", // Token expiration time
    });

    res.status(200).json({ message: "Login successful", token });
  } catch (err) {
    console.error("Signin error:", err); // Log the error for debugging
    res.status(500).json({ err: "Internal server error" });
  }
}



