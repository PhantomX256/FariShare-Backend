import type {
	AddExpenseRequest,
	ChangedExpenseFields,
	EditExpenseRequest,
	ExpenseByIdResult,
	ExpenseData,
	ExpenseDataDB,
	ExpenseMemberRows,
	ExpenseRow,
	FormattedExpenseByIdResult,
} from "../../types/expense.types.ts";

export function getExpenseRowForAddExpense(
	addExpenseRequest: AddExpenseRequest,
	groupInternalId: number,
	currentUserInternalId: number,
) {
	const expenseRow: ExpenseRow = {
		group_id: groupInternalId,
		title: addExpenseRequest.title,
		icon: addExpenseRequest.icon,
		amount: addExpenseRequest.amount,
		split_mode: addExpenseRequest.splitMode,
		is_transaction: addExpenseRequest.isTransaction,
		created_by: currentUserInternalId,
		updated_by: currentUserInternalId,
	};

	return expenseRow;
}

export function getExpenseMemberRows(
	expenseRequest: AddExpenseRequest | EditExpenseRequest,
	expenseInternalId: number,
) {
	const balancesMap = new Map<
		number,
		{ paid_amount: number; owed_amount: number }
	>();

	for (const p of expenseRequest.paidBy) {
		balancesMap.set(p.memberId, {
			paid_amount: p.paidAmount,
			owed_amount: 0,
		});
	}

	for (const m of expenseRequest.membersInvolved) {
		const existing = balancesMap.get(m.memberId);
		if (existing) {
			existing.owed_amount = m.owedAmount;
		} else {
			balancesMap.set(m.memberId, {
				paid_amount: 0,
				owed_amount: m.owedAmount,
			});
		}
	}

	const expenseMemberRows: ExpenseMemberRows[] = Array.from(
		balancesMap.entries(),
	).map(([memberId, balances]) => ({
		expense_id: expenseInternalId,
		member_id: memberId,
		paid_amount: balances.paid_amount,
		owed_amount: balances.owed_amount,
	}));

	return expenseMemberRows;
}

export function formatExpenseData(expenseDataDb: ExpenseDataDB[]): ExpenseData {
	const { group } = expenseDataDb[0];

	const { expense, expenseMembers } =
		calculatePartsAndModifiability(expenseDataDb);

	return { group, expense, expenseMembers };
}

export function formatExpenseByIdResult(
	expenseById: ExpenseByIdResult[],
): FormattedExpenseByIdResult {
	const { expense, expenseMembers } =
		calculatePartsAndModifiability(expenseById);

	return { expense, expenseMembers: expenseMembers };
}

function calculatePartsAndModifiability<
	T extends ExpenseDataDB | ExpenseByIdResult,
>(expenseData: T[]) {
	const expense = expenseData[0].expense as T["expense"];

	let is_modifiable = true;

	const isPartsMode = expense.split_mode === "parts";

	let minAmount = expenseData[0].expenseMember.owed_amount;

	if (isPartsMode && expenseData.length > 0) {
		// An easy optimization technique, we use the smallest
		// owed amount as the base parts and then go from there
		for (const db of expenseData) {
			const amt = db.expenseMember.owed_amount;
			if (amt < minAmount) {
				minAmount = amt;
			}
		}
	}

	const expenseMembers = expenseData.map(({ expenseMember }) => {
		if (!expenseMember.is_active) is_modifiable = false;

		const parts = isPartsMode
			? Math.round(expenseMember.owed_amount / minAmount)
			: 1;

		return {
			...expenseMember,
			parts,
		} as T["expenseMember"] & { parts: number };
	});

	return { expense: { is_modifiable, ...expense }, expenseMembers };
}

export function convertExpenseMembersToMap(
	expenseMembers: ExpenseByIdResult["expenseMember"][],
) {
	const balancesMap = new Map<
		number,
		{ paid_amount: number; owed_amount: number }
	>();

	for (const { member_id, paid_amount, owed_amount } of expenseMembers)
		balancesMap.set(member_id, { paid_amount, owed_amount });

	return balancesMap;
}

export function shouldModify(changedExpenseFields: ChangedExpenseFields) {
	return (
		Object.keys(changedExpenseFields).length > 1 ||
		changedExpenseFields.membersToAdd.length > 0 ||
		changedExpenseFields.membersToRemove.length > 0 ||
		changedExpenseFields.membersToEdit.length > 0
	);
}

export function getInsertMemberRows(
	changedExpenseFields: ChangedExpenseFields,
) {
	const expense_id = changedExpenseFields.expense.internal_id;

	return [
		...changedExpenseFields.membersToAdd,
		...changedExpenseFields.membersToEdit.map((m) => ({
			...m,
			expense_id,
		})),
	];
}
