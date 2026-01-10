import { Router } from "express";
import { z } from "zod";
import { SignupRequestSchema, SigninRequestSchema } from "../schemas";
import { prisma } from "../../db/prismaClient";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = Router();

// Signup endpoint
router.post("/signup", async (req, res) => {
  try {
    // Validate input with Zod
    const validatedData = SignupRequestSchema.parse(req.body);
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });

    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Create user in database
    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: "USER"
      }
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "24h" }
    );
    
    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString()
      },
      token
    });

  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Signin endpoint
router.post("/signin", async (req, res) => {
  try {
    // Validate input with Zod
    const validatedData = SigninRequestSchema.parse(req.body);
    
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(validatedData.password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "24h" }
    );
    
    res.json({
      message: "Signin successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });

  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error("Signin error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
