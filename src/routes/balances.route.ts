import { Router } from "express";
import { validateMiddleware } from "../middlewares/validate.middleware.ts";
import { GetGroupBalancesSchema } from "../validators/balance.validator.ts";
import { getGroupBalances } from "../controllers/balance.controller.ts";

const router = Router();

router.get("/", validateMiddleware(GetGroupBalancesSchema), getGroupBalances);

export default router;
