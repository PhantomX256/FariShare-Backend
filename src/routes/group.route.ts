import { Router } from "express";
import {
	createGroup,
	getAllGroupsOfCurrentUser,
} from "../controllers/group.controller.ts";
import { validateMiddleware } from "../middlewares/validate.middleware.ts";
import { CreateGroupSchema } from "../validators/group.validator.ts";

const router = Router();

router.get("/", getAllGroupsOfCurrentUser);
router.post("/", validateMiddleware(CreateGroupSchema), createGroup);

export default router;
