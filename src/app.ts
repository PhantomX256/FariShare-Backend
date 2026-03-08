import "dotenv/config";
import express from "express";
import { errorHandler } from "./middlewares/errorHandler.middleware.ts";
import { verifyToken } from "./middlewares/jwt.middleware.ts";
import { APIError } from "./errors/api.error.ts";
import cors from "cors";
import { FRONTEND_URL, STATUS_CODES } from "./lib/constants.ts";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.route.ts";
import { logRequest } from "./middlewares/logger.middleware.ts";
import userRoutes from "./routes/user.route.ts";
import friendRoute from "./routes/friend.route.ts";

// Create an Express application
const app = express();

// CORS Policy
app.use(
	cors({
		origin: FRONTEND_URL,
		credentials: true,
		methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
		allowedHeaders: ["Content-Type", "Authorization"],
	}),
);

// Use JSON middleware
app.use(express.json());

// Use Cookie Parser
app.use(cookieParser());

// Middleware to log the requests
app.use("/api/*", logRequest);

// Protect app routes behind jwt middleware
app.use("/api/app/*", verifyToken);

// Mounting all routes
app.use("/api/auth", authRoutes);
app.use("/api/app/user", userRoutes);
app.use("/api/app/friend", friendRoute);

// Handling all 404 errors
app.all("*", (req, res, next) => {
	next(
		new APIError(
			STATUS_CODES.NOT_FOUND,
			`Can't find ${req.originalUrl} on this server!`,
		),
	);
});

// Global error handler
app.use(errorHandler);

export default app;
