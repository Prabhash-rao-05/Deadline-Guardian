import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import categoriesRouter from "./categories";
import tasksRouter from "./tasks";
import subtasksRouter from "./subtasks";
import notificationsRouter from "./notifications";
import dashboardRouter from "./dashboard";
import analyticsRouter from "./analytics";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(categoriesRouter);
router.use(tasksRouter);
router.use(subtasksRouter);
router.use(notificationsRouter);
router.use(dashboardRouter);
router.use(analyticsRouter);
router.use(aiRouter);

export default router;
