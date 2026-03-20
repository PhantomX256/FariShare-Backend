import db from "../database/client.ts";
import { usersTable } from "../database/schemas/users.ts";
import { eq } from "drizzle-orm";

/**
 *  Get the user's data from the database
 */
export async function getUserDataById(userInternalId: number) {
	const [user] = await db!
		.select()
		.from(usersTable)
		.where(eq(usersTable.internal_id, userInternalId))
		.limit(1);
	return user;
}

export async function getUserDataByEmailOrId(emailOrId: string) {
	const isEmail = emailOrId.includes("@");

	const [user] = await db!
		.select({
			id: usersTable.id,
			email: usersTable.email,
			internal_id: usersTable.internal_id,
		})
		.from(usersTable)
		.where(
			isEmail
				? eq(usersTable.email, emailOrId)
				: eq(usersTable.id, emailOrId),
		)
		.limit(1);

	return user;
}
