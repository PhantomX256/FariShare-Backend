import { DEP_MODE, RESPONSE_STATUS, STATUS_CODES } from "../lib/constants.ts";
import type { NextFunction, Request, Response } from "express";
import { getAllExpenses } from "../services/expense.service.ts";
import logger from "../lib/utils/logger.ts";

export async function getExpenses(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const { groupId } = req.body;

		const expenses = getAllExpenses(groupId, req.user!.internal_id);
		logger.debug(`Fetched all expenses for group: ${groupId}`);

		return res.status(STATUS_CODES.OK).json({
			expenses,
			status: RESPONSE_STATUS.SUCCESS,
			message: "Successfully retrieved all expenses",
		});
	} catch (err) {
		next(err);
	}
}
