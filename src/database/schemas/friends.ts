import { integer, pgTable, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users.ts";

export const friendsTable = pgTable(
	"friends",
	{
		user_id: integer("user_id")
			.notNull()
			.references(() => usersTable.internal_id),
		friend_id: integer("friend_id")
			.notNull()
			.references(() => usersTable.internal_id),
		created_at: timestamp("created_at").defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.user_id, table.friend_id] })],
);
