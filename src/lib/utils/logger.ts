type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

function getCallerInfo(): { file: string; func: string } {
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

    return { file, func };
}

function log(level: LogLevel, message: string): void {
    const now = new Date();

    const date = now.toLocaleDateString("en-CA"); // YYYY-MM-DD
    const timestamp = now.toLocaleTimeString("en-GB", { hour12: false }); // HH:MM:SS

    const { file, func } = getCallerInfo();

    console.log(`[${date}] [${timestamp}] [${level}] [${func}()] [${file}] [${message}]`);
}

const logger = {
    info: (msg: string) => log("INFO", msg),
    warn: (msg: string) => log("WARN", msg),
    error: (msg: string) => log("ERROR", msg),
    debug: (msg: string) => log("DEBUG", msg),
};

export default logger;