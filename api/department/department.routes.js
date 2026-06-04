import express from "express";
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "./department.controller.js";
import { restrictTo } from "../../middleware/rbac.middleware.js";

const departmentRouter = express.Router();

departmentRouter.get("/", getDepartments);
departmentRouter.post("/", restrictTo("admin"), createDepartment);
departmentRouter.put("/:id", restrictTo("admin"), updateDepartment);
departmentRouter.delete("/:id", restrictTo("admin"), deleteDepartment);

export default departmentRouter;
