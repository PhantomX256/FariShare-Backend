import {DEP_MODE} from "../constants.ts";

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

/**
 *  A simple logger that has 4 methods:
 *  - `info`: For general information
 *  - `warn`: To warn of something missing or something going wrong
 *  - `error`: Something was critical and the program has stopped or didn't go as expected
 *  - `debug`: Just dev logs if needed
 */
class Logger {
    private static instance: Logger;

    private constructor() {
    }

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    info(msg: string): void {
        this.log("INFO", msg);
    }

    warn(msg: string): void {
        this.log("WARN", msg);
    }

    error(msg: string): void {
        this.log("ERROR", msg);
    }

    debug(msg: any): void {
        DEP_MODE === "DEV" && this.log("DEBUG", msg);
    }

    private getCallerInfo(): { file: string; func: string } {
        // Get error stack trace and split into lines
        const err = new Error();
        const lines = err.stack?.split("\n") ?? [];

        // 4th entry contains the caller info
        const callerLine = lines[4] ?? "";

        // Matches "at functionName (file:line:col)" or "at file:line:col"
        const match = callerLine.match(/at (?:(.+?) \()?(.+?):\d+:\d+\)?$/);

        const func = match?.[1] ?? "<anonymous>";
        const fullPath = match?.[2] ?? "<unknown>";

        // Strip everything before the last slash to get just the filename
        const file = fullPath.split(/[\\/]/).pop() ?? fullPath;

        return {file, func};
    }

    private log(level: LogLevel, message: string | any): void {
        // Generate current timestamp
        const now = new Date();
        const date = now.toLocaleDateString("en-CA"); // YYYY-MM-DD
        const timestamp = now.toLocaleTimeString("en-GB", {hour12: false}); // HH:MM:SS

        // Get the file and function name
        const {file, func} = this.getCallerInfo();

        if (typeof message !== "string") {
            console.log(`[${date}] [${timestamp}] [${level}] [${func}()] [${file}] Error Object: `);
            console.log(message);
        } else {
            // log into the console
            console.log(`[${date}] [${timestamp}] [${level}] [${func}()] [${file}] ${message}`);
        }
    }
}

export default Logger.getInstance();