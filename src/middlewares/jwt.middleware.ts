import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import {APIError} from "../errors/api.error.ts";
import {JWT_SECRET, STATUS_CODES} from "../lib/constants.ts";

export function verifyToken(req: Request, res: Response, next: NextFunction): void {
    // Get jwt from cookie
    const token = req.cookies.token;

    // In case if there is no token
    if (!token) {
        throw new APIError(STATUS_CODES.UNAUTHORIZED, "No token provided");
    }

    try {
        // Verify the jwt
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string};

        // Embed the user into the request
        req.user = {
            id: decoded.id
        };

        next();
    } catch {

        // Invalid jwt
        throw new APIError(STATUS_CODES.UNAUTHORIZED, "Invalid Token");
    }
}
