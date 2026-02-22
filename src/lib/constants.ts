// Declare a port to listen to
export const PORT = process.env["PORT"];

// A list of status codes to use in the application
export const STATUS_CODES = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
}

// Database connection string
export const DATABASE_CONNECTION_STRING = process.env["DATABASE_URL"];

// Deployment mode
export const DEP_MODE = process.env["MODE"] || "PROD";