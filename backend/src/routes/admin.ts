import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";

export const adminRouter = Router();

// List all users with roles and assigned projects
adminRouter.get("/users", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        organizationRole: true,
        organization: {
          select: { id: true, name: true },
        },
        createdAt: true,
        projects: {
          select: {
            project: {
              select: { id: true, name: true, color: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Flatten the project relation
    const result = users.map((u) => ({
      ...u,
      projects: u.projects.map((up) => up.project),
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// List organizations with member counts
adminRouter.get("/organizations", async (_req, res) => {
  try {
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        approvalRequired: true,
        createdAt: true,
        updatedAt: true,
        users: {
          select: {
            id: true,
            username: true,
            displayName: true,
            role: true,
            organizationRole: true,
          },
          orderBy: { displayName: "asc" },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const pendingCounts = await prisma.timeEntry.groupBy({
      by: ["userId"],
      where: { approvalStatus: "pending" },
      _count: { id: true },
    });

    const pendingByUser = new Map(pendingCounts.map((row) => [row.userId, row._count.id]));

    res.json(
      organizations.map((organization) => ({
        ...organization,
        _count: {
          users: organization._count.users,
          pendingApprovals: organization.users.reduce((total, user) => {
            return total + (pendingByUser.get(user.id) || 0);
          }, 0),
        },
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

// Create organization
adminRouter.post("/organizations", async (req, res) => {
  try {
    const { name, approvalRequired = false } = req.body;

    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "Organization name is required" });
      return;
    }

    const organization = await prisma.organization.create({
      data: {
        name,
        approvalRequired: Boolean(approvalRequired),
      },
      select: {
        id: true,
        name: true,
        approvalRequired: true,
        createdAt: true,
        updatedAt: true,
        users: {
          select: {
            id: true,
            username: true,
            displayName: true,
            role: true,
            organizationRole: true,
          },
        },
      },
    });

    res.status(201).json(organization);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create organization" });
  }
});

// Update organization
adminRouter.put("/organizations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, approvalRequired } = req.body;

    const existing = await prisma.organization.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(approvalRequired !== undefined ? { approvalRequired: Boolean(approvalRequired) } : {}),
      },
      select: {
        id: true,
        name: true,
        approvalRequired: true,
        createdAt: true,
        updatedAt: true,
        users: {
          select: {
            id: true,
            username: true,
            displayName: true,
            role: true,
            organizationRole: true,
          },
        },
      },
    });

    res.json(organization);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update organization" });
  }
});

// Assign user to organization
adminRouter.post("/organizations/:id/users", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, organizationRole = "member" } = req.body;

    if (!userId || typeof userId !== "string") {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    const [organization, user] = await Promise.all([
      prisma.organization.findUnique({ where: { id } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!organization) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: id,
        organizationRole: typeof organizationRole === "string" ? organizationRole : "member",
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to assign user to organization" });
  }
});

// Remove user from organization
adminRouter.delete("/organizations/:id/users/:userId", async (req, res) => {
  try {
    const { id, userId } = req.params;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.organizationId !== id) {
      res.status(400).json({ error: "User is not assigned to this organization" });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: null,
        organizationRole: "member",
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove user from organization" });
  }
});

// Pending approvals
adminRouter.get("/approvals", async (_req, res) => {
  try {
    const approvals = await prisma.timeEntry.findMany({
      where: { approvalStatus: "pending" },
      select: {
        id: true,
        date: true,
        hours: true,
        note: true,
        approvalStatus: true,
        project: { select: { id: true, name: true, color: true } },
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            role: true,
            organization: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    res.json(approvals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch approvals" });
  }
});

adminRouter.post("/approvals/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) {
      res.status(404).json({ error: "Time entry not found" });
      return;
    }

    await prisma.timeEntry.update({
      where: { id },
      data: {
        approvalStatus: "approved",
        approvedById: req.user!.userId,
        approvedAt: new Date(),
        rejectedAt: null,
        approvalNote: null,
      },
    });

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to approve time entry" });
  }
});

adminRouter.post("/approvals/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const entry = await prisma.timeEntry.findUnique({ where: { id } });
    if (!entry) {
      res.status(404).json({ error: "Time entry not found" });
      return;
    }

    await prisma.timeEntry.update({
      where: { id },
      data: {
        approvalStatus: "rejected",
        approvedById: req.user!.userId,
        rejectedAt: new Date(),
        approvedAt: null,
        approvalNote: typeof note === "string" ? note : null,
      },
    });

    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reject time entry" });
  }
});

// Create a new user
adminRouter.post("/users", async (req, res) => {
  try {
    const { username, password, displayName, role, projectIds } = req.body;

    if (!username || !password || !displayName) {
      res.status(400).json({ error: "Username, password, and display name are required" });
      return;
    }

    if (role && !["admin", "user"].includes(role)) {
      res.status(400).json({ error: "Role must be 'admin' or 'user'" });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      res.status(409).json({ error: "Username already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        displayName,
        role: role || "user",
        projects: projectIds?.length
          ? {
            create: projectIds.map((projectId: string) => ({ projectId })),
          }
          : undefined,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        createdAt: true,
        projects: {
          select: {
            project: {
              select: { id: true, name: true, color: true },
            },
          },
        },
      },
    });

    res.status(201).json({
      ...user,
      projects: user.projects.map((up) => up.project),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Update a user (role, displayName, project assignments, optional password)
adminRouter.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, role, projectIds, password } = req.body;

    if (role && !["admin", "user"].includes(role)) {
      res.status(400).json({ error: "Role must be 'admin' or 'user'" });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (role !== undefined) updateData.role = role;
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    // Update user fields
    await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // Update project assignments if provided
    if (projectIds !== undefined) {
      // Remove existing assignments
      await prisma.userProject.deleteMany({ where: { userId: id } });
      // Create new assignments
      if (projectIds.length > 0) {
        await prisma.userProject.createMany({
          data: projectIds.map((projectId: string) => ({ userId: id, projectId })),
        });
      }
    }

    // Return updated user
    const updated = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        createdAt: true,
        projects: {
          select: {
            project: {
              select: { id: true, name: true, color: true },
            },
          },
        },
      },
    });

    res.json({
      ...updated,
      projects: updated!.projects.map((up) => up.project),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Delete a user
adminRouter.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (id === req.user!.userId) {
      res.status(400).json({ error: "Cannot delete your own account" });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await prisma.user.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});
