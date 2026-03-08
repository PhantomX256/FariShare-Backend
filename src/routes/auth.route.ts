import { Router } from "express";
import { validateMiddleware } from "../middlewares/validate.middleware.ts";
import { GoogleAuthSchema } from "../validators/auth.validator.ts";
import {
	authenticateWithGoogle,
	logout,
} from "../controllers/auth.controller.ts";

const router = Router();

router.post(
	"/google",
	validateMiddleware(GoogleAuthSchema),
	authenticateWithGoogle,
);
router.post("/logout", logout);

export default router;
