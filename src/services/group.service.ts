import db from "../database/client.ts";
import { groupsTable } from "../database/schemas/groups.ts";
import { usersTable } from "../database/schemas/users.ts";
import { eq } from "drizzle-orm";
import { groupMembersTable } from "../database/schemas/groupMembers.ts";

export async function getAllGroupsOfUser(userId: string) {
	return db!
		.select({
			id: groupsTable.id,
			internal_id: groupsTable.internal_id,
			name: groupsTable.name,
			created_at: groupsTable.created_at,
			created_by: groupsTable.created_by
		})
		.from(groupMembersTable)
		.innerJoin(
			usersTable,
			eq(usersTable.internal_id, groupMembersTable.user_id),
		)
		.innerJoin(
			groupsTable,
			eq(groupsTable.internal_id, groupMembersTable.group_id),
		)
		.where(eq(usersTable.id, userId));
}

