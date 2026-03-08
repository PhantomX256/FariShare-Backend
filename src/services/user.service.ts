import db from "../database/client.ts";
import { usersTable } from "../database/schemas/users.ts";
import { eq, inArray } from "drizzle-orm";

/**
 *  Get the user's data from the database
 */
export async function getUserDataById(userId: string) {
	const result = await db!
		.select()
		.from(usersTable)
		.where(eq(usersTable.id, userId))
		.limit(1);
	return result[0];
}

/**
 *	Get the data of multiple users given an
 *	array of internal ids
 */
export function getUserDataByInternalIds(internalUserIds: number[]) {
	return db!
		.select()
		.from(usersTable)
		.where(inArray(usersTable.internal_id, internalUserIds));
}