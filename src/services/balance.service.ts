import { groupsTable } from "../database/schemas/groups.ts";
import { groupMembersTable } from "../database/schemas/groupMembers.ts";
import { and, eq, sql } from "drizzle-orm";
import db from "../database/client.ts";
import { usersTable } from "../database/schemas/users.ts";
import { APIError } from "../errors/api.error.ts";
import { STATUS_CODES } from "../lib/constants.ts";
import { expenseMembersTable } from "../database/schemas/expenseMembers.ts";
import type { Balance } from "../types/balance.types.ts";

export async function validateAndFetchGroupBalances(
	groupId: string,
	currentUserInternalId: number,
): Promise<Balance[]> {
	const groupInternalId = await validateGroupBalanceRequest(
		groupId,
		currentUserInternalId,
	);

	return fetchGroupBalances(groupInternalId);
}

async function validateGroupBalanceRequest(
	groupId: string,
	currentUserInternalId: number,
) {
	const [{ groupInternalId }] = await db!
		.select({ groupInternalId: groupsTable.internal_id })
		.from(groupsTable)
		.innerJoin(
			groupMembersTable,
			eq(groupsTable.internal_id, groupMembersTable.group_id),
		)
		.leftJoin(
			usersTable,
			eq(groupMembersTable.user_id, usersTable.internal_id),
		)
		.where(
			and(
				eq(groupsTable.id, groupId),
				eq(usersTable.internal_id, currentUserInternalId),
			),
		);

	if (!groupInternalId)
		throw new APIError(STATUS_CODES.UNAUTHORIZED, "Invalid Group");

	return groupInternalId;
}

async function fetchGroupBalances(groupInternalId: number) {
	return db!
		.select({
			member_id: expenseMembersTable.member_id,
			balance:
				sql<number>`SUM(${expenseMembersTable.paid_amount}) - SUM(${expenseMembersTable.owed_amount})`.mapWith(
					Number,
				),
		})
		.from(expenseMembersTable)
		.innerJoin(
			groupMembersTable,
			eq(groupMembersTable.id, expenseMembersTable.member_id),
		)
		.where(eq(groupMembersTable.group_id, groupInternalId))
		.groupBy(expenseMembersTable.member_id);
}
