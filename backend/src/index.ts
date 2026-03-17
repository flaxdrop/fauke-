// @ts-nocheck
import express from "express";
import cors from "cors";
import { authMiddleware, adminMiddleware } from "./auth.js";
import { authRouter } from "./routes/auth.js";
import { projectRouter } from "./routes/projects.js";
import { entryRouter } from "./routes/entries.js";
import { exportRouter } from "./routes/export.js";
import { adminRouter } from "./routes/admin.js";
import { integrationRouter } from "./routes/integrations.js";
import { pluginRouter } from "./routes/plugins.js";

// Initialize plugin system (auto-registers built-in plugins)
import "./plugins/index.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Public routes
app.use("/api/auth", authRouter);
app.use("/api/plugins", pluginRouter);  // List plugins (public), test/exec (auth required)

// Protected routes
app.use("/api/projects", authMiddleware, projectRouter);
app.use("/api/entries", authMiddleware, entryRouter);
app.use("/api/export", authMiddleware, exportRouter);

// Admin routes (auth + admin role required)
app.use("/api/admin", authMiddleware, adminMiddleware, adminRouter);
app.use("/api/admin/integrations", authMiddleware, adminMiddleware, integrationRouter);

app.listen(PORT, () => {
  console.log(`🚀 Fauke API running on http://localhost:${PORT}`);
});
