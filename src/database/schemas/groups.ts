import {
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users.ts";

export const groupsTable = pgTable("groups", {
	internal_id: serial("internal_id").primaryKey(),
	id: uuid("id").defaultRandom().notNull().unique(),
	name: text("name").notNull(),
	icon: text("icon").notNull(),
	color: text("color").notNull(),
	created_by: integer("created_by")
		.notNull()
		.references(() => usersTable.internal_id),
	created_at: timestamp("created_at").defaultNow(),
});
