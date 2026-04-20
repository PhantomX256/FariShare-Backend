import db from "../database/client.ts";
import { groupsTable } from "../database/schemas/groups.ts";
import { aliasedTable, and, eq, not, sql } from "drizzle-orm";
import { groupMembersTable } from "../database/schemas/groupMembers.ts";
import { APIError } from "../errors/api.error.ts";
import { STATUS_CODES } from "../lib/constants.ts";
import { usersTable } from "../database/schemas/users.ts";
import { inArray } from "drizzle-orm/sql/expressions/conditions";
import type {
	ChangedGroupDataFields,
	ChangedGroupDataFieldsParams,
	ChangeGroupDataParams,
	CreateGroupParams,
	Group,
	GroupData,
	GroupDataDB,
	MemberData,
	ValidateChangeGroupDataParams,
} from "../types/group.types.ts";
import { alias } from "drizzle-orm/pg-core";
import { expensesTable } from "../database/schemas/expenses.ts";
import { expenseMembersTable } from "../database/schemas/expenseMembers.ts";
import { getBalanceOfMembers } from "./balance.service.ts";

export async function getAllGroupsOfUser(
	userInternalId: number,
): Promise<Group[]> {
	return db!
		.select({
			id: groupsTable.id,
			internal_id: groupsTable.internal_id,
			name: groupsTable.name,
			icon: groupsTable.icon,
			color: groupsTable.color,
			created_at: groupsTable.created_at,
			created_by: groupsTable.created_by,
			// Count all members (including guests) in the group
			member_count: sql<number>`(select count(*) ::int
                                       from ${groupMembersTable}
                                       where ${groupMembersTable.group_id} = ${groupsTable.internal_id})`,
			// Get up to 2 avatars of OTHER members (excluding current user)
			avatars: sql<string[]>`(select coalesce(array_agg(avatar_url), '{}')
                                    from (select ${usersTable.avatar_url}
                                          from ${groupMembersTable}
                                                   join ${usersTable} on ${groupMembersTable.user_id} = ${usersTable.internal_id}
                                          where ${groupMembersTable.group_id} = ${groupsTable.internal_id}
                                            and ${groupMembersTable.user_id} != ${userInternalId}
                                            and ${usersTable.avatar_url} is not null
                                              limit 2) as t)`,
		})
		.from(groupMembersTable)
		.innerJoin(
			groupsTable,
			eq(groupsTable.internal_id, groupMembersTable.group_id),
		)
		.where(eq(groupMembersTable.user_id, userInternalId));
}

export async function createAGroup(params: CreateGroupParams) {
	try {
		validateCreateGroupData(params);
	} catch (err) {
		// Throw error to controller to handle
		throw err;
	}

	await createGroupWithData(params);
}

function validateCreateGroupData(params: CreateGroupParams) {
	const { users, guests, currentUserInternalId } = params;
	if (users.length === 1 && guests.length === 0)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"Must have at least one other member other than yourself",
		);

	if (!users.includes(currentUserInternalId))
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"You are not included in the members",
		);
}

async function createGroupWithData(params: CreateGroupParams) {
	const { name, icon, color, users, guests, currentUserInternalId } = params;

	await db!.transaction(async (tx) => {
		const [group] = await tx
			.insert(groupsTable)
			.values({
				name,
				icon,
				color,
				created_by: currentUserInternalId,
			})
			.returning({ internal_id: groupsTable.internal_id });

		const userRows = users.map((userInternalId) => ({
			group_id: group.internal_id,
			user_id: userInternalId,
			is_admin: userInternalId === currentUserInternalId,
		}));

		const guestRows = guests.map((guestName) => ({
			group_id: group.internal_id,
			name: guestName,
			is_admin: false,
		}));

		const memberRows = [...userRows, ...guestRows];

		await tx.insert(groupMembersTable).values(memberRows);
	});
}

export async function getGroupDataByGroupId(
	groupId: string,
): Promise<GroupData> {
	// Perform a single query to get group info joined with members
	const rows = await getGroupMemberDataOfGroup(groupId);

	// If no rows returned, the group doesn't exist
	if (rows.length === 0) {
		throw new APIError(STATUS_CODES.NOT_FOUND, "Group not found");
	}

	// The group data is identical in every row, so we just take the first one
	const group = rows[0].group;

	// Extract the member objects from the rows
	const members = rows.map((r) => r.member);

	return {
		group,
		members,
	};
}

async function getGroupMemberDataOfGroup(
	groupId: string,
): Promise<GroupDataDB[]> {
	return db!
		.select({
			group: groupsTable,
			member: {
				member_id: groupMembersTable.id,
				user_id: usersTable.id,
				internal_id: usersTable.internal_id,
				// Use user's full_name if available (registered user), otherwise fallback to the guest name
				name: sql<string>`coalesce(
                ${usersTable.full_name},
                ${groupMembersTable.name}
                )`,
				email: usersTable.email,
				avatar_url: usersTable.avatar_url,
				joined_at: groupMembersTable.joined_at,
			},
		})
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
				eq(groupMembersTable.is_active, true),
			),
		);
}

export async function changeGroupGuestName(
	memberId: number,
	name: string,
	currentUserInternalId: number,
) {
	const validateAction = await validateChangeGroupGuestNameAction(
		currentUserInternalId,
		memberId,
		name,
	);

	if (!validateAction) return;

	await changeName(memberId, name);
}

async function validateChangeGroupGuestNameAction(
	userInternalId: number,
	memberId: number,
	name: string,
) {
	const targetMember = aliasedTable(groupMembersTable, "target_member");
	const currentUserMember = aliasedTable(
		groupMembersTable,
		"current_user_member",
	);

	const result = await db!
		.select({ id: targetMember.id, name: targetMember.name })
		.from(targetMember)
		.innerJoin(
			currentUserMember,
			eq(targetMember.group_id, currentUserMember.group_id),
		)
		.where(
			and(
				// Find the specific member record by ID
				eq(targetMember.id, memberId),
				// Ensure the current user is also in that group
				eq(currentUserMember.user_id, userInternalId),
			),
		)
		.limit(1);

	if (result.length == 0)
		throw new APIError(
			STATUS_CODES.FORBIDDEN,
			"You are not authorized to make changes",
		);

	return result[0].name !== name;
}

async function changeName(memberId: number, name: string) {
	await db!
		.update(groupMembersTable)
		.set({ name })
		.where(eq(groupMembersTable.id, memberId));
}

export async function changeGroupData(params: ChangeGroupDataParams) {
	try {
		const { groupId } = params;

		const { group, members } = await getGroupDataByGroupId(params.groupId);

		await validateChangeGroupDataAction({ ...params, group, members });

		const changedGroupDataFields = getChangedGroupDataFields({
			...params,
			group,
		});

		await updateGroupData(changedGroupDataFields, groupId);
	} catch (err) {
		throw err;
	}
}

async function validateChangeGroupDataAction(
	params: ValidateChangeGroupDataParams,
) {
	const {
		name,
		group,
		members,
		removeMembers,
		currentUserInternalId,
		newUsers,
		newGuests,
		icon,
		color,
	} = params;

	if (
		!name &&
		!icon &&
		!color &&
		newUsers.length === 0 &&
		newGuests.length === 0 &&
		removeMembers.length === 0
	)
		throw new APIError(STATUS_CODES.BAD_REQUEST, "No fields are new");

	// Check if the user is adding themselves
	if (newUsers.includes(currentUserInternalId))
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"You cannot add yourself to the group",
		);

	// Check if the user can make changes to the group
	if (group.created_by !== currentUserInternalId)
		throw new APIError(
			STATUS_CODES.FORBIDDEN,
			"You are not allowed to edit this group",
		);

	// Check if the members being added are already there
	if (
		members.some((member) =>
			member.internal_id ? newUsers.includes(member.internal_id) : false,
		)
	)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"The member you are trying to add is already there",
		);

	const membersToRemove = members.filter((member) =>
		member.member_id ? removeMembers.includes(member.member_id) : false,
	);

	// Check if the members being removed are even in the group
	if (membersToRemove.length !== removeMembers.length)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"One or more members you are trying to remove are not a member of this group",
		);

	const userIdsToRemove = membersToRemove
		.map((member) => member.internal_id)
		.filter((id) => id !== null);

	// Check if the users being added aren't being removed in the same request
	if (
		newUsers.some((userInternalId) =>
			userIdsToRemove.includes(userInternalId),
		)
	)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"You are adding and removing a user in a single request",
		);

	// Check if the user is removing themselves
	if (userIdsToRemove.includes(currentUserInternalId))
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"You are trying to remove yourself",
		);

	const balances = await getBalanceOfMembers(
		removeMembers,
		group.internal_id,
	);

	if (balances.some(({ balance }) => balance !== 0))
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"The member you are trying to remove has pending balances",
		);
}

async function getChangedGroupDataFields(
	params: ChangedGroupDataFieldsParams,
): Promise<ChangedGroupDataFields> {
	const { name, group, removeMembers, newUsers, newGuests, icon, color } =
		params;

	// Get changed values to insert in group table
	const groupValues: { name?: string; icon?: string; color?: string } = {};
	if (name && name !== group.name) groupValues.name = name;
	if (icon && icon !== group.icon) groupValues.icon = icon;
	if (color && color !== group.color) groupValues.color = color;

	const inactiveUsers = await db!
		.select({
			memberId: groupMembersTable.id,
			userId: groupMembersTable.user_id,
		})
		.from(groupMembersTable)
		.where(
			and(
				eq(groupMembersTable.group_id, group.internal_id),
				eq(groupMembersTable.is_active, false),
				inArray(groupMembersTable.user_id, newUsers),
			),
		);

	const inactiveUsersIds = new Set(inactiveUsers.map((m) => m.userId));

	const activateUserValues = inactiveUsers.map((m) => m.memberId);

	const newFilteredUsers = newUsers.filter((m) => !inactiveUsersIds.has(m));

	// Get member values in inserting format
	const userValues = newFilteredUsers.map((userInternalId) => ({
		group_id: group.internal_id,
		user_id: userInternalId,
		is_admin: false,
	}));

	const guestValues = newGuests.map((name) => ({
		group_id: group.internal_id,
		name: name,
		is_admin: false,
	}));

	const memberValues = [...userValues, ...guestValues];

	return {
		groupValues: Object.keys(groupValues).length > 0 ? groupValues : null,
		memberValues,
		removeValues: removeMembers,
		activateUserValues,
	};
}

async function updateGroupData(
	changedGroupDataFields: ChangedGroupDataFields,
	groupId: string,
) {
	const { groupValues, removeValues, memberValues, activateUserValues } =
		changedGroupDataFields;

	await db!.transaction(async (tx) => {
		if (groupValues)
			await tx
				.update(groupsTable)
				.set(groupValues)
				.where(eq(groupsTable.id, groupId));

		if (memberValues.length > 0)
			await tx.insert(groupMembersTable).values(memberValues);

		if (removeValues.length > 0)
			await tx
				.update(groupMembersTable)
				.set({ is_active: false })
				.where(inArray(groupMembersTable.id, removeValues));

		if (activateUserValues.length > 0)
			await tx
				.update(groupMembersTable)
				.set({ is_active: true })
				.where(inArray(groupMembersTable.id, activateUserValues));
	});
}

export async function validateAndGetMemberData(
	memberId: number,
	currentUserInternalId: number,
) {
	await validateMemberDataRequest(memberId, currentUserInternalId);

	return fetchMemberData(memberId);
}

async function validateMemberDataRequest(
	memberId: number,
	currentUserInternalId: number,
) {
	const targetMember = aliasedTable(groupMembersTable, "target_member");
	const currentUserMember = aliasedTable(
		groupMembersTable,
		"current_user_member",
	);

	const result = await db!
		.select({
			groupInternalId: targetMember.group_id,
		})
		.from(targetMember)
		.innerJoin(
			currentUserMember,
			eq(targetMember.group_id, currentUserMember.group_id),
		)
		.where(
			and(
				eq(targetMember.id, memberId),
				eq(currentUserMember.user_id, currentUserInternalId),
			),
		)
		.limit(1);

	if (result.length === 0) {
		throw new APIError(
			STATUS_CODES.FORBIDDEN,
			"You do not have access to this member's data or the member does not exist.",
		);
	}
}

async function fetchMemberData(memberId: number): Promise<MemberData[]> {
	return db!
		.select({
			expenseId: expenseMembersTable.expense_id,
			memberBalance:
				sql<number>`SUM(${expenseMembersTable.paid_amount}) - SUM(${expenseMembersTable.owed_amount})`.mapWith(
					Number,
				),
		})
		.from(expenseMembersTable)
		.innerJoin(
			expensesTable,
			eq(expensesTable.internal_id, expenseMembersTable.expense_id),
		)
		.where(eq(expenseMembersTable.member_id, memberId))
		.groupBy(expenseMembersTable.expense_id);
}
