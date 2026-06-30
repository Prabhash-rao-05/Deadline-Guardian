import OpenAI from "openai";
import { logger } from "./logger";

if (!process.env.OPENAI_API_KEY) {
  logger.warn("OPENAI_API_KEY is not set — AI features will be disabled");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "not-set",
});

export interface TaskForAi {
  id: number;
  title: string;
  deadline: string;
  priority: string;
  estimatedHours: number | null;
  status: string;
  description?: string | null;
}

export async function prioritizeTasksWithAi(
  tasks: TaskForAi[],
  availableHours?: number,
): Promise<Array<{ taskId: number; aiPriority: string; explanation: string; urgencyScore: number; recommendedStartTime: string | null }>> {
  const today = new Date().toISOString().split("T")[0];
  const prompt = `You are a productivity AI coach. Analyze these tasks and rank them by urgency.

Today is ${today}. Available hours today: ${availableHours ?? 8}.

Tasks:
${JSON.stringify(tasks, null, 2)}

Return a JSON array (no markdown) where each element has:
- taskId (number)
- aiPriority ("high" | "medium" | "low")
- explanation (concise, max 20 words, e.g. "Due tomorrow, needs 5h — start immediately")
- urgencyScore (0-100, higher = more urgent)
- recommendedStartTime (e.g. "09:00" or null)

Sort by urgencyScore descending.`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 1024,
  });

  const raw = resp.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : (parsed.tasks ?? parsed.result ?? []);
}

export async function generateDailyPlanWithAi(
  tasks: TaskForAi[],
  availableHours: number,
  breakMinutes: number,
  startTime: string,
  date: string,
): Promise<Array<{ startTime: string; endTime: string; type: string; label: string; taskId: number | null; notes: string | null }>> {
  const prompt = `You are a scheduling AI. Create an optimized daily schedule.

Date: ${date}
Start time: ${startTime}
Available hours: ${availableHours}
Break duration: ${breakMinutes} minutes every 90 minutes

Tasks to schedule:
${JSON.stringify(tasks, null, 2)}

Return a JSON array (no markdown, key "schedule") of time blocks with:
- startTime (e.g. "09:00")
- endTime (e.g. "10:30")
- type ("task" | "break" | "buffer")
- label (task title or "Break" or "Buffer")
- taskId (number or null)
- notes (brief note or null)

Include breaks and end with a buffer. Only schedule pending/in_progress tasks.`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 1024,
  });

  const raw = resp.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);
  return parsed.schedule ?? parsed.blocks ?? [];
}

export async function assessDeadlineRisk(
  tasks: TaskForAi[],
): Promise<Array<{ taskId: number; riskLevel: string; riskPercentage: number; explanation: string; hoursRemaining: number | null; hoursNeeded: number | null; actionRequired: string }>> {
  const today = new Date();
  const prompt = `You are a deadline risk AI. Assess the probability of missing each deadline.

Today: ${today.toISOString()}

Tasks:
${JSON.stringify(tasks, null, 2)}

Return JSON array (key "risks") with:
- taskId (number)
- riskLevel ("low" | "medium" | "high")
- riskPercentage (0-100)
- explanation (concise, max 25 words)
- hoursRemaining (number or null)
- hoursNeeded (number or null)
- actionRequired (brief action string)`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 1024,
  });

  const raw = resp.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);
  return parsed.risks ?? [];
}

export async function generateSuggestions(
  tasks: TaskForAi[],
  userStats: { completionRate: number; streak: number; overdueTasks: number },
): Promise<Array<{ id: string; type: string; message: string; priority: string; taskId: number | null; actionLabel: string | null }>> {
  const prompt = `You are a productivity coach AI. Generate 3-5 actionable suggestions.

User stats: ${JSON.stringify(userStats)}
Active tasks: ${JSON.stringify(tasks.slice(0, 10), null, 2)}

Return JSON (key "suggestions") array with:
- id (unique string like "sug_1")
- type ("break_task" | "start_now" | "reschedule" | "focus" | "start_early")
- message (specific, actionable, max 30 words)
- priority ("high" | "medium" | "low")
- taskId (number or null)
- actionLabel (short button label or null)`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 512,
  });

  const raw = resp.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);
  return parsed.suggestions ?? [];
}

export async function parseNaturalLanguageTask(
  text: string,
): Promise<{ title: string; description: string | null; deadline: string | null; dueTime: string | null; priority: string | null; estimatedHours: number | null; tags: string[] }> {
  const today = new Date().toISOString().split("T")[0];
  const prompt = `Parse this natural language task description into structured fields.

Today is ${today}.
Input: "${text}"

Return JSON with:
- title (string, required)
- description (string or null)
- deadline (YYYY-MM-DD string or null)
- dueTime (HH:MM string or null)
- priority ("low" | "medium" | "high" | "urgent" or null)
- estimatedHours (number or null)
- tags (string array, may be empty)`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 256,
  });

  const raw = resp.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw);
}

export async function chatWithAi(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  tasks: TaskForAi[],
): Promise<{ message: string; suggestedActions: string[] }> {
  const systemPrompt = `You are Deadline Guardian, an AI productivity coach. You help users manage tasks, deadlines, and productivity. Be concise, specific, and actionable.

User's current tasks:
${JSON.stringify(tasks.slice(0, 15), null, 2)}

Keep responses under 150 words. Suggest specific actions when relevant.`;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content }) as OpenAI.ChatCompletionMessageParam),
    { role: "user", content: message },
  ];

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: 512,
  });

  const aiMessage = resp.choices[0]?.message?.content ?? "I'm here to help! Tell me about your tasks.";

  // Extract suggested actions if the response mentions specific tasks
  const suggestedActions: string[] = [];
  if (aiMessage.toLowerCase().includes("start")) suggestedActions.push("Start next task");
  if (aiMessage.toLowerCase().includes("plan")) suggestedActions.push("Generate daily plan");
  if (aiMessage.toLowerCase().includes("break")) suggestedActions.push("Break down task");

  return { message: aiMessage, suggestedActions };
}
