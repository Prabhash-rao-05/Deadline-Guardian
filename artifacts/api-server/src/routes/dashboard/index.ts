import { Router, type IRouter } from "express";
import { eq, and, lt, gte, lte, ne, count, sql } from "drizzle-orm";
import { db, tasksTable, categoriesTable } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";

const router: IRouter = Router();

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function buildTaskWithCategory(task: typeof tasksTable.$inferSelect, category: typeof categoriesTable.$inferSelect | null) {
  return {
    ...task,
    category: category
      ? { id: category.id, name: category.name, color: category.color, icon: category.icon, createdAt: category.createdAt }
      : null,
    subtasks: [],
  };
}

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const today = getTodayStr();

  const allTasks = await db.select().from(tasksTable).where(eq(tasksTable.userId, req.userId));

  const totalTasks = allTasks.length;
  const completedToday = allTasks.filter(
    (t) => t.status === "completed" && t.completedAt && t.completedAt.toISOString().split("T")[0] === today,
  ).length;
  const pendingTasks = allTasks.filter((t) => t.status === "pending").length;
  const overdueTasks = allTasks.filter(
    (t) => t.deadline < today && t.status !== "completed" && t.status !== "missed",
  ).length;
  const inProgressTasks = allTasks.filter((t) => t.status === "in_progress").length;
  const completedTotal = allTasks.filter((t) => t.status === "completed").length;
  const completionRate = totalTasks > 0 ? Math.round((completedTotal / totalTasks) * 100) : 0;

  // Productivity score (weighted: completion rate 60%, no overdue 40%)
  const overduepenalty = Math.min(overdueTasks * 5, 40);
  const productivityScore = Math.max(0, Math.round(completionRate * 0.6 + (40 - overduepenalty)));

  // Streak: count consecutive days with at least 1 completion (simplified)
  const streak = completedToday > 0 ? 1 : 0;

  // Tasks completed this week
  const weekStart = addDays(today, -6);
  const tasksCompletedThisWeek = allTasks.filter(
    (t) => t.status === "completed" && t.completedAt && t.completedAt.toISOString().split("T")[0] >= weekStart,
  ).length;

  // Hours worked today (sum of estimatedHours for tasks completed today)
  const hoursWorkedToday = allTasks
    .filter((t) => t.status === "completed" && t.completedAt && t.completedAt.toISOString().split("T")[0] === today)
    .reduce((sum, t) => sum + (t.estimatedHours ?? 1), 0);

  res.json({
    totalTasks,
    completedToday,
    pendingTasks,
    overdueTasks,
    inProgressTasks,
    completionRate,
    productivityScore,
    streak,
    hoursWorkedToday,
    tasksCompletedThisWeek,
  });
});

router.get("/dashboard/today", requireAuth, async (req, res): Promise<void> => {
  const today = getTodayStr();
  const rows = await db
    .select({ task: tasksTable, category: categoriesTable })
    .from(tasksTable)
    .leftJoin(categoriesTable, eq(tasksTable.categoryId, categoriesTable.id))
    .where(and(eq(tasksTable.userId, req.userId), eq(tasksTable.deadline, today)));

  res.json(rows.map((r) => buildTaskWithCategory(r.task, r.category)));
});

router.get("/dashboard/upcoming", requireAuth, async (req, res): Promise<void> => {
  const today = getTodayStr();
  const in7days = addDays(today, 7);

  const rows = await db
    .select({ task: tasksTable, category: categoriesTable })
    .from(tasksTable)
    .leftJoin(categoriesTable, eq(tasksTable.categoryId, categoriesTable.id))
    .where(
      and(
        eq(tasksTable.userId, req.userId),
        gte(tasksTable.deadline, today),
        lte(tasksTable.deadline, in7days),
        ne(tasksTable.status, "completed"),
      ),
    )
    .orderBy(tasksTable.deadline);

  res.json(rows.map((r) => buildTaskWithCategory(r.task, r.category)));
});

router.get("/dashboard/overdue", requireAuth, async (req, res): Promise<void> => {
  const today = getTodayStr();
  const rows = await db
    .select({ task: tasksTable, category: categoriesTable })
    .from(tasksTable)
    .leftJoin(categoriesTable, eq(tasksTable.categoryId, categoriesTable.id))
    .where(
      and(
        eq(tasksTable.userId, req.userId),
        lt(tasksTable.deadline, today),
        ne(tasksTable.status, "completed"),
        ne(tasksTable.status, "missed"),
      ),
    )
    .orderBy(tasksTable.deadline);

  res.json(rows.map((r) => buildTaskWithCategory(r.task, r.category)));
});

export default router;
