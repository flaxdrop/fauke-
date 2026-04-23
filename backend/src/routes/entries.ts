import { Router } from "express";
import { prisma } from "../db.js";

export const entryRouter = Router();

async function getApprovalStatusForUser(userId: string): Promise<"approved" | "pending"> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      organization: {
        select: { approvalRequired: true },
      },
    },
  });

  return user?.organization?.approvalRequired ? "pending" : "approved";
}

// List entries (with optional date range)
entryRouter.get("/", async (req, res) => {
  try {
    const { from, to } = req.query;
    const userId = req.user!.userId;
    const where: any = { userId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from as string);
      if (to) where.date.lte = new Date(to as string);
    }
    const entries = await prisma.timeEntry.findMany({
      where,
      include: { project: true },
      orderBy: { date: "asc" },
    });
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch entries" });
  }
});

// Create entry
entryRouter.post("/", async (req, res) => {
  try {
    const { date, hours, note, projectId } = req.body;
    if (!date || hours === undefined || !projectId) {
      res.status(400).json({ error: "date, hours, and projectId are required" });
      return;
    }
    const entry = await prisma.timeEntry.create({
      data: {
        date: new Date(date),
        hours,
        note: note || null,
        projectId,
        userId: req.user!.userId,
        approvalStatus: await getApprovalStatusForUser(req.user!.userId),
      },
      include: { project: true },
    });
    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create entry" });
  }
});

// Update entry
entryRouter.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    // Verify ownership
    const existing = await prisma.timeEntry.findFirst({ where: { id, userId } });
    if (!existing) { res.status(404).json({ error: "Entry not found" }); return; }
    const { date, hours, note, projectId } = req.body;
    const approvalStatus = await getApprovalStatusForUser(userId);
    const entry = await prisma.timeEntry.update({
      where: { id },
      data: {
        ...(date && { date: new Date(date) }),
        ...(hours !== undefined && { hours }),
        ...(note !== undefined && { note }),
        ...(projectId && { projectId }),
        approvalStatus,
        approvedById: null,
        approvedAt: null,
        rejectedAt: null,
        approvalNote: null,
      },
      include: { project: true },
    });
    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update entry" });
  }
});

// Delete entry
entryRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const existing = await prisma.timeEntry.findFirst({ where: { id, userId } });
    if (!existing) { res.status(404).json({ error: "Entry not found" }); return; }
    await prisma.timeEntry.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete entry" });
  }
});
