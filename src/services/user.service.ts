import db from "../database/client.ts";
import { usersTable } from "../database/schemas/users.ts";
import { eq } from "drizzle-orm";

/**
 *  Get the user's data from the database
 */
export function getUserDataById(userId: string) {
	return db!.select().from(usersTable).where(eq(usersTable.id, userId));
}
