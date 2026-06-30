import { Router, type IRouter } from "express";
import { eq, and, like, or, asc, desc, sql } from "drizzle-orm";
import { db, tasksTable, categoriesTable, subtasksTable } from "@workspace/db";
import {
  ListTasksQueryParams,
  CreateTaskBody,
  UpdateTaskBody,
  GetTaskParams,
  UpdateTaskParams,
  DeleteTaskParams,
  CompleteTaskParams,
} from "@workspace/api-zod";
import { requireAuth } from "../../middlewares/auth";

const router: IRouter = Router();

function buildTaskWithCategory(task: typeof tasksTable.$inferSelect, category: typeof categoriesTable.$inferSelect | null, subtasks: typeof subtasksTable.$inferSelect[]) {
  return {
    ...task,
    category: category
      ? { id: category.id, name: category.name, color: category.color, icon: category.icon, createdAt: category.createdAt }
      : null,
    subtasks: subtasks.map((s) => ({ id: s.id, taskId: s.taskId, title: s.title, completed: s.completed, createdAt: s.createdAt })),
  };
}

router.get("/tasks", requireAuth, async (req, res): Promise<void> => {
  const qp = ListTasksQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }

  const { status, priority, categoryId, search, sortBy, sortOrder, tag } = qp.data;

  // Build where conditions
  const conditions = [eq(tasksTable.userId, req.userId)];
  if (status) conditions.push(eq(tasksTable.status, status));
  if (priority) conditions.push(eq(tasksTable.priority, priority));
  if (categoryId) conditions.push(eq(tasksTable.categoryId, categoryId));
  if (search) {
    conditions.push(
      or(
        like(tasksTable.title, `%${search}%`),
        like(tasksTable.description, `%${search}%`),
      )!,
    );
  }

  // Build order
  let orderFn = desc(tasksTable.createdAt);
  if (sortBy === "deadline") orderFn = sortOrder === "asc" ? asc(tasksTable.deadline) : desc(tasksTable.deadline);
  else if (sortBy === "priority") orderFn = sortOrder === "asc" ? asc(tasksTable.priority) : desc(tasksTable.priority);
  else if (sortBy === "title") orderFn = sortOrder === "asc" ? asc(tasksTable.title) : desc(tasksTable.title);
  else if (sortBy === "status") orderFn = sortOrder === "asc" ? asc(tasksTable.status) : desc(tasksTable.status);

  const rows = await db
    .select({
      task: tasksTable,
      category: categoriesTable,
    })
    .from(tasksTable)
    .leftJoin(categoriesTable, eq(tasksTable.categoryId, categoriesTable.id))
    .where(and(...conditions))
    .orderBy(orderFn);

  // Filter by tag if provided (array contains)
  const filtered = tag
    ? rows.filter((r) => r.task.tags?.includes(tag))
    : rows;

  // Fetch subtasks for all tasks
  const taskIds = filtered.map((r) => r.task.id);
  const allSubtasks = taskIds.length > 0
    ? await db.select().from(subtasksTable).where(
        sql`${subtasksTable.taskId} = ANY(ARRAY[${sql.join(taskIds.map((id) => sql`${id}`), sql`, `)}]::integer[])`
      )
    : [];

  const subtasksByTaskId = allSubtasks.reduce<Record<number, typeof subtasksTable.$inferSelect[]>>((acc, s) => {
    acc[s.taskId] ??= [];
    acc[s.taskId].push(s);
    return acc;
  }, {});

  const result = filtered.map((r) =>
    buildTaskWithCategory(r.task, r.category, subtasksByTaskId[r.task.id] ?? []),
  );

  res.json(result);
});

router.post("/tasks", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { deadline: dlCreate, ...restCreate } = parsed.data;
  const deadlineStrCreate = dlCreate instanceof Date ? dlCreate.toISOString().split("T")[0] : String(dlCreate);
  const [task] = await db
    .insert(tasksTable)
    .values({ ...restCreate, deadline: deadlineStrCreate, userId: req.userId, tags: parsed.data.tags ?? [] })
    .returning();

  const category = task.categoryId
    ? (await db.select().from(categoriesTable).where(eq(categoriesTable.id, task.categoryId)))[0] ?? null
    : null;

  res.status(201).json(buildTaskWithCategory(task, category, []));
});

router.get("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db
    .select({ task: tasksTable, category: categoriesTable })
    .from(tasksTable)
    .leftJoin(categoriesTable, eq(tasksTable.categoryId, categoriesTable.id))
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.userId, req.userId)));

  if (rows.length === 0) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const { task, category } = rows[0];
  const subtasks = await db
    .select()
    .from(subtasksTable)
    .where(eq(subtasksTable.taskId, task.id))
    .orderBy(asc(subtasksTable.createdAt));

  res.json(buildTaskWithCategory(task, category, subtasks));
});

router.patch("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { deadline: dlUpdate, ...restUpdate } = parsed.data;
  const patchData: typeof restUpdate & { deadline?: string } = { ...restUpdate };
  if (dlUpdate !== undefined) {
    patchData.deadline = dlUpdate instanceof Date ? dlUpdate.toISOString().split("T")[0] : String(dlUpdate);
  }
  const [task] = await db
    .update(tasksTable)
    .set(patchData)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.userId, req.userId)))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const category = task.categoryId
    ? (await db.select().from(categoriesTable).where(eq(categoriesTable.id, task.categoryId)))[0] ?? null
    : null;

  const subtasks = await db
    .select()
    .from(subtasksTable)
    .where(eq(subtasksTable.taskId, task.id));

  res.json(buildTaskWithCategory(task, category, subtasks));
});

router.delete("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  // Verify ownership BEFORE deleting subtasks — prevents cross-user subtask wipe
  const [ownedTask] = await db
    .select({ id: tasksTable.id })
    .from(tasksTable)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.userId, req.userId)));
  if (!ownedTask) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  await db.delete(subtasksTable).where(eq(subtasksTable.taskId, ownedTask.id));
  await db.delete(tasksTable).where(eq(tasksTable.id, ownedTask.id));
  res.sendStatus(204);
});

router.post("/tasks/:id/complete", requireAuth, async (req, res): Promise<void> => {
  const params = CompleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [task] = await db
    .update(tasksTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.userId, req.userId)))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const category = task.categoryId
    ? (await db.select().from(categoriesTable).where(eq(categoriesTable.id, task.categoryId)))[0] ?? null
    : null;

  const subtasks = await db.select().from(subtasksTable).where(eq(subtasksTable.taskId, task.id));

  res.json(buildTaskWithCategory(task, category, subtasks));
});

export default router;
