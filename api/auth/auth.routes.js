import express from "express";
import { registerPatient, login, logout, getMe, registerAdmin } from "./auth.controller.js";
import { verify } from "../../middleware/authentication.middleware.js";

const authRouter = express.Router();

authRouter.post("/register", registerPatient);
authRouter.post("/register-admin", registerAdmin);
authRouter.post("/login", login);
authRouter.post("/logout", logout);
authRouter.get("/me", verify, getMe);

export default authRouter;
