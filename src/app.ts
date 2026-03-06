import "dotenv/config";
import express from "express";
import {errorHandler} from "./middlewares/errorHandler.middleware.ts";
import {verifyToken} from "./middlewares/jwt.middleware.ts";
import {APIError} from "./errors/api.error.ts";
import cors from "cors";
import {FRONTEND_URL, STATUS_CODES} from "./lib/constants.ts";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.route.ts";
import {logRequest} from "./middlewares/logger.middleware.ts";

// Create an Express application
const app = express();

// CORS Policy
app.use(cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
    allowedHeaders: ["Content-Type", "Authorization"],
}))

// Use JSON middleware
app.use(express.json());

// Use Cookie Parser
app.use(cookieParser());

// Middleware to log the requests
app.use("/api/*", logRequest);

// Mounting all routes
app.use("/api/auth", authRoutes);

// Protect app routes behind jwt middleware
app.use("/api/app/*", verifyToken);

// Handling all 404 errors
app.all("*", (req, res, next) => {
    next(new APIError(STATUS_CODES.NOT_FOUND, `Can't find ${req.originalUrl} on this server!`));
});

// Global error handler
app.use(errorHandler);

export default app;