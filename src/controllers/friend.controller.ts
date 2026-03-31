import type { NextFunction, Request, Response } from "express";
import {
	getAllReceivedRequests,
	getAllSentRequests,
	getAllFriendsOfUser,
	handleRequestAction,
	sendRequest,
} from "../services/friend.service.ts";
import logger from "../lib/utils/logger.ts";
import { RESPONSE_STATUS, STATUS_CODES } from "../lib/constants.ts";

export async function getFriends(req: Request, res: Response) {
	const friendData = await getAllFriendsOfUser(req.user!.internal_id);
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

		await sendRequest(req.user!.internal_id, friend);
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

export async function getSentRequests(req: Request, res: Response) {
	const sentFriendRequests = await getAllSentRequests(
		req.user!.internal_id,
	);
	logger.debug("Retrieved all requests sent by user: " + req.user!.id);

	return res.status(STATUS_CODES.OK).json({
		status: RESPONSE_STATUS.SUCCESS,
		message: "Retrieved all sent requests",
		sentFriendRequests,
	});
}

export async function getReceivedRequests(req: Request, res: Response) {
	const receivedFriendRequests = await getAllReceivedRequests(
		req.user!.internal_id,
	);
	logger.debug("Retrieved all requests received by user: " + req.user!.id);

	return res.status(STATUS_CODES.OK).json({
		status: RESPONSE_STATUS.SUCCESS,
		message: "Retrieved all sent requests",
		receivedFriendRequests,
	});
}

export async function respondToRequest(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const { senderId, receiverId, accept } = req.body;

		await handleRequestAction({ senderId, receiverId, accept, userInternalId: req.user!.internal_id });

		return res.status(STATUS_CODES.OK).json({
			status: RESPONSE_STATUS.SUCCESS,
			message: `Successfully ${accept ? "accepted" : "removed"} the request`,
		});
	} catch (err) {
		next(err);
	}
}
