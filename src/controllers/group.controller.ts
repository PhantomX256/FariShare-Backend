import type { NextFunction, Request, Response } from "express";
import {
	changeGroupData,
	changeGroupGuestName,
	createAGroup,
	getAllGroupsOfUser,
	getGroupDataByGroupId,
} from "../services/group.service.ts";
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
		await createAGroup({ ...createGroupForm, currentUserInternalId: req.user!.internal_id });
		logger.debug("Successfully created a group: " + createGroupForm.name);

		return res.status(STATUS_CODES.CREATED).json({
			status: RESPONSE_STATUS.SUCCESS,
			message: "Group created successfully",
		});
	} catch (err) {
		next(err);
	}

}

export async function getGroupData(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const groupId = req.params.groupId as string;

	try {
		const { group, members } = await getGroupDataByGroupId(groupId!);
		logger.debug("Successfully retrieved data for group: " + groupId);

		return res.status(STATUS_CODES.OK).json({
			status: RESPONSE_STATUS.SUCCESS,
			message: "Retrieved group data",
			group,
			members,
		});
	} catch (err) {
		next(err);
	}
}

export async function editGuestName(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const { memberId, name } = req.body;

		await changeGroupGuestName(memberId, name, req.user!.internal_id!);
		logger.debug("Changed the name of member: " + memberId);

		return res.status(STATUS_CODES.OK).json({
			status: RESPONSE_STATUS.SUCCESS,
			message: "Successfully changed guest's name",
		});
	} catch (err) {
		next(err);
	}
}

export async function editGroup(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const { editGroupRequest } = req.body;
		await changeGroupData({ ...editGroupRequest, currentUserInternalId: req.user!.internal_id });
		logger.debug("Successfully edited group: " + editGroupRequest.groupId);

		return res.status(STATUS_CODES.OK).json({
			status: RESPONSE_STATUS.SUCCESS,
			message: "Successfully edited the group",
		});
	} catch (err) {
		next(err);
	}
}
