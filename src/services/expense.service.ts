import db from "../database/client.ts";
import { expensesTable } from "../database/schemas/expenses.ts";
import { groupsTable } from "../database/schemas/groups.ts";
import { and, eq, sql } from "drizzle-orm";
import { groupMembersTable } from "../database/schemas/groupMembers.ts";
import { APIError } from "../errors/api.error.ts";
import { STATUS_CODES } from "../lib/constants.ts";
import { expenseMembersTable } from "../database/schemas/expenseMembers.ts";
import type { Expense } from "../types/expense.types.ts";

export async function getAllExpenses(
	groupId: string,
	currentUserInternalId: number,
): Promise<Expense[]> {
	await validateGroupRequest(groupId, currentUserInternalId);

	return db!
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
			user_owed_amount: expenseMembersTable.owed_amount,
			user_paid_amount: expenseMembersTable.paid_amount,
			// Fetch an array of member IDs who paid > 0
			paid_by_member_ids: sql<
				number[]
			>`(SELECT COALESCE(array_agg(member_id), ARRAY[]::integer[])
												   FROM expense_members
												   WHERE expense_id = expenses.internal_id
													 AND paid_amount > 0)`,
		})
		.from(expensesTable)
		.innerJoin(
			groupsTable,
			eq(groupsTable.internal_id, expensesTable.group_id),
		)
		.innerJoin(
			groupMembersTable,
			and(
				eq(groupMembersTable.group_id, groupsTable.internal_id),
				eq(groupMembersTable.user_id, currentUserInternalId),
			),
		)
		.leftJoin(
			expenseMembersTable,
			and(
				eq(expenseMembersTable.expense_id, expensesTable.internal_id),
				eq(expenseMembersTable.member_id, groupMembersTable.id),
			),
		)
		.where(eq(groupsTable.id, groupId));
}

export async function validateGroupRequest(
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
}
