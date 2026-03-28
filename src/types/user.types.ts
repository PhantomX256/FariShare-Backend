export interface User {
	internal_id: number;
	id: string;
	full_name: string;
	email: string;
	avatar_url: string;
	created_at: Date;
}

export type BasicUserLookup = Pick<User, "id" | "internal_id" | "email">