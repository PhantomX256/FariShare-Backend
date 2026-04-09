import { RESPONSE_STATUS, STATUS_CODES } from "../lib/constants.ts";
import type { NextFunction, Request, Response } from "express";
import {
	getAllExpenses,
	validateAndAddExpense,
	validateAndGetExpenseData,
} from "../services/expense.service.ts";
import logger from "../lib/utils/logger.ts";

export async function getExpenses(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const { groupId } = req.query as { groupId: string };

		const expenses = await getAllExpenses(groupId, req.user!.internal_id);
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

export async function addExpense(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const { addExpenseRequest } = req.body;

	try {
		await validateAndAddExpense(addExpenseRequest, req.user!.internal_id);
		logger.debug(
			`Successfully added an expense to group: ${addExpenseRequest.groupId}`,
		);

		return res.status(STATUS_CODES.CREATED).json({
			status: RESPONSE_STATUS.SUCCESS,
			message: "Successfully created an expense",
		});
	} catch (err) {
		next(err);
	}
}

export async function getExpenseData(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const expenseId = req.params.expenseId as string;

	try {
		const expenseData = await validateAndGetExpenseData(
			expenseId,
			req.user!.internal_id,
		);
		logger.debug(
			`Successfully retrieved expense data for expense: ${expenseId}`,
		);

		return res.status(STATUS_CODES.OK).json({
			expenseData,
			status: RESPONSE_STATUS.SUCCESS,
			message: "Successfully retrieved expense data",
		});
	} catch (err) {
		next(err);
	}
}
