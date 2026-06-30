import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  RegisterBody,
  LoginBody,
  ChangePasswordBody,
} from "@workspace/api-zod";
import { generateToken, requireAuth } from "../../middlewares/auth";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, password, timeZone, dailyWorkingHours, preferredWorkingTime } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({
      name,
      email,
      passwordHash,
      timeZone: timeZone ?? "UTC",
      dailyWorkingHours: dailyWorkingHours ?? 8,
      preferredWorkingTime: preferredWorkingTime ?? "morning",
    })
    .returning();

  const token = generateToken(user.id, user.email);

  const safeUser = {
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
  };

  res.status(201).json({ token, user: safeUser });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = generateToken(user.id, user.email);

  const safeUser = {
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
  };

  res.json({ token, user: safeUser });
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ success: true, message: "Logged out" });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

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

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, req.userId));

  res.json({ success: true, message: "Password updated successfully" });
});

export default router;
