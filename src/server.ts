import app from "./app.ts";
import { PORT } from "./lib/constants.ts";
import logger from "./lib/utils/logger.ts";

function startServer(port: string | undefined) : void {
    // If the PORT environment variable is not set, log a warning and default to 3000
    if (!port) {
        logger.warn("PORT not specified in environment variables, defaulting to 3000");
    }
    app.listen(port || 3000)
    logger.info("Server started on port " + port)
}

startServer(PORT);