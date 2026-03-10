import db from "../database/client.ts";
import { usersTable } from "../database/schemas/users.ts";
import { eq } from "drizzle-orm";

/**
 *  Get the user's data from the database
 */
export async function getUserDataById(userId: string) {
	const [user] = await db!
		.select()
		.from(usersTable)
		.where(eq(usersTable.id, userId))
		.limit(1);
	return user;
}