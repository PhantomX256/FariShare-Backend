import { pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
	internal_id: serial("internal_id").primaryKey(),
	id: uuid("id").defaultRandom().notNull().unique(),
	full_name: text("full_name"),
	email: text("email").notNull().unique(),
	avatar_url: text("avatar_url"),
	created_at: timestamp("created_at").defaultNow(),
});
