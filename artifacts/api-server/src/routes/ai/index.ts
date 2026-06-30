import { Router, type IRouter } from "express";
import { eq, and, ne } from "drizzle-orm";
import { db, tasksTable } from "@workspace/db";
import {
  AiPrioritizeTasksBody,
  AiGenerateDailyPlanBody,
  AiParseNaturalLanguageTaskBody,
  AiChatBody,
  AiStartPomodoroBody,
} from "@workspace/api-zod";
import { requireAuth } from "../../middlewares/auth";
import {
  prioritizeTasksWithAi,
  generateDailyPlanWithAi,
  assessDeadlineRisk,
  generateSuggestions,
  parseNaturalLanguageTask,
  chatWithAi,
  type TaskForAi,
} from "../../lib/ai";

const router: IRouter = Router();

function toTaskForAi(t: typeof tasksTable.$inferSelect): TaskForAi {
  return {
    id: t.id,
    title: t.title,
    deadline: t.deadline,
    priority: t.priority,
    estimatedHours: t.estimatedHours,
    status: t.status,
    description: t.description,
  };
}

router.post("/ai/prioritize", requireAuth, async (req, res): Promise<void> => {
  const parsed = AiPrioritizeTasksBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { taskIds, availableHours } = parsed.data;

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.userId, req.userId));

  const filtered = taskIds.length > 0
    ? tasks.filter((t) => taskIds.includes(t.id))
    : tasks.filter((t) => t.status !== "completed" && t.status !== "missed");

  try {
    const result = await prioritizeTasksWithAi(filtered.map(toTaskForAi), availableHours ?? undefined);
    // Update tasks with AI priority
    await Promise.all(
      result.map((r) =>
        db
          .update(tasksTable)
          .set({ aiPriority: r.aiPriority, aiPriorityReason: r.explanation })
          .where(and(eq(tasksTable.id, r.taskId), eq(tasksTable.userId, req.userId))),
      ),
    );
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "AI prioritize failed");
    // Fallback: simple priority based on deadline
    const today = new Date().toISOString().split("T")[0];
    const fallback = filtered.map((t) => {
      const daysLeft = Math.ceil((new Date(t.deadline).getTime() - new Date(today).getTime()) / 86400000);
      const urgencyScore = daysLeft <= 1 ? 90 : daysLeft <= 3 ? 70 : daysLeft <= 7 ? 50 : 30;
      return {
        taskId: t.id,
        aiPriority: daysLeft <= 1 ? "high" : daysLeft <= 3 ? "medium" : "low",
        explanation: `Due in ${daysLeft} day(s)${t.estimatedHours ? `, needs ${t.estimatedHours}h` : ""}`,
        urgencyScore,
        recommendedStartTime: null,
      };
    });
    res.json(fallback);
  }
});

router.post("/ai/daily-plan", requireAuth, async (req, res): Promise<void> => {
  const parsed = AiGenerateDailyPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { date, availableHours, breakDurationMinutes, startTime } = parsed.data;

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.userId, req.userId), ne(tasksTable.status, "completed"), ne(tasksTable.status, "missed")));

  try {
    const dateStr = typeof date === "string" ? date : (date as unknown as Date).toISOString().split("T")[0];
    const result = await generateDailyPlanWithAi(
      tasks.map(toTaskForAi),
      availableHours,
      breakDurationMinutes ?? 15,
      startTime ?? "09:00",
      dateStr,
    );
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "AI daily plan failed");
    // Simple fallback schedule
    const schedule = [];
    let currentHour = 9;
    for (const task of tasks.slice(0, 4)) {
      const hours = task.estimatedHours ?? 1;
      const startH = `${String(currentHour).padStart(2, "0")}:00`;
      currentHour += hours;
      const endH = `${String(Math.floor(currentHour)).padStart(2, "0")}:${String(Math.round((currentHour % 1) * 60)).padStart(2, "0")}`;
      schedule.push({ startTime: startH, endTime: endH, type: "task", label: task.title, taskId: task.id, notes: null });
      schedule.push({ startTime: endH, endTime: `${String(Math.floor(currentHour) + (currentHour % 1 < 0.25 ? 0 : 0)).padStart(2, "0")}:${String(Math.round(((currentHour + 0.25) % 1) * 60)).padStart(2, "0")}`, type: "break", label: "Break", taskId: null, notes: null });
      currentHour += 0.25;
    }
    res.json(schedule);
  }
});

router.get("/ai/risk", requireAuth, async (req, res): Promise<void> => {
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.userId, req.userId), ne(tasksTable.status, "completed"), ne(tasksTable.status, "missed")));

  try {
    const result = await assessDeadlineRisk(tasks.map(toTaskForAi));
    // Update tasks with risk
    await Promise.all(
      result.map((r) =>
        db
          .update(tasksTable)
          .set({ riskLevel: r.riskLevel, riskReason: r.explanation })
          .where(and(eq(tasksTable.id, r.taskId), eq(tasksTable.userId, req.userId))),
      ),
    );
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "AI risk failed");
    const today = new Date().toISOString().split("T")[0];
    const fallback = tasks.map((t) => {
      const daysLeft = Math.ceil((new Date(t.deadline).getTime() - new Date(today).getTime()) / 86400000);
      const hoursNeeded = t.estimatedHours ?? 2;
      const hoursRemaining = Math.max(0, daysLeft * 8);
      const riskPct = hoursNeeded > hoursRemaining ? 90 : daysLeft <= 1 ? 70 : daysLeft <= 3 ? 40 : 15;
      return {
        taskId: t.id,
        riskLevel: riskPct >= 70 ? "high" : riskPct >= 40 ? "medium" : "low",
        riskPercentage: riskPct,
        explanation: `${daysLeft} day(s) remaining, ${hoursNeeded}h needed`,
        hoursRemaining,
        hoursNeeded,
        actionRequired: riskPct >= 70 ? "Start immediately" : riskPct >= 40 ? "Plan for today" : "On track",
      };
    });
    res.json(fallback);
  }
});

router.get("/ai/suggestions", requireAuth, async (req, res): Promise<void> => {
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.userId, req.userId), ne(tasksTable.status, "completed")));

  const today = new Date().toISOString().split("T")[0];
  const overdueTasks = tasks.filter((t) => t.deadline < today).length;
  const completedCount = (await db.select().from(tasksTable).where(and(eq(tasksTable.userId, req.userId), eq(tasksTable.status, "completed")))).length;
  const total = completedCount + tasks.length;
  const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  try {
    const result = await generateSuggestions(tasks.map(toTaskForAi), {
      completionRate,
      streak: 1,
      overdueTasks,
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "AI suggestions failed");
    const fallback = [];
    if (overdueTasks > 0) {
      fallback.push({ id: "sug_1", type: "start_now", message: `You have ${overdueTasks} overdue task(s). Address the most urgent one first.`, priority: "high", taskId: tasks.find((t) => t.deadline < today)?.id ?? null, actionLabel: "View overdue" });
    }
    if (tasks.length > 5) {
      fallback.push({ id: "sug_2", type: "break_task", message: "You have many tasks. Consider breaking larger tasks into smaller subtasks.", priority: "medium", taskId: null, actionLabel: "View tasks" });
    }
    fallback.push({ id: "sug_3", type: "focus", message: "Start with the task closest to its deadline to maintain momentum.", priority: "medium", taskId: tasks.sort((a, b) => a.deadline.localeCompare(b.deadline))[0]?.id ?? null, actionLabel: "Start now" });
    res.json(fallback);
  }
});

router.post("/ai/parse-task", requireAuth, async (req, res): Promise<void> => {
  const parsed = AiParseNaturalLanguageTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const result = await parseNaturalLanguageTask(parsed.data.text);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "AI parse task failed");
    res.json({ title: parsed.data.text, description: null, deadline: null, dueTime: null, priority: null, estimatedHours: null, tags: [] });
  }
});

router.post("/ai/chat", requireAuth, async (req, res): Promise<void> => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, conversationHistory } = parsed.data;

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.userId, req.userId), ne(tasksTable.status, "completed")));

  try {
    const result = await chatWithAi(message, conversationHistory ?? [], tasks.map(toTaskForAi));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "AI chat failed");
    res.json({ message: "I'm having trouble connecting right now. Please check your tasks and deadlines manually.", suggestedActions: ["View tasks", "Check deadlines"] });
  }
});

router.post("/ai/pomodoro-start", requireAuth, async (req, res): Promise<void> => {
  const parsed = AiStartPomodoroBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { taskId, workMinutes, breakMinutes } = parsed.data;

  const [task] = await db.select().from(tasksTable).where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, req.userId)));
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json({
    sessionId: `pom_${Date.now()}_${taskId}`,
    taskId,
    workMinutes: workMinutes ?? 25,
    breakMinutes: breakMinutes ?? 5,
    startedAt: new Date().toISOString(),
  });
});

export default router;
