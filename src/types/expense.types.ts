export interface Expense {
	internal_id: number;
	id: string;
	title: string;
	icon: string;
	amount: string;
	split_mode: string | null;
	is_transaction: boolean;
	created_at: Date;
	user_owed_amount: string | null;
	user_paid_amount: string | null;
	paid_by_member_ids: number[];
}
