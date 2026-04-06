import { Router } from "express";
import { validateMiddleware } from "../middlewares/validate.middleware.ts";
import { GetExpenseSchema } from "../validators/expense.validator.ts";
import { getExpenses } from "../controllers/expense.controller.ts";

const router = Router();

router.post("/", validateMiddleware(GetExpenseSchema), getExpenses);

export default router;
