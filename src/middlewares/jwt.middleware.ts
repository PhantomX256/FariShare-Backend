import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { APIError } from "../errors/api.error.ts";
import { JWT_SECRET, STATUS_CODES } from "../lib/constants.ts";
import logger from "../lib/utils/logger.ts";

export function verifyToken(
	req: Request,
	res: Response,
	next: NextFunction,
): void {
	// Get jwt from cookie
	const token = req.cookies.token;

	// In case if there is no token
	if (!token) {
		logger.debug("No token was found");
		throw new APIError(STATUS_CODES.UNAUTHORIZED, "No token provided");
	}

	logger.debug("Token extracted successfully");

	try {
		// Verify the jwt
		const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
		logger.debug("Token decoded successfully");

		// Embed the user into the request
		req.user = {
			id: decoded.id,
		};

		next();
	} catch {
		logger.debug("Invalid token detected");
		// Invalid jwt
		throw new APIError(STATUS_CODES.UNAUTHORIZED, "Invalid Token");
	}
}
