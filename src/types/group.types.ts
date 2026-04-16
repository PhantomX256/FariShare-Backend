export interface Group {
	internal_id: number;
	id: string;
	name: string;
	icon: string;
	color: string;
	created_by: number;
	created_at: Date;
}

export interface CreateGroupParams {
	name: string;
	icon: string;
	color: string;
	users: number[];
	guests: string[];
	currentUserInternalId: number;
}

export interface Member {
	member_id: number;
	user_id: string | null;
	internal_id: number | null;
	name: string;
	email: string | null;
	avatar_url: string | null;
	joined_at: Date;
}

export interface GroupData {
	group: Group;
	members: Member[];
}

export interface GroupDataDB {
	group: Group;
	member: Member;
}

export interface ChangeGroupDataParams {
	groupId: string;
	newUsers: number[];
	newGuests: string[];
	removeMembers: number[];
	currentUserInternalId: number;
	name?: string;
	icon?: string;
	color?: string;
}

export interface ValidateChangeGroupDataParams {
	newUsers: number[];
	newGuests: string[];
	removeMembers: number[];
	currentUserInternalId: number;
	name?: string;
	icon?: string;
	color?: string;
	group: Group;
	members: Member[];
}

export interface ChangedGroupDataFieldsParams {
	newUsers: number[];
	newGuests: string[];
	removeMembers: number[];
	name?: string;
	icon?: string;
	color?: string;
	group: Group;
}

export interface ChangedGroupDataFields {
	groupValues: {
		name?: string;
		icon?: string;
		color?: string;
	} | null;
	memberValues: (
		| {
				group_id: number;
				user_id: number;
				is_admin: boolean;
		  }
		| {
				group_id: number;
				name: string;
				is_admin: boolean;
		  }
	)[];
	removeValues: number[];
}

export interface MemberData {
	expenseId: number;
	memberBalance: number;
}
