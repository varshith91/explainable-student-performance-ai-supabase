import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studentPerformanceRouter from "./student-performance";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studentPerformanceRouter);

export default router;
