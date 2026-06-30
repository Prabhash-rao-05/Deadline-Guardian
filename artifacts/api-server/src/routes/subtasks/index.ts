import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, subtasksTable, tasksTable } from "@workspace/db";
import {
  ListSubtasksParams,
  CreateSubtaskBody,
  CreateSubtaskParams,
  UpdateSubtaskBody,
  UpdateSubtaskParams,
  DeleteSubtaskParams,
} from "@workspace/api-zod";
import { requireAuth } from "../../middlewares/auth";

const router: IRouter = Router();

router.get("/tasks/:taskId/subtasks", requireAuth, async (req, res): Promise<void> => {
  const params = ListSubtasksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Verify task belongs to user
  const [task] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.taskId), eq(tasksTable.userId, req.userId)));
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const subtasks = await db
    .select()
    .from(subtasksTable)
    .where(eq(subtasksTable.taskId, params.data.taskId))
    .orderBy(asc(subtasksTable.createdAt));
  res.json(subtasks);
});

router.post("/tasks/:taskId/subtasks", requireAuth, async (req, res): Promise<void> => {
  const params = CreateSubtaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateSubtaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [task] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.taskId), eq(tasksTable.userId, req.userId)));
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const [subtask] = await db
    .insert(subtasksTable)
    .values({ title: parsed.data.title, taskId: params.data.taskId })
    .returning();
  res.status(201).json(subtask);
});

router.patch("/tasks/:taskId/subtasks/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateSubtaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSubtaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Enforce ownership: subtask -> task -> userId
  const [ownedTask] = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.taskId), eq(tasksTable.userId, req.userId)));
  if (!ownedTask) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const [subtask] = await db
    .update(subtasksTable)
    .set(parsed.data)
    .where(and(eq(subtasksTable.id, params.data.id), eq(subtasksTable.taskId, ownedTask.id)))
    .returning();

  if (!subtask) {
    res.status(404).json({ error: "Subtask not found" });
    return;
  }
  res.json(subtask);
});

router.delete("/tasks/:taskId/subtasks/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteSubtaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Enforce ownership: subtask -> task -> userId
  const [ownedTask] = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.taskId), eq(tasksTable.userId, req.userId)));
  if (!ownedTask) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  await db
    .delete(subtasksTable)
    .where(and(eq(subtasksTable.id, params.data.id), eq(subtasksTable.taskId, ownedTask.id)));
  res.sendStatus(204);
});

export default router;
