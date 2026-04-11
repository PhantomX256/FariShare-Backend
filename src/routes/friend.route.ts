import { Router } from "express";
import {
	getReceivedRequests,
	getSentRequests,
	getFriends,
	respondToRequest,
	sendFriendRequest,
	getFriendData,
} from "../controllers/friend.controller.ts";
import { validateMiddleware } from "../middlewares/validate.middleware.ts";
import {
	GetFriendDataSchema,
	ModifyFriendRequestSchema,
	SendFriendRequestSchema,
} from "../validators/friend.validator.ts";

const router = Router();

router.get("/", getFriends);
router.get("/data", validateMiddleware(GetFriendDataSchema), getFriendData);
router.get("/request/sent", getSentRequests);
router.get("/request/received", getReceivedRequests);
router.put(
	"/request",
	validateMiddleware(ModifyFriendRequestSchema),
	respondToRequest,
);
router.post(
	"/request",
	validateMiddleware(SendFriendRequestSchema),
	sendFriendRequest,
);

export default router;
