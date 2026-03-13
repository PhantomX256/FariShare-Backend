import { RESPONSE_STATUS, STATUS_CODES } from "../lib/constants.ts";
import type { Request, Response } from "express";
import logger from "../lib/utils/logger.ts";
import { getUserDataById } from "../services/user.service.ts";

/**
 *  Endpoint to fetch user data from the database
 */
export async function getUserDataFromIdController(req: Request, res: Response) {
	// Get user data from userId extracted from jwt
	const userData = await getUserDataById(req.user!.internal_id);
	logger.debug("User data fetched for User: " + req.user!.internal_id);

	return res.status(STATUS_CODES.OK).json({
		status: RESPONSE_STATUS.SUCCESS,
		message: "Data retrieved successfully",
		user: userData,
	});
}
