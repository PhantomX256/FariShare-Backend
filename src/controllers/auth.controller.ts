import {DEP_MODE, RESPONSE_STATUS, STATUS_CODES} from "../lib/constants.ts";
import type { Request, Response } from "express";
import {getJWTFromTokenAndInsertIntoDb} from "../services/auth.service.ts";
import logger from "../lib/utils/logger.ts";

/**
 *  Controller that takes care of oauth tokens and registers a
 *  jwt in the cookie
 */
export async function authenticateWithGoogle(req: Request, res: Response) {
    // Get the Google ID Token from request body
    const { credential } = req.body;

    // Get the JWT from service layer
    const { token, user } = await getJWTFromTokenAndInsertIntoDb(credential);
    logger.debug("JWT created successfully");

    // Embed the JWT into the client's cookies
    res.cookie("token", token, {
        httpOnly: true,
        secure: DEP_MODE === "PROD",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
    })
    logger.debug("Cookie embedded into client");

    return res.status(STATUS_CODES.CREATED).json({
        status: RESPONSE_STATUS.SUCCESS,
        message: "Authenticated successfully",
        user
    });
}

/**
 *  Simple logout function that clears the token from cookies
 */
export function logout(req: Request, res: Response) {
    res.clearCookie("token", {
        httpOnly: true,
        secure: DEP_MODE === "PROD",
        sameSite: "strict",
    });
    logger.debug("Cookie cleared from client");

    return res.status(STATUS_CODES.OK).json({
        status: RESPONSE_STATUS.SUCCESS,
        message: "Logged out successfully"
    });
}