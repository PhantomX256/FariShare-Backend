import db from "../database/client.ts";
import { expensesTable } from "../database/schemas/expenses.ts";
import { groupsTable } from "../database/schemas/groups.ts";
import { and, eq, sql } from "drizzle-orm";
import { groupMembersTable } from "../database/schemas/groupMembers.ts";
import { APIError } from "../errors/api.error.ts";
import { STATUS_CODES } from "../lib/constants.ts";
import { expenseMembersTable } from "../database/schemas/expenseMembers.ts";
import type {
	AddExpenseRequest,
	Expense,
	ExpenseDataDB,
} from "../types/expense.types.ts";
import { inArray } from "drizzle-orm/sql/expressions/conditions";
import {
	formatExpenseData,
	getExpenseMemberRowsForAddExpense,
	getExpenseRowForAddExpense,
} from "../lib/utils/expense.utils.ts";
import { usersTable } from "../database/schemas/users.ts";

export async function getAllExpenses(
	groupId: string,
	currentUserInternalId: number,
): Promise<Expense[]> {
	const groupInternalId = await validateGroupRequest(
		groupId,
		currentUserInternalId,
	);

	return getExpenses(groupInternalId, currentUserInternalId);
}

async function getExpenses(
	groupInternalId: number,
	currentUserInternalId: number,
): Promise<Expense[]> {
	const currentUserStats = db!.$with("current_user_stats").as(
		db!
			.select({
				expense_id: expenseMembersTable.expense_id,
				owed_amount: expenseMembersTable.owed_amount,
				paid_amount: expenseMembersTable.paid_amount,
			})
			.from(expenseMembersTable)
			.innerJoin(
				groupMembersTable,
				eq(groupMembersTable.id, expenseMembersTable.member_id),
			)
			.where(eq(groupMembersTable.user_id, currentUserInternalId)),
	);

	return db!
		.with(currentUserStats)
		.select({
			internal_id: expensesTable.internal_id,
			id: expensesTable.id,
			title: expensesTable.title,
			icon: expensesTable.icon,
			amount: expensesTable.amount,
			split_mode: expensesTable.split_mode,
			is_transaction: expensesTable.is_transaction,
			created_at: expensesTable.created_at,
			// Fetch the users balance
			user_balance:
				sql<number>`COALESCE(${currentUserStats.paid_amount}, 0) - COALESCE(${currentUserStats.owed_amount}, 0)`.mapWith(
					Number,
				),
			// Fetch an array of member IDs who paid > 0
			paid_by: sql<
				number[]
			>`(SELECT COALESCE(array_agg(member_id), ARRAY[]::integer[])
													   FROM expense_members
													   WHERE expense_id = expenses.internal_id
														 AND paid_amount > 0)`,
		})
		.from(expensesTable)
		.leftJoin(
			currentUserStats,
			eq(expensesTable.internal_id, currentUserStats.expense_id),
		)
		.where(eq(expensesTable.group_id, groupInternalId));
}

async function validateGroupRequest(
	groupId: string,
	currentUserInternalId: number,
) {
	const [user] = await db!
		.select({
			internal_id: groupMembersTable.user_id,
			group_id: groupsTable.internal_id,
		})
		.from(groupMembersTable)
		.innerJoin(
			groupsTable,
			eq(groupsTable.internal_id, groupMembersTable.group_id),
		)
		.where(
			and(
				eq(groupMembersTable.user_id, currentUserInternalId),
				eq(groupsTable.id, groupId),
			),
		)
		.limit(1);

	if (!user)
		throw new APIError(
			STATUS_CODES.FORBIDDEN,
			"Group doesn't exist or you are not a member of that group",
		);

	return user.group_id;
}

export async function validateAndAddExpense(
	addExpenseRequest: AddExpenseRequest,
	currentUserInternalId: number,
) {
	const groupInternalId = await validateAddExpenseRequest(
		addExpenseRequest,
		currentUserInternalId,
	);

	await createExpense(addExpenseRequest, groupInternalId);
}

async function validateAddExpenseRequest(
	addExpenseRequest: AddExpenseRequest,
	currentUserInternalId: number,
) {
	const groupInternalId = await validateGroupRequest(
		addExpenseRequest.groupId,
		currentUserInternalId,
	);

	// If the expense request is a transaction then it is wrong
	if (addExpenseRequest.isTransaction)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"Adding a transaction in expense url",
		);

	const totalPaidAmount = addExpenseRequest.paidBy.reduce(
		(sum, p) => sum + p.paidAmount,
		0,
	);
	const totalOwedAmount = addExpenseRequest.membersInvolved.reduce(
		(sum, m) => sum + m.owedAmount,
		0,
	);

	// If the Total Paid Amount and Total Owed Amount don't match each other
	// and the Expense Amount then it is invalid
	if (
		totalOwedAmount !== totalPaidAmount ||
		totalPaidAmount !== addExpenseRequest.amount
	)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"The total paid or owed amount don't match the amount",
		);

	// Handle a neat situation where the payer is the only member in the expense
	if (
		addExpenseRequest.paidBy.length === 1 &&
		addExpenseRequest.membersInvolved.length === 1 &&
		addExpenseRequest.paidBy[0].memberId ===
			addExpenseRequest.membersInvolved[0].memberId
	)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"The payer is the only member involved in the expense",
		);

	const allPayerIds = new Set(
		addExpenseRequest.paidBy.map((p) => p.memberId),
	);

	if (allPayerIds.size !== addExpenseRequest.paidBy.length)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"There are duplicates in Paid By",
		);

	const allInvolvedIds = new Set(
		addExpenseRequest.membersInvolved.map((m) => m.memberId),
	);

	if (allInvolvedIds.size !== addExpenseRequest.membersInvolved.length)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"There are duplicates in Members Involved",
		);

	const allUniqueMemberIds = new Set([...allPayerIds, ...allInvolvedIds]);

	const users = await db!
		.select({ member_id: groupMembersTable.id })
		.from(groupMembersTable)
		.where(
			and(
				inArray(groupMembersTable.id, Array.from(allUniqueMemberIds)),
				eq(groupMembersTable.group_id, groupInternalId),
			),
		);

	if (users.length !== allUniqueMemberIds.size)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"One or more of the members you have selected don't exist",
		);

	return groupInternalId;
}

async function createExpense(
	addExpenseRequest: AddExpenseRequest,
	groupInternalId: number,
) {
	await db!.transaction(async (tx) => {
		const expenseRow = getExpenseRowForAddExpense(
			addExpenseRequest,
			groupInternalId,
		);

		const [{ internal_id: expenseInternalId }] = await tx
			.insert(expensesTable)
			.values(expenseRow)
			.returning({ internal_id: expensesTable.internal_id });

		const expenseMemberRows = getExpenseMemberRowsForAddExpense(
			addExpenseRequest,
			expenseInternalId,
		);

		await tx.insert(expenseMembersTable).values(expenseMemberRows);
	});
}

export async function validateAndGetExpenseData(
	expenseId: string,
	currentUserInternalId: number,
) {
	await validateExpenseAction(expenseId, currentUserInternalId);

	const result = await getExpenseData(expenseId);

	return formatExpenseData(result);
}

async function getExpenseData(expenseId: string): Promise<ExpenseDataDB[]> {
	return db!
		.select({
			group: {
				id: groupsTable.id,
				name: groupsTable.name,
				color: groupsTable.color,
			},
			expense: {
				title: expensesTable.title,
				icon: expensesTable.icon,
				amount: expensesTable.amount,
				split_mode: expensesTable.split_mode,
				created_at: expensesTable.created_at,
			},
			expenseMember: {
				member_id: expenseMembersTable.member_id,
				name: sql<string>`coalesce(
					${usersTable.full_name},
					${groupMembersTable.name}
                )`,
				avatar_url: usersTable.avatar_url,
				paid_amount: expenseMembersTable.paid_amount,
				owed_amount: expenseMembersTable.owed_amount,
			},
		})
		.from(expensesTable)
		.innerJoin(
			expenseMembersTable,
			eq(expensesTable.internal_id, expenseMembersTable.expense_id),
		)
		.innerJoin(
			groupsTable,
			eq(expensesTable.group_id, groupsTable.internal_id),
		)
		.innerJoin(
			groupMembersTable,
			eq(groupMembersTable.id, expenseMembersTable.member_id),
		)
		.leftJoin(
			usersTable,
			eq(usersTable.internal_id, groupMembersTable.user_id),
		)
		.where(eq(expensesTable.id, expenseId));
}

async function validateExpenseAction(
	expenseId: string,
	currentUserInternalId: number,
) {
	const [user] = await db!
		.select({ internal_id: groupMembersTable.user_id })
		.from(expensesTable)
		.innerJoin(
			groupMembersTable,
			eq(groupMembersTable.group_id, expensesTable.group_id),
		)
		.where(
			and(
				eq(expensesTable.id, expenseId),
				eq(groupMembersTable.user_id, currentUserInternalId),
			),
		);

	if (!user)
		throw new APIError(
			STATUS_CODES.UNAUTHORIZED,
			"You are not authorized to view this expense",
		);
}
