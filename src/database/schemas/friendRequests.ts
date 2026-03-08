import { integer, pgTable, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users.ts";

export const friendRequestsTable = pgTable(
	"friend_requests",
	{
		sender_id: integer("sender_id")
			.notNull()
			.references(() => usersTable.internal_id),
		receiver_id: integer("receiver_id")
			.notNull()
			.references(() => usersTable.internal_id),
		created_at: timestamp("created_at").defaultNow(),
	},
	(table) => [primaryKey({ columns: [table.sender_id, table.receiver_id] })],
);
