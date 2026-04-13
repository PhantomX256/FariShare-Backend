export interface Balance {
	member_id: number;
	balance: number;
}

export interface Transaction {
	fromMemberId: number;
	toMemberId: number;
	amount: number;
}
