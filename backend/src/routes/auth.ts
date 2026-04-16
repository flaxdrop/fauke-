import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { signToken, authMiddleware } from "../auth.js";
import { buildMagicLinkUrl, createMagicLinkToken, verifyMagicLinkToken } from "../magic-link.js";

export const authRouter = Router();

// Login
authRouter.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const token = signToken({ userId: user.id, username: user.username, role: user.role });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// Request a magic link for a user.
authRouter.post("/magic-link/request", async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || typeof username !== "string") {
      res.status(400).json({ error: "Username is required" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, displayName: true, role: true },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const magicToken = createMagicLinkToken({ userId: user.id, username: user.username, role: user.role });
    const magicLinkUrl = buildMagicLinkUrl(magicToken);

    res.json({
      magicLinkUrl,
      expiresInMinutes: 15,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create magic link" });
  }
});

// Exchange a magic link token for a regular auth token.
authRouter.post("/magic-link/exchange", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== "string") {
      res.status(400).json({ error: "Magic link token is required" });
      return;
    }

    const payload = verifyMagicLinkToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const authToken = signToken({ userId: user.id, username: user.username, role: user.role });

    res.json({
      token: authToken,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Invalid or expired magic link" });
  }
});

// Get current user info
authRouter.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, username: true, displayName: true, role: true },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});
