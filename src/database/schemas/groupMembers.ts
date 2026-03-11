import { integer, pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { groupsTable } from "./groups.ts";
import { usersTable } from "./users.ts";

export const groupMembersTable = pgTable("group_members", {
	id: serial("id").primaryKey(),
	group_id: integer("group_id")
		.notNull()
		.references(() => groupsTable.internal_id),
	user_id: integer("user_id").references(() => usersTable.internal_id),
	name: text("name"),
	is_admin: boolean("is_admin").notNull().default(false),
	joined_at: timestamp("joined_at").defaultNow(),
});