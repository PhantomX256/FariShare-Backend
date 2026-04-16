import { Router } from "express";
import { validateMiddleware } from "../middlewares/validate.middleware.ts";
import {
	AddExpenseSchema,
	GetExpenseDataSchema,
	GetExpenseSchema,
} from "../validators/expense.validator.ts";
import {
	addExpense,
	deleteExpense,
	getExpenseData,
	getExpenses,
	getRecentActivity,
} from "../controllers/expense.controller.ts";

const router = Router();

router.get("/", validateMiddleware(GetExpenseSchema), getExpenses);
router.post("/", validateMiddleware(AddExpenseSchema), addExpense);
router.get("/recent", getRecentActivity);
router.get(
	"/:expenseId",
	validateMiddleware(GetExpenseDataSchema),
	getExpenseData,
);
router.delete(
	"/:expenseId",
	validateMiddleware(GetExpenseDataSchema),
	deleteExpense,
);

export default router;
