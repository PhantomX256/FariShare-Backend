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
export const DEP_MODE: "DEV" | "PROD" = process.env["MODE"] === "DEV" ? "DEV" : "PROD";

// Google Client ID
export const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"];

// JWT Secret
export const JWT_SECRET = process.env["JWT_SECRET"]!;

// Frontend Hosted URL
export const FRONTEND_URL = process.env["FRONTEND_URL"]!;