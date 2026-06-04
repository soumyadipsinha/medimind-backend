import express from "express";
import { getDashboardAnalytics } from "./analytics.controller.js";
import { restrictTo } from "../../middleware/rbac.middleware.js";

const analyticsRouter = express.Router();

analyticsRouter.get("/dashboard", restrictTo("admin"), getDashboardAnalytics);

export default analyticsRouter;
