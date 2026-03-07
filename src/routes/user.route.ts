import {Router} from "express";
import {getUserDataFromIdController} from "../controllers/user.controller.ts";

const router = Router();

router.post("/me", getUserDataFromIdController);

export default router;