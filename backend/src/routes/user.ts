import { Router } from "express";
import { prisma } from "../db.js";
import { authMiddleware } from "../auth.js";

export const userRouter = Router();

type UserPreferences = {
    language: string;
    timezone: string;
    emailNotifications: boolean;
};

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePreferences(value: unknown): UserPreferences | null {
    if (!value || typeof value !== "object") return null;

    const prefs = value as Partial<UserPreferences>;
    return {
        language: typeof prefs.language === "string" ? prefs.language : "en",
        timezone: typeof prefs.timezone === "string" ? prefs.timezone : "UTC",
        emailNotifications: typeof prefs.emailNotifications === "boolean" ? prefs.emailNotifications : true,
    };
}

userRouter.get("/settings", authMiddleware, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.userId },
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                avatar: true,
                preferences: true,
            },
        });

        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch settings" });
    }
});

userRouter.put("/settings", authMiddleware, async (req, res) => {
    try {
        const userId = req.user!.userId;
        const { email, displayName, avatar, preferences } = req.body as {
            email?: string | null;
            displayName?: string;
            avatar?: string | null;
            preferences?: unknown;
        };

        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, preferences: true },
        });

        if (!currentUser) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        if (email !== undefined && email !== null && email !== "" && !isValidEmail(email)) {
            res.status(400).json({ error: "Invalid email format" });
            return;
        }

        if (email) {
            const existingUser = await prisma.user.findFirst({
                where: {
                    email,
                    NOT: { id: userId },
                },
            });

            if (existingUser) {
                res.status(400).json({ error: "Email already in use" });
                return;
            }
        }

        const normalizedPreferences = preferences !== undefined ? normalizePreferences(preferences) : null;
        if (preferences !== undefined && !normalizedPreferences) {
            res.status(400).json({ error: "Invalid preferences format" });
            return;
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                ...(email !== undefined ? { email: email || null } : {}),
                ...(displayName !== undefined ? { displayName } : {}),
                ...(avatar !== undefined ? { avatar: avatar || null } : {}),
                ...(normalizedPreferences ? { preferences: normalizedPreferences } : {}),
            },
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                avatar: true,
                preferences: true,
            },
        });

        res.json(updatedUser);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update settings" });
    }
});
