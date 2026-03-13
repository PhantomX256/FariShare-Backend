import db from "../database/client.ts";
import { groupsTable } from "../database/schemas/groups.ts";
import { eq } from "drizzle-orm";
import { groupMembersTable } from "../database/schemas/groupMembers.ts";

export async function getAllGroupsOfUser(userInternalId: number) {
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
			groupsTable,
			eq(groupsTable.internal_id, groupMembersTable.group_id),
		)
		.where(eq(groupMembersTable.user_id, userInternalId));
}

