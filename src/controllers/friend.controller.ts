import type { Request, Response } from "express";
import {
	acceptFriendRequest,
	getAllFriendIdsOfUser,
	getAllFriendRequestsReceivedByUser,
	getAllFriendRequestsSentByUser, removeFriendRequest,
	sendFriendRequestToUser, validateFriendRequestAction,
} from "../services/friend.service.ts";
import logger from "../lib/utils/logger.ts";
import { getUserDataByInternalIds } from "../services/user.service.ts";
import { RESPONSE_STATUS, STATUS_CODES } from "../lib/constants.ts";

export async function getUserDataOfFriendsOfCurrentUser(
	req: Request,
	res: Response,
) {
	const internalFriendIds = await getAllFriendIdsOfUser(req.user!.id);
	logger.debug("Retrieved all the friend IDs of the user: " + req.user!.id);

	const friendData = await getUserDataByInternalIds(internalFriendIds);
	logger.debug("Successfully retrieved the data of all friends");

	return res.status(STATUS_CODES.OK).json({
		status: RESPONSE_STATUS.SUCCESS,
		message: "Retrieved all friends successfully",
		friends: friendData,
	});
}

export async function sendFriendRequest(req: Request, res: Response) {
	const { friendId } = req.body;

	await sendFriendRequestToUser(req.user!.id, friendId);

	return res.status(STATUS_CODES.CREATED).json({
		status: RESPONSE_STATUS.SUCCESS,
		message: "Friend request sent",
	});
}

export async function getSentFriendRequest(req: Request, res: Response) {
	const sentFriendRequests = await getAllFriendRequestsSentByUser(req.user!.id);

	return res.status(STATUS_CODES.OK).json({
		status: RESPONSE_STATUS.SUCCESS,
		message: "Retrieved all sent requests",
		sentFriendRequests
	});
}

export async function getReceivedFriendRequest(req: Request, res: Response) {
	const sentFriendRequests = await getAllFriendRequestsReceivedByUser(
		req.user!.id,
	);

	return res.status(STATUS_CODES.OK).json({
		status: RESPONSE_STATUS.SUCCESS,
		message: "Retrieved all sent requests",
		sentFriendRequests,
	});
}

export async function modifyFriendRequest(req: Request, res: Response) {
	const { senderId, receiverId, accept } = req.body;

	await validateFriendRequestAction(senderId, receiverId, req.user!.id);

	if (accept) {
		await acceptFriendRequest(senderId, receiverId);
	} else {
		await removeFriendRequest(senderId, receiverId);
	}

	return res.status(STATUS_CODES.OK).json({
		status: RESPONSE_STATUS.SUCCESS,
		message: `Successfully ${accept ? "accepted" : "removed"} the request`,
	});
}
