import { Router } from "express";
import {
	createGroup,
	getAllGroupsOfCurrentUser,
	getGroupData,
} from "../controllers/group.controller.ts";
import { validateMiddleware } from "../middlewares/validate.middleware.ts";
import {
	CreateGroupSchema,
	GetGroupDataSchema,
} from "../validators/group.validator.ts";

const router = Router();

router.get("/", getAllGroupsOfCurrentUser);
router.post("/", validateMiddleware(CreateGroupSchema), createGroup);
router.get("/:groupId", validateMiddleware(GetGroupDataSchema), getGroupData);

export default router;
