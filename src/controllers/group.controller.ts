import { Request, Response } from "express";
import { getAllGroupsOfUser } from "../services/group.service.ts";
import { RESPONSE_STATUS, STATUS_CODES } from "../lib/constants.ts";

export async function getAllGroupsOfCurrentUser(req: Request, res: Response) {
	const groups = await getAllGroupsOfUser(req.user!.internal_id);

	return res.status(STATUS_CODES.OK).json({
		status: RESPONSE_STATUS.SUCCESS,
		message: "Retrieved all groups",
		groups,
	});
}
