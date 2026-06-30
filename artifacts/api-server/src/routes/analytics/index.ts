import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, tasksTable, categoriesTable } from "@workspace/db";
import { GetProductivityStatsQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../../middlewares/auth";

const router: IRouter = Router();

function dateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function dayName(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

router.get("/analytics/productivity", requireAuth, async (req, res): Promise<void> => {
  const qp = GetProductivityStatsQueryParams.safeParse(req.query);
  if (!qp.success) {
    res.status(400).json({ error: qp.error.message });
    return;
  }

  const period = qp.data.period ?? "weekly";
  const today = new Date();
  let startDate: Date;

  if (period === "daily") {
    startDate = today;
  } else if (period === "monthly") {
    startDate = addDays(today, -29);
  } else {
    startDate = addDays(today, -6);
  }

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.userId, req.userId),
        gte(tasksTable.deadline, dateStr(startDate)),
        lte(tasksTable.deadline, dateStr(today)),
      ),
    );

  const tasksCompleted = tasks.filter((t) => t.status === "completed").length;
  const missedDeadlines = tasks.filter((t) => t.status === "missed").length;
  const hoursWorked = tasks
    .filter((t) => t.status === "completed")
    .reduce((sum, t) => sum + (t.estimatedHours ?? 1), 0);
  const completionRate = tasks.length > 0 ? Math.round((tasksCompleted / tasks.length) * 100) : 0;
  const focusScore = Math.min(100, Math.round(completionRate * 0.7 + (hoursWorked > 0 ? 30 : 0)));
  const avgTaskDuration =
    tasksCompleted > 0 ? Math.round((hoursWorked / tasksCompleted) * 10) / 10 : 0;

  res.json({ period, tasksCompleted, hoursWorked, missedDeadlines, completionRate, focusScore, avgTaskDuration });
});

router.get("/analytics/weekly-progress", requireAuth, async (req, res): Promise<void> => {
  const today = new Date();
  const result = [];

  for (let i = 6; i >= 0; i--) {
    const day = addDays(today, -i);
    const dayStr = dateStr(day);

    const tasks = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.userId, req.userId), eq(tasksTable.deadline, dayStr)));

    const completed = tasks.filter((t) => t.status === "completed").length;
    const hoursWorked = tasks
      .filter((t) => t.status === "completed")
      .reduce((sum, t) => sum + (t.estimatedHours ?? 1), 0);

    result.push({
      date: dayStr,
      day: dayName(day),
      completed,
      total: tasks.length,
      hoursWorked,
    });
  }

  res.json(result);
});

router.get("/analytics/category-breakdown", requireAuth, async (req, res): Promise<void> => {
  const tasks = await db
    .select({ task: tasksTable, category: categoriesTable })
    .from(tasksTable)
    .leftJoin(categoriesTable, eq(tasksTable.categoryId, categoriesTable.id))
    .where(eq(tasksTable.userId, req.userId));

  // Group by category
  const groups: Record<string, { categoryId: number | null; name: string; color: string; count: number; completed: number }> = {};

  for (const { task, category } of tasks) {
    const key = category ? String(category.id) : "uncategorized";
    if (!groups[key]) {
      groups[key] = {
        categoryId: category?.id ?? null,
        name: category?.name ?? "Uncategorized",
        color: category?.color ?? "#94a3b8",
        count: 0,
        completed: 0,
      };
    }
    groups[key].count++;
    if (task.status === "completed") groups[key].completed++;
  }

  res.json(Object.values(groups));
});

export default router;
