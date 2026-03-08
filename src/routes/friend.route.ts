import { Router } from "express";
import {
	getReceivedFriendRequest,
	getSentFriendRequest,
	getUserDataOfFriendsOfCurrentUser,
	modifyFriendRequest,
	sendFriendRequest,
} from "../controllers/friend.controller.ts";
import { validateMiddleware } from "../middlewares/validate.middleware.ts";
import {
	ModifyFriendRequestSchema,
	SendFriendRequestSchema,
} from "../validators/friend.validator.ts";

const router = Router();

router.get("/", getUserDataOfFriendsOfCurrentUser);
router.get("/request/sent", getSentFriendRequest);
router.get("/request/received", getReceivedFriendRequest);
router.put(
	"/request",
	validateMiddleware(ModifyFriendRequestSchema),
	modifyFriendRequest,
);
router.post(
	"/request",
	validateMiddleware(SendFriendRequestSchema),
	sendFriendRequest,
);

export default router;
