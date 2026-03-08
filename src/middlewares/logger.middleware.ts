import type { NextFunction, Request, Response } from "express";
import logger from "../lib/utils/logger.ts";

export function logRequest(req: Request, res: Response, next: NextFunction) {
	logger.debug("Request received on " + req.originalUrl);
	next();
}
