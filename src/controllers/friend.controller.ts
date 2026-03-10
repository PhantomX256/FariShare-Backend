import type { NextFunction, Request, Response } from "express";
import {
	acceptFriendRequest,
	getAllFriendRequestsReceivedByUser,
	getAllFriendRequestsSentByUser,
	getAllFriendsOfUser,
	removeFriendRequest,
	sendFriendRequestToUser,
	validateFriendRequestAction,
} from "../services/friend.service.ts";
import logger from "../lib/utils/logger.ts";
import { RESPONSE_STATUS, STATUS_CODES } from "../lib/constants.ts";

export async function getUserDataOfFriendsOfCurrentUser(
	req: Request,
	res: Response,
) {
	const friendData = await getAllFriendsOfUser(req.user!.id);
	logger.debug("Successfully retrieved the data of all friends");

	return res.status(STATUS_CODES.OK).json({
		status: RESPONSE_STATUS.SUCCESS,
		message: "Retrieved all friends successfully",
		friends: friendData,
	});
}

export async function sendFriendRequest(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const { friend } = req.body;

		await sendFriendRequestToUser(req.user!.id, friend);
		logger.debug(
			`Successfully sent a request by: ${req.user!.id} to ${friend}`,
		);

		return res.status(STATUS_CODES.CREATED).json({
			status: RESPONSE_STATUS.SUCCESS,
			message: "Friend request sent",
		});
	} catch (err) {
		next(err);
	}
}

export async function getSentFriendRequest(req: Request, res: Response) {
	const sentFriendRequests = await getAllFriendRequestsSentByUser(
		req.user!.id,
	);
	logger.debug("Retrieved all requests sent by user: " + req.user!.id);

	return res.status(STATUS_CODES.OK).json({
		status: RESPONSE_STATUS.SUCCESS,
		message: "Retrieved all sent requests",
		sentFriendRequests,
	});
}

export async function getReceivedFriendRequest(req: Request, res: Response) {
	const receivedFriendRequests = await getAllFriendRequestsReceivedByUser(
		req.user!.id,
	);
	logger.debug("Retrieved all requests received by user: " + req.user!.id);

	return res.status(STATUS_CODES.OK).json({
		status: RESPONSE_STATUS.SUCCESS,
		message: "Retrieved all sent requests",
		receivedFriendRequests,
	});
}

export async function modifyFriendRequest(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const { senderId, receiverId, accept } = req.body;

		await validateFriendRequestAction(
			senderId,
			receiverId,
			req.user!.id,
			accept,
		);
		logger.debug(
			"Validated friend request action by user: " + req.user!.id,
		);

		if (accept) {
			await acceptFriendRequest(senderId, receiverId);
			logger.debug("Successfully accepted friend request");
		} else {
			await removeFriendRequest(senderId, receiverId);
			logger.debug("Successfully removed friend request");
		}

		return res.status(STATUS_CODES.OK).json({
			status: RESPONSE_STATUS.SUCCESS,
			message: `Successfully ${accept ? "accepted" : "removed"} the request`,
		});
	} catch (err) {
		next(err);
	}
}
