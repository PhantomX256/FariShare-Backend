import { groupsTable } from "../database/schemas/groups.ts";
import { groupMembersTable } from "../database/schemas/groupMembers.ts";
import { and, eq, sql } from "drizzle-orm";
import db from "../database/client.ts";
import { usersTable } from "../database/schemas/users.ts";
import { APIError } from "../errors/api.error.ts";
import { STATUS_CODES } from "../lib/constants.ts";
import { expenseMembersTable } from "../database/schemas/expenseMembers.ts";
import type { Balance, Transaction } from "../types/balance.types.ts";
import { Heap } from "@datastructures-js/heap";
import { inArray } from "drizzle-orm/sql/expressions/conditions";

export async function validateAndFetchGroupBalances(
	groupId: string,
	currentUserInternalId: number,
): Promise<{ balances: Balance[]; transactions: Transaction[] }> {
	const groupInternalId = await validateGroupBalanceRequest(
		groupId,
		currentUserInternalId,
	);

	const balances = await fetchGroupBalances(groupInternalId);

	const transactions = calculateTransactions(balances);

	return { balances, transactions };
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
			member_id: groupMembersTable.id,
			balance:
				sql<number>`SUM(${expenseMembersTable.paid_amount}) - SUM(${expenseMembersTable.owed_amount})`.mapWith(
					Number,
				),
		})
		.from(groupMembersTable)
		.leftJoin(
			expenseMembersTable,
			eq(groupMembersTable.id, expenseMembersTable.member_id),
		)
		.where(eq(groupMembersTable.group_id, groupInternalId))
		.groupBy(groupMembersTable.id)
		.orderBy(groupMembersTable.id);
}

function calculateTransactions(balances: Balance[]) {
	// A robust comparator that ensures we get the same result
	const comparator = (a: Balance, b: Balance) => {
		if (a.balance === b.balance) {
			return a.member_id > b.member_id ? -1 : 1;
		}
		return a.balance > b.balance ? 1 : -1;
	};

	const owedHeap = new Heap<Balance>(comparator);
	const debtHeap = new Heap<Balance>(comparator);
	const transactions: Transaction[] = [];

	for (const { member_id, balance } of balances) {
		if (balance > 0) {
			owedHeap.insert({ member_id, balance });
		} else if (balance < 0) {
			debtHeap.insert({ member_id, balance: Math.abs(balance) });
		}
	}

	while (owedHeap.size() > 0 && debtHeap.size() > 0) {
		const maxOwed = owedHeap.extractRoot()!;
		const maxDebt = debtHeap.extractRoot()!;

		const diff = maxOwed.balance - maxDebt.balance;
		const amount = Math.min(maxOwed.balance, maxDebt.balance);

		transactions.push({
			fromMemberId: maxDebt.member_id,
			toMemberId: maxOwed.member_id,
			amount: amount,
		});

		if (diff > 0) {
			owedHeap.insert({ ...maxOwed, balance: diff });
		} else if (diff < 0) {
			debtHeap.insert({ ...maxDebt, balance: Math.abs(diff) });
		}
	}

	return transactions;
}

export async function getBalanceOfMembers(
	memberIds: number[],
	groupInternalId: number,
): Promise<Balance[]> {
	return db!
		.select({
			member_id: groupMembersTable.id,
			balance:
				sql<number>`SUM(${expenseMembersTable.paid_amount}) - SUM(${expenseMembersTable.owed_amount})`.mapWith(
					Number,
				),
		})
		.from(groupMembersTable)
		.leftJoin(
			expenseMembersTable,
			eq(groupMembersTable.id, expenseMembersTable.member_id),
		)
		.where(
			and(
				eq(groupMembersTable.group_id, groupInternalId),
				inArray(expenseMembersTable.member_id, memberIds),
			),
		)
		.groupBy(groupMembersTable.id)
		.orderBy(groupMembersTable.id);
}
