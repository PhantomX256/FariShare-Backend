import type {
	AddExpenseRequest,
	ExpenseData,
	ExpenseDataDB,
	ExpenseMemberRows,
	ExpenseRow,
} from "../../types/expense.types.ts";

export function getExpenseRowForAddExpense(
	addExpenseRequest: AddExpenseRequest,
	groupInternalId: number,
) {
	const expenseRow: ExpenseRow = {
		group_id: groupInternalId,
		title: addExpenseRequest.title,
		icon: addExpenseRequest.icon,
		amount: addExpenseRequest.amount,
		split_mode: addExpenseRequest.splitMode,
		is_transaction: addExpenseRequest.isTransaction,
	};

	return expenseRow;
}

export function getExpenseMemberRowsForAddExpense(
	addExpenseRequest: AddExpenseRequest,
	expenseInternalId: number,
) {
	const balancesMap = new Map<
		number,
		{ paid_amount: number; owed_amount: number }
	>();

	for (const p of addExpenseRequest.paidBy) {
		balancesMap.set(p.memberId, {
			paid_amount: p.paidAmount,
			owed_amount: 0,
		});
	}

	for (const m of addExpenseRequest.membersInvolved) {
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
	const { group, expense } = expenseDataDb[0];

	const isPartsMode = expense.split_mode === "parts";

	const expenseMembers = expenseDataDb.map(({ expenseMember }) => {
		let parts = 1;
		if (isPartsMode)
			parts = Math.round(expense.amount / expenseMember.owed_amount);

		return {
			...expenseMember,
			parts,
		};
	});

	return { group, expense, expenseMembers };
}
