import { Router } from "express";
import { validateMiddleware } from "../middlewares/validate.middleware.ts";
import {
	AddExpenseSchema,
	GetExpenseSchema,
} from "../validators/expense.validator.ts";
import { addExpense, getExpenses } from "../controllers/expense.controller.ts";

const router = Router();

router.get("/", validateMiddleware(GetExpenseSchema), getExpenses);
router.post("/", validateMiddleware(AddExpenseSchema), addExpense);

export default router;
