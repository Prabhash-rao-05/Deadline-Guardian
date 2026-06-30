import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { UpdateProfileBody, UpdateAvatarBody } from "@workspace/api-zod";
import { requireAuth } from "../../middlewares/auth";

const router: IRouter = Router();

router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  const { name, timeZone, dailyWorkingHours, preferredWorkingTime, theme, notificationsEnabled } = parsed.data;
  if (name !== undefined) updates.name = name;
  if (timeZone !== undefined) updates.timeZone = timeZone;
  if (dailyWorkingHours !== undefined) updates.dailyWorkingHours = dailyWorkingHours;
  if (preferredWorkingTime !== undefined) updates.preferredWorkingTime = preferredWorkingTime;
  if (theme !== undefined) updates.theme = theme;
  if (notificationsEnabled !== undefined) updates.notificationsEnabled = notificationsEnabled;

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.userId))
    .returning();

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    profilePicture: user.profilePicture,
    timeZone: user.timeZone,
    dailyWorkingHours: user.dailyWorkingHours,
    preferredWorkingTime: user.preferredWorkingTime,
    theme: user.theme,
    notificationsEnabled: user.notificationsEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
});

router.post("/users/me/avatar", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateAvatarBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ profilePicture: parsed.data.profilePicture })
    .where(eq(usersTable.id, req.userId))
    .returning();

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    profilePicture: user.profilePicture,
    timeZone: user.timeZone,
    dailyWorkingHours: user.dailyWorkingHours,
    preferredWorkingTime: user.preferredWorkingTime,
    theme: user.theme,
    notificationsEnabled: user.notificationsEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  });
});

export default router;
