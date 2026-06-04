import express from "express";
import {
  getServices,
  createService,
  updateService,
  deleteService,
} from "./service.controller.js";
import { restrictTo } from "../../middleware/rbac.middleware.js";

const serviceRouter = express.Router();

serviceRouter.get("/", getServices);
serviceRouter.post("/", restrictTo("admin"), createService);
serviceRouter.put("/:id", restrictTo("admin"), updateService);
serviceRouter.delete("/:id", restrictTo("admin"), deleteService);

export default serviceRouter;
