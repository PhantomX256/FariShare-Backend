import { integer, pgTable, primaryKey } from "drizzle-orm/pg-core";
import { expensesTable } from "./expenses.ts";
import { groupMembersTable } from "./groupMembers.ts";

export const expenseMembersTable = pgTable(
	"expense_members",
	{
		expense_id: integer("expense_id")
			.notNull()
			.references(() => expensesTable.internal_id),
		member_id: integer("member_id")
			.notNull()
			.references(() => groupMembersTable.id),
		paid_amount: integer("paid_amount").default(0).notNull(),
		owed_amount: integer("owed_amount").notNull(),
	},
	(table) => [primaryKey({ columns: [table.expense_id, table.member_id] })],
);
