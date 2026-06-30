import { pgTable, text, serial, timestamp, integer, real, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  deadline: date("deadline", { mode: "string" }).notNull(),
  dueTime: text("due_time"),
  priority: text("priority").notNull().default("medium"),
  estimatedHours: real("estimated_hours"),
  categoryId: integer("category_id"),
  tags: text("tags").array().default([]),
  repeatOption: text("repeat_option"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  aiPriority: text("ai_priority"),
  aiPriorityReason: text("ai_priority_reason"),
  riskLevel: text("risk_level"),
  riskReason: text("risk_reason"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
