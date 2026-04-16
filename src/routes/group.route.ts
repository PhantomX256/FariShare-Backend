import { Router } from "express";
import {
	createGroup,
	editGroup,
	editGuestName,
	getAllGroupsOfCurrentUser,
	getGroupData,
	getMemberData,
} from "../controllers/group.controller.ts";
import { validateMiddleware } from "../middlewares/validate.middleware.ts";
import {
	CreateGroupSchema,
	EditGroupSchema,
	EditGuestNameSchema,
	GetGroupDataSchema,
	GetMemberDataSchema,
} from "../validators/group.validator.ts";

const router = Router();

router.get("/", getAllGroupsOfCurrentUser);
router.post("/", validateMiddleware(CreateGroupSchema), createGroup);
router.put("/", validateMiddleware(EditGroupSchema), editGroup);
router.get("/:groupId", validateMiddleware(GetGroupDataSchema), getGroupData);
router.put("/member", validateMiddleware(EditGuestNameSchema), editGuestName);
router.get(
	"/member/:memberId",
	validateMiddleware(GetMemberDataSchema),
	getMemberData,
);

export default router;
