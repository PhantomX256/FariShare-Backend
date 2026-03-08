import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { DATABASE_CONNECTION_STRING } from "../lib/constants.ts";
import logger from "../lib/utils/logger.ts";

/**
    Creates a database client and returns the drizzle orm interface
 */
function createDatabaseConnection(connectionString: string | undefined) {
	// If the connection string is not set in .env log it and return null
	if (!connectionString) {
		logger.error(
			"Database connection string not set in environmental variables",
		);
		return null;
	}

	// Create a postgres client using connection string
	const client = postgres(connectionString!, { prepare: false });
	logger.debug("Postgres client created");

	// Create drizzle interface
	const db = drizzle(client);
	logger.debug("Drizzle interface created successfully");
	return db;
}

const db = createDatabaseConnection(DATABASE_CONNECTION_STRING);

export default db;
