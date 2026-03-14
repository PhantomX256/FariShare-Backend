import type { NextFunction, Request, Response } from "express";
import { createAGroup, getAllGroupsOfUser } from "../services/group.service.ts";
import { RESPONSE_STATUS, STATUS_CODES } from "../lib/constants.ts";
import logger from "../lib/utils/logger.ts";

export async function getAllGroupsOfCurrentUser(req: Request, res: Response) {
	const groups = await getAllGroupsOfUser(req.user!.internal_id);
	logger.debug("Retrieved all groups for user: " + req.user!.internal_id);

	return res.status(STATUS_CODES.OK).json({
		status: RESPONSE_STATUS.SUCCESS,
		message: "Retrieved all groups",
		groups,
	});
}

export async function createGroup(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const { createGroupForm } = req.body;

	try {
		await createAGroup(
			createGroupForm.name,
			createGroupForm.icon,
			createGroupForm.color,
			createGroupForm.users,
			createGroupForm.guests,
			req.user!.internal_id,
		);
		logger.debug("Successfully created a group: " + createGroupForm.name);
	} catch (err) {
		next(err);
	}

	return res.status(STATUS_CODES.CREATED).json({
		status: RESPONSE_STATUS.SUCCESS,
		message: "Group created successfully",
	});
}
