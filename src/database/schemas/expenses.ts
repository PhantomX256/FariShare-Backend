import {
	integer,
	pgTable,
	serial,
	text,
	uuid,
	timestamp,
	boolean,
} from "drizzle-orm/pg-core";
import { groupsTable } from "./groups.ts";
import { usersTable } from "./users.ts";

export const expensesTable = pgTable("expenses", {
	internal_id: serial("internal_id").primaryKey(),
	id: uuid("id").defaultRandom().notNull().unique(),
	group_id: integer("group_id")
		.notNull()
		.references(() => groupsTable.internal_id),
	title: text("title").notNull(),
	icon: text("icon").notNull(),
	amount: integer("amount").notNull(),
	split_mode: text("split_mode"),
	is_transaction: boolean("is_transaction").default(false).notNull(),
	created_by: integer("created_by")
		.notNull()
		.references(() => usersTable.internal_id),

	updated_by: integer("updated_by")
		.notNull()
		.references(() => usersTable.internal_id),
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});
