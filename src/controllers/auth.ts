import { Request, Response } from "express";
import { signinSchenma } from "../utils/types";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
const JWT_SECRET = "2121";
const prisma = new PrismaClient();

//signup funciton
export async function signUp(req: Request, res: Response) {
  try {
    const { email, password } = signinSchenma.parse(req.body);

    const userExists = await prisma.user.findUnique({ where: { email } });
    if (!userExists) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    const hashPassowrd = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        password: hashPassowrd,
      },
    });
    res.status(201).json({ message: "User Registered Successfully" });
    return;
  } catch (err) {
    res.status(500).json({ err: "Internal server error" });
    return;
  }
}


//signin funciton
export async function signIn(req: Request, res: Response) {
  try {
    const { email, password } = signinSchenma.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ message: "Invalid Creaditionals" });
      return;
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });
    res.status(200).json({ message: "Login successful", token });
    return;
  } catch (err) {
    res.status(500).json({ err: "Internal server error" });
    return;
  }
}
