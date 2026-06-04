import express from "express";
import {
    getAllCommentss,
    createComment
} from "./comments.controller.js";

const commentsRouter = express.Router();

// Define your routes here
commentsRouter.get("/", getAllCommentss);
commentsRouter.post("/", createComment);


export default commentsRouter;
