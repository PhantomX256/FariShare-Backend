import db from "../database/client.ts";
import { expensesTable } from "../database/schemas/expenses.ts";
import { groupsTable } from "../database/schemas/groups.ts";
import { aliasedTable, and, desc, eq, sql } from "drizzle-orm";
import { groupMembersTable } from "../database/schemas/groupMembers.ts";
import { APIError } from "../errors/api.error.ts";
import { STATUS_CODES } from "../lib/constants.ts";
import { expenseMembersTable } from "../database/schemas/expenseMembers.ts";
import type {
	AddExpenseRequest,
	ChangedExpenseFields,
	EditExpenseRequest,
	Expense,
	ExpenseDataDB,
	RecentActivity,
} from "../types/expense.types.ts";
import { inArray } from "drizzle-orm/sql/expressions/conditions";
import {
	convertExpenseMembersToMap,
	formatExpenseByIdResult,
	formatExpenseData,
	getExpenseMemberRows,
	getExpenseRowForAddExpense,
	getInsertMemberRows,
	shouldModify,
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
	const groupInternalId = await validateExpenseRequest(
		addExpenseRequest,
		currentUserInternalId,
	);

	await createExpense(
		addExpenseRequest,
		groupInternalId,
		currentUserInternalId,
	);
}

async function validateExpenseRequest(
	expenseRequest: AddExpenseRequest | EditExpenseRequest,
	currentUserInternalId: number,
) {
	const groupInternalId = await validateGroupRequest(
		expenseRequest.groupId,
		currentUserInternalId,
	);

	// If the expense request is a transaction then it is wrong
	if (expenseRequest.isTransaction)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"Adding a transaction in expense url",
		);

	const totalPaidAmount = expenseRequest.paidBy.reduce(
		(sum, p) => sum + p.paidAmount,
		0,
	);
	const totalOwedAmount = expenseRequest.membersInvolved.reduce(
		(sum, m) => sum + m.owedAmount,
		0,
	);

	// If the Total Paid Amount and Total Owed Amount don't match each other
	// and the Expense Amount then it is invalid
	if (
		totalOwedAmount !== totalPaidAmount ||
		totalPaidAmount !== expenseRequest.amount
	)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"The total paid or owed amount don't match the amount",
		);

	// Handle a neat situation where the payer is the only member in the expense
	if (
		expenseRequest.paidBy.length === 1 &&
		expenseRequest.membersInvolved.length === 1 &&
		expenseRequest.paidBy[0].memberId ===
			expenseRequest.membersInvolved[0].memberId
	)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"The payer is the only member involved in the expense",
		);

	const allPayerIds = new Set(expenseRequest.paidBy.map((p) => p.memberId));

	if (allPayerIds.size !== expenseRequest.paidBy.length)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"There are duplicates in Paid By",
		);

	const allInvolvedIds = new Set(
		expenseRequest.membersInvolved.map((m) => m.memberId),
	);

	if (allInvolvedIds.size !== expenseRequest.membersInvolved.length)
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

	if ("expenseId" in expenseRequest) {
		const [expense] = await db!
			.select()
			.from(expensesTable)
			.innerJoin(
				expenseMembersTable,
				eq(expenseMembersTable.expense_id, expensesTable.internal_id),
			)
			.innerJoin(
				groupMembersTable,
				eq(groupMembersTable.id, expenseMembersTable.member_id),
			)
			.where(
				and(
					eq(expensesTable.id, expenseRequest.expenseId),
					eq(groupMembersTable.user_id, currentUserInternalId),
					eq(expensesTable.is_transaction, false),
				),
			)
			.limit(1);

		if (!expense)
			throw new APIError(
				STATUS_CODES.NOT_FOUND,
				"Expense does not exist or you are not a part of this expense",
			);
	}

	return groupInternalId;
}

async function createExpense(
	addExpenseRequest: AddExpenseRequest,
	groupInternalId: number,
	currentUserInternalId: number,
) {
	await db!.transaction(async (tx) => {
		const expenseRow = getExpenseRowForAddExpense(
			addExpenseRequest,
			groupInternalId,
			currentUserInternalId,
		);

		const [{ internal_id: expenseInternalId }] = await tx
			.insert(expensesTable)
			.values(expenseRow)
			.returning({ internal_id: expensesTable.internal_id });

		const expenseMemberRows = getExpenseMemberRows(
			addExpenseRequest,
			expenseInternalId,
		);

		await tx.insert(expenseMembersTable).values(expenseMemberRows);
	});
}

export async function validateAndEditExpense(
	editExpenseRequest: EditExpenseRequest,
	currentUserInternalId: number,
) {
	await validateExpenseRequest(editExpenseRequest, currentUserInternalId);

	const changedExpenseFields =
		await getChangedExpenseFields(editExpenseRequest);

	if (shouldModify(changedExpenseFields))
		await changeExpenseData(changedExpenseFields, currentUserInternalId);
}

async function getChangedExpenseFields(editExpenseRequest: EditExpenseRequest) {
	const { expense, expenseMembers: originalExpenseMembers } =
		await getExpenseById(editExpenseRequest.expenseId);

	const originalBalancesMap = convertExpenseMembersToMap(
		originalExpenseMembers,
	);

	if (!expense.is_modifiable)
		throw new APIError(
			STATUS_CODES.FORBIDDEN,
			"This expense cannot be modified because it contains a member(s) that is no longer a part of this group",
		);

	const newExpenseMembers = getExpenseMemberRows(
		editExpenseRequest,
		expense.internal_id,
	);

	const changedExpenseFields: ChangedExpenseFields = {
		expense: {
			internal_id: expense.internal_id,
		},
		membersToAdd: [],
		membersToEdit: [],
		membersToRemove: [],
	};

	if (expense.title !== editExpenseRequest.title)
		changedExpenseFields.expense = {
			...changedExpenseFields.expense,
			title: editExpenseRequest.title,
		};

	if (expense.amount !== editExpenseRequest.amount)
		changedExpenseFields.expense = {
			...changedExpenseFields.expense,
			amount: editExpenseRequest.amount,
		};

	if (expense.split_mode !== editExpenseRequest.splitMode)
		changedExpenseFields.expense = {
			...changedExpenseFields.expense,
			split_mode: editExpenseRequest.splitMode,
		};

	if (expense.icon !== editExpenseRequest.icon)
		changedExpenseFields.expense = {
			...changedExpenseFields.expense,
			icon: editExpenseRequest.icon,
		};

	for (const expenseMember of newExpenseMembers) {
		const originalExpenseMember = originalBalancesMap.get(
			expenseMember.member_id,
		);

		// Check if the expenseMember was a part of the expense
		// and if so are the values for owed_amount and paid_amount different
		if (originalExpenseMember) {
			if (
				originalExpenseMember.owed_amount !==
					expenseMember.owed_amount ||
				originalExpenseMember.paid_amount !== expenseMember.paid_amount
			)
				changedExpenseFields.membersToEdit.push({
					member_id: expenseMember.member_id,
					paid_amount: expenseMember.paid_amount,
					owed_amount: expenseMember.owed_amount,
				});

			// Remove the member from balances map
			originalBalancesMap.delete(expenseMember.member_id);
		}

		// If the expenseMember wasn't a part of the expense add them
		if (!originalExpenseMember)
			changedExpenseFields.membersToAdd.push({
				expense_id: expense.internal_id,
				member_id: expenseMember.member_id,
				owed_amount: expenseMember.owed_amount,
				paid_amount: expenseMember.paid_amount,
			});
	}

	// After checking all members in balances map if any members remain
	// those members are to be removed from the expense
	if (originalBalancesMap.size > 0) {
		for (const member_id of originalBalancesMap.keys())
			changedExpenseFields.membersToRemove.push(member_id);
	}

	return changedExpenseFields;
}

async function getExpenseById(expenseId: string) {
	const expenseByIdResult = await db!
		.select({
			expense: {
				internal_id: expensesTable.internal_id,
				title: expensesTable.title,
				icon: expensesTable.icon,
				amount: expensesTable.amount,
				split_mode: expensesTable.split_mode,
				created_at: expensesTable.created_at,
			},
			expenseMember: {
				member_id: expenseMembersTable.member_id,
				paid_amount: expenseMembersTable.paid_amount,
				owed_amount: expenseMembersTable.owed_amount,
				is_active: groupMembersTable.is_active,
			},
		})
		.from(expensesTable)
		.innerJoin(
			expenseMembersTable,
			eq(expenseMembersTable.expense_id, expensesTable.internal_id),
		)
		.innerJoin(
			groupMembersTable,
			eq(groupMembersTable.id, expenseMembersTable.member_id),
		)
		.where(eq(expensesTable.id, expenseId));

	return formatExpenseByIdResult(expenseByIdResult);
}

async function changeExpenseData(
	changedExpenseFields: ChangedExpenseFields,
	currentUserInternalId: number,
) {
	await db!.transaction(async (tx) => {
		// If there are any keys other than internal_id then the expense data
		// is new update expense data
		if (
			Object.keys(changedExpenseFields.expense).some(
				(key) => key !== "internal_id",
			)
		) {
			await tx
				.update(expensesTable)
				.set({
					...changedExpenseFields.expense,
					updated_by: currentUserInternalId,
				})
				.where(
					eq(
						expensesTable.internal_id,
						changedExpenseFields.expense.internal_id,
					),
				);
		}

		// If there are members to add, edit or remove then
		if (
			changedExpenseFields.membersToAdd.length > 0 ||
			changedExpenseFields.membersToEdit.length > 0 ||
			changedExpenseFields.membersToRemove.length > 0
		) {
			const insertMemberRows = getInsertMemberRows(changedExpenseFields);

			await tx
				.delete(expenseMembersTable)
				.where(
					eq(
						expenseMembersTable.expense_id,
						changedExpenseFields.expense.internal_id,
					),
				);

			await tx.insert(expenseMembersTable).values(insertMemberRows);
		}
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
				user_id: groupMembersTable.user_id,
				is_active: groupMembersTable.is_active,
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
			STATUS_CODES.NOT_FOUND,
			"The expense does not exist",
		);
}

export async function fetchRecentActivity(
	currentUserInternalId: number,
): Promise<RecentActivity[]> {
	const createdByUsersTable = aliasedTable(usersTable, "created_by_users");
	const modifiedByUsersTable = aliasedTable(usersTable, "modified_by_users");

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

	const userGroupIds = db!
		.select({ group_id: groupMembersTable.group_id })
		.from(groupMembersTable)
		.where(eq(groupMembersTable.user_id, currentUserInternalId));

	return (
		db!
			.with(currentUserStats)
			.select({
				expense: {
					id: expensesTable.id,
					title: expensesTable.title,
					icon: expensesTable.icon,
					created_at: expensesTable.created_at,
					updated_at: expensesTable.updated_at,
				},
				group: {
					name: groupsTable.name,
					color: groupsTable.color,
				},
				created_by: {
					internal_id: expensesTable.created_by,
					name: createdByUsersTable.full_name,
				},
				modified_by: {
					internal_id: expensesTable.updated_by,
					name: modifiedByUsersTable.full_name,
				},
				// Determine the specific user's balance on this individual expense
				user_balance:
					sql<number>`COALESCE(${currentUserStats.paid_amount}, 0) - COALESCE(${currentUserStats.owed_amount}, 0)`.mapWith(
						Number,
					),
			})
			.from(expensesTable)
			.innerJoin(
				groupsTable,
				eq(expensesTable.group_id, groupsTable.internal_id),
			)
			.leftJoin(
				currentUserStats,
				eq(expensesTable.internal_id, currentUserStats.expense_id),
			)
			// Join for created_by
			.leftJoin(
				createdByUsersTable,
				eq(expensesTable.created_by, createdByUsersTable.internal_id),
			)
			// Join for modified_by
			.leftJoin(
				modifiedByUsersTable,
				eq(expensesTable.updated_by, modifiedByUsersTable.internal_id),
			)
			// Only look at expenses belonging to groups the user is a part of
			.where(inArray(expensesTable.group_id, userGroupIds))
			.orderBy(desc(expensesTable.updated_at))
			.limit(10)
	);
}

export async function removeExpense(
	expenseId: string,
	currentUserInternalId: number,
) {
	await validateExpenseAction(expenseId, currentUserInternalId);

	const [deletedExpense] = await db!
		.delete(expensesTable)
		.where(eq(expensesTable.id, expenseId))
		.returning({ internal_id: expensesTable.internal_id });

	if (!deletedExpense)
		throw new APIError(STATUS_CODES.BAD_REQUEST, "Expense does not exist");
}
