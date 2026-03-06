import type {Request, Response, NextFunction} from "express";
import logger from "../lib/utils/logger.ts";

export function logRequest(req: Request, res: Response, next: NextFunction) {
    logger.debug("Request received on " + req.originalUrl);
    next();
}