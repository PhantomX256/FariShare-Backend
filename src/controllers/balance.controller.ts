import { RESPONSE_STATUS, STATUS_CODES } from "../lib/constants.ts";
import type { NextFunction, Request, Response } from "express";
import { validateAndFetchGroupBalances } from "../services/balance.service.ts";
import logger from "../lib/utils/logger.ts";

export async function getGroupBalances(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const { groupId } = req.query as { groupId: string };

	try {
		const balances = await validateAndFetchGroupBalances(
			groupId,
			req.user!.internal_id,
		);
		logger.debug("Retrieved all balances for group " + groupId);

		return res.status(STATUS_CODES.OK).json({
			status: RESPONSE_STATUS.SUCCESS,
			message: "Retrieved group balances",
			balances,
		});
	} catch (error) {
		next(error);
	}
}
