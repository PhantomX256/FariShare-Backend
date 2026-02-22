import app from "./app.ts";
import { PORT } from "./lib/constants.ts";
import logger from "./lib/utils/logger.ts";
import db from "./database/client.ts";
import { sql } from "drizzle-orm";

async function startServer(port: string | undefined) {
    // If in case the database orm interface is null, meaning the
    // DATABASE_CONNECTION in env was not set, don't start
    if (!db) {
        process.exit(1);
    }

    // Check if database can be connected to by running a simple
    // query and if not don't start
    try {
        await db.execute(sql`SELECT 1`);
        logger.info("Database connection established");
    } catch (error) {
        logger.error("Failed to connect to database");
        logger.debug(error);
        process.exit(1);
    }

    // If the PORT environment variable is not set, log a warning and default to 3000
    if (!port) {
        logger.warn("Port not specified in environment variables, defaulting to 3000");
    }

    // Start listening on said port
    app.listen(port || 3000)
    logger.info("Server started on port " + port)
}

startServer(PORT).then();