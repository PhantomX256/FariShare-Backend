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

export interface AddExpenseRequest extends ExpenseRequest {
	groupId: string;
}

export interface EditExpenseRequest extends ExpenseRequest {
	expenseId: string;
	groupId: string;
}

interface ExpenseRequest {
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
	created_by: number;
	updated_by: number;
}

export interface ExpenseMemberRows {
	expense_id: number;
	member_id: number;
	paid_amount: number;
	owed_amount: number;
}

export interface ExpenseDataDB {
	group: {
		id: string;
		name: string;
		color: string;
	};
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
		user_id: number | null;
		is_active: boolean;
	};
}

export interface ExpenseData {
	group: {
		id: string;
		name: string;
		color: string;
	};
	expense: {
		title: string;
		icon: string;
		amount: number;
		split_mode: string | null;
		created_at: Date;
		is_modifiable: boolean;
	};
	expenseMembers: {
		member_id: number;
		paid_amount: number;
		owed_amount: number;
		parts: number;
		user_id: number | null;
		is_active: boolean;
	}[];
}

export interface ExpenseByIdResult {
	expense: {
		internal_id: number;
		title: string;
		icon: string;
		amount: number;
		split_mode: string | null;
		created_at: Date;
	};
	expenseMember: {
		member_id: number;
		paid_amount: number;
		owed_amount: number;
		is_active: boolean;
	};
}

export interface FormattedExpenseByIdResult {
	expense: {
		internal_id: number;
		title: string;
		icon: string;
		amount: number;
		split_mode: string | null;
		created_at: Date;
		is_modifiable: boolean;
	};
	expenseMembers: {
		parts: number;
		member_id: number;
		paid_amount: number;
		owed_amount: number;
		is_active: boolean;
	}[];
}

export interface ChangedExpenseFields {
	expense: {
		internal_id: number;
		title?: string;
		icon?: string;
		amount?: number;
		split_mode?: string;
	};
	membersToAdd: ExpenseMemberRows[];
	membersToRemove: number[];
	membersToEdit: Omit<ExpenseMemberRows, "expense_id">[];
}

export interface RecentActivity {
	expense: {
		id: string;
		title: string;
		icon: string;
		created_at: Date;
		updated_at: Date;
	};
	group: {
		name: string;
		color: string;
	};
	created_by: {
		internal_id: number;
		name: string | null;
	};
	modified_by: {
		internal_id: number;
		name: string | null;
	};
	user_balance: number;
}
