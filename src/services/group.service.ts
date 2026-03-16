import db from "../database/client.ts";
import { groupsTable } from "../database/schemas/groups.ts";
import { eq, sql } from "drizzle-orm";
import { groupMembersTable } from "../database/schemas/groupMembers.ts";
import { APIError } from "../errors/api.error.ts";
import { STATUS_CODES } from "../lib/constants.ts";
import { usersTable } from "../database/schemas/users.ts";

export async function getAllGroupsOfUser(userInternalId: number) {
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
			member_count: sql<number>`(
				select count(*)::int
				from ${groupMembersTable}
				where ${groupMembersTable.group_id} = ${groupsTable.internal_id}
			)`,
			// Get up to 2 avatars of OTHER members (excluding current user)
			avatars: sql<string[]>`(
				select coalesce(array_agg(avatar_url), '{}')
				from (
					select ${usersTable.avatar_url}
					from ${groupMembersTable}
					join ${usersTable} on ${groupMembersTable.user_id} = ${usersTable.internal_id}
					where ${groupMembersTable.group_id} = ${groupsTable.internal_id}
					and ${groupMembersTable.user_id} != ${userInternalId}
					and ${usersTable.avatar_url} is not null
					limit 2
				) as t
			)`,
		})
		.from(groupMembersTable)
		.innerJoin(
			groupsTable,
			eq(groupsTable.internal_id, groupMembersTable.group_id),
		)
		.where(eq(groupMembersTable.user_id, userInternalId));
}

export async function createAGroup(
	name: string,
	icon: string,
	color: string,
	users: number[],
	guests: string[],
	currentUserId: number,
) {
	if (users.length === 1 && guests.length === 0)
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"Must have at least one other member other than yourself",
		);

	if (!users.includes(currentUserId))
		throw new APIError(
			STATUS_CODES.BAD_REQUEST,
			"You are not included in the members",
		);

	return db!.transaction(async (tx) => {
		const [group] = await tx
			.insert(groupsTable)
			.values({
				name,
				icon,
				color,
				created_by: currentUserId,
			})
			.returning({ internal_id: groupsTable.internal_id });

		const userRows = users.map((userInternalId) => ({
			group_id: group.internal_id,
			user_id: userInternalId,
			is_admin: userInternalId === currentUserId,
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

export async function getGroupDataByGroupId(groupId: string) {
	const [group] = await db!
		.select({
			internal_id: groupsTable.internal_id,
		})
		.from(groupsTable)
		.where(eq(groupsTable.id, groupId))
		.limit(1);

	if (!group) throw new APIError(STATUS_CODES.NOT_FOUND, "Group not found");

	const members = await db!
		.select({
			id: usersTable.id,
			internal_id: usersTable.internal_id,
			// Use user's full_name if available, otherwise fallback to the guest name in group_members
			name: sql<string>`coalesce(${usersTable.full_name}, ${groupMembersTable.name})`,
			email: usersTable.email,
			avatar_url: usersTable.avatar_url,
		})
		.from(groupMembersTable)
		.leftJoin(
			usersTable,
			eq(groupMembersTable.user_id, usersTable.internal_id),
		)
		.where(eq(groupMembersTable.group_id, group.internal_id));

	return {
		members
	}
}