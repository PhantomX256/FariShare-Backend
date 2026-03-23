import { Router } from "express";
import {
	createGroup,
	editGuestName,
	getAllGroupsOfCurrentUser,
	getGroupData,
} from "../controllers/group.controller.ts";
import { validateMiddleware } from "../middlewares/validate.middleware.ts";
import {
	CreateGroupSchema,
	EditGuestNameSchema,
	GetGroupDataSchema,
} from "../validators/group.validator.ts";

const router = Router();

router.get("/", getAllGroupsOfCurrentUser);
router.post("/", validateMiddleware(CreateGroupSchema), createGroup);
router.get("/:groupId", validateMiddleware(GetGroupDataSchema), getGroupData);
router.put("/member", validateMiddleware(EditGuestNameSchema), editGuestName);

export default router;
