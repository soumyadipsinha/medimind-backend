import express from "express";
import {
  handleCreateUser,
  softDeleteUser,
  handleUpdateUser,
  handleGetAllUsers,
  hardDeleteUser,
  handleUpdatePassword,
  handleUpdatePin,
  handleUpdateP12Pin,
  handleVerifyPin,
  handleVerifyP12Pin
} from "./user.controller.js";
import { onlyAdmin } from "../../middlewares/authourization.middleware.js";

const userRouter = express.Router();

userRouter.get("/all", handleGetAllUsers); // /api/user/all

// User personal settings (Self update)
userRouter.post("/change-password", handleUpdatePassword);
userRouter.post("/change-pin", handleUpdatePin);
userRouter.post("/change-p12-pin", handleUpdateP12Pin);
userRouter.post("/verify-pin", handleVerifyPin);
userRouter.post("/verify-p12-pin", handleVerifyP12Pin);

// userRouter.use(onlyAdmin)
userRouter.post("/create-user", handleCreateUser);
userRouter.put("/update-user/:id", handleUpdateUser);
userRouter.patch("/soft-delete/:id", softDeleteUser);
userRouter.delete("/:id", hardDeleteUser)

export default userRouter;
