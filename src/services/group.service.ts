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
	currentUserInternalId: number,
) {
	try {
		validateCreateGroupData(users, guests, currentUserInternalId);
	} catch (err) {
		// Throw error to controller to handle
		throw err;
	}

	await createGroupWithData(
		name,
		icon,
		color,
		users,
		guests,
		currentUserInternalId,
	);
}

function validateCreateGroupData(
	users: number[],
	guests: string[],
	currentUserInternalId: number,
) {
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

async function createGroupWithData(
	name: string,
	icon: string,
	color: string,
	users: number[],
	guests: string[],
	currentUserInternalId: number,
) {
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

export async function getGroupDataByGroupId(groupId: string) {
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

async function getGroupMemberDataOfGroup(groupId: string) {
	return db!
		.select({
			group: groupsTable,
			member: {
				member_id: groupMembersTable.id,
				user_id: usersTable.id,
				internal_id: usersTable.internal_id,
				// Use user's full_name if available (registered user), otherwise fallback to the guest name
				name: sql<string>`coalesce(${usersTable.full_name}, ${groupMembersTable.name})`,
				email: usersTable.email,
				avatar_url: usersTable.avatar_url,
			},
		})
		.from(groupsTable)
		.leftJoin(
			groupMembersTable,
			eq(groupsTable.internal_id, groupMembersTable.group_id),
		)
		.leftJoin(
			usersTable,
			eq(groupMembersTable.user_id, usersTable.internal_id),
		)
		.where(eq(groupsTable.id, groupId));
}
