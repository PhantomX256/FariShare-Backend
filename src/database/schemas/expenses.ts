import {
	integer,
	pgTable,
	serial,
	text,
	uuid,
	decimal,
	timestamp,
} from "drizzle-orm/pg-core";
import { groupsTable } from "./groups.ts";

export const expensesTable = pgTable("expenses", {
	internal_id: serial("internal_id").primaryKey(),
	id: uuid("id").defaultRandom().notNull().unique(),
	group_id: integer("group_id")
		.notNull()
		.references(() => groupsTable.internal_id),
	title: text("title").notNull(),
	amount: decimal("amount", { precision: 14, scale: 3 }).notNull(),
	created_at: timestamp("created_at").defaultNow().notNull(),
});
