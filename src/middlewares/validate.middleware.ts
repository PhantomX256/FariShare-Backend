import type {NextFunction, Request, Response} from "express";
import {ZodError, ZodType} from "zod";
import {STATUS_CODES} from "../lib/constants.ts";
import logger from "../lib/utils/logger.ts";

/**
    Function that sits between the middleware and validates
    the request before passing control over to controller
 */
export function validateMiddleware(schema: ZodType) {
    // Typical middleware function
    return function (req: Request, res: Response, next: NextFunction) {
        try {

            // Parse the request based on schema provided
            schema.parse({
                body: req.body,
                query: req.query,
                params: req.params,
            });

            logger.debug("Schema verified for endpoint: " + req.originalUrl);

            // If all goes well pass control
            next();
        } catch (error) {

            // In case the body is invalid return the error
            // associated with that field from zod
            if (error instanceof ZodError) {
                return res.status(STATUS_CODES.BAD_REQUEST).json({
                    status: "error",
                    message: error.issues.map((e) => {
                        logger.debug(e.message);
                        return e.message;
                    }),
                });
            }
            next(error);
        }
    };
}
