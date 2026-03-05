import {DEP_MODE, STATUS_CODES} from "../lib/constants.ts";
import type { Request, Response } from "express";
import {getJWTFromTokenAndInsertIntoDb} from "../services/auth.service.ts";

export async function authenticateWithGoogle(req: Request, res: Response) {
    const { credential } = req.body;

    const token = await getJWTFromTokenAndInsertIntoDb(credential);

    res.cookie("token", token, {
        httpOnly: true,
        secure: DEP_MODE === "PROD",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    return res.status(STATUS_CODES.CREATED).json({ message: "Authenticated successfully" });
}