export interface Expense {
	internal_id: number;
	id: string;
	title: string;
	icon: string;
	amount: number;
	split_mode: string | null;
	is_transaction: boolean;
	created_at: Date;
	user_balance: number;
	paid_by: number[];
}

export interface AddExpenseRequest {
	groupId: string;
	title: string;
	icon: string;
	amount: number;
	paidBy: Payer[];
	splitMode: SplitMode;
	membersInvolved: InvolvedMember[];
	isTransaction: boolean;
}

export interface Payer {
	memberId: number;
	paidAmount: number;
}

export interface InvolvedMember {
	memberId: number;
	owedAmount: number;
}

export type SplitMode = "equally" | "parts" | "specific";

export interface ExpenseRow {
	group_id: number;
	title: string;
	icon: string;
	amount: number;
	split_mode: SplitMode;
	is_transaction: boolean;
}

export interface ExpenseMemberRows {
	expense_id: number;
	member_id: number;
	paid_amount: number;
	owed_amount: number;
}

export interface ExpenseDataDB {
	group: { id: string; name: string };
	expense: {
		title: string;
		icon: string;
		amount: number;
		split_mode: string | null;
		created_at: Date;
	};
	expenseMember: {
		member_id: number;
		name: string;
		avatar_url: string | null;
		paid_amount: number;
		owed_amount: number;
	};
}

export interface ExpenseData {
	group: { id: string; name: string; color: string };
	expense: {
		title: string;
		icon: string;
		amount: number;
		split_mode: string | null;
		created_at: Date;
	};
	expenseMembers: {
		member_id: number;
		paid_amount: number;
		owed_amount: number;
		parts: number;
	}[];
}
