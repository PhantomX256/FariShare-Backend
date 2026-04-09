import { z } from "zod";

const ALLOWED_ICONS = [
	"payments",
	"commute",
	"restaurant",
	"local_bar",
	"shopping_bag",
	"medical_services",
	"sports_esports",
	"confirmation_number",
	"redeem",
];

export const GetExpenseSchema = z.object({
	query: z.object({
		groupId: z.uuid("Invalid Group ID"),
	}),
});

export const AddExpenseSchema = z.object({
	body: z.object({
		addExpenseRequest: z.object({
			groupId: z.uuid("Invalid Group ID"),
			title: z
				.string("Invalid Expense Title")
				.min(1, "Invalid Expense Title"),
			icon: z.enum(ALLOWED_ICONS, "Invalid Expense Icon"),
			amount: z
				.number("Invalid Expense Amount")
				.gt(0, "Expense Amount must be greater than 0"),
			paidBy: z
				.array(
					z.object({
						memberId: z
							.number("Invalid Payer ID")
							.int("Invalid Payer ID")
							.gte(1, "Invalid Payer ID"),
						paidAmount: z
							.number("Invalid Payer Amount")
							.gt(0, "Payer Amount must be greater than 0"),
					}),
				)
				.min(1, "There must be at least one payer"),
			splitMode: z.enum(
				["equally", "parts", "specific"],
				"Invalid Split Mode",
			),
			membersInvolved: z.array(
				z.object({
					memberId: z
						.number("Invalid Involved Member ID")
						.int("Invalid Involved Member ID")
						.gte(1, "Invalid Involved Member ID"),
					owedAmount: z
						.number("Invalid Owed Amount")
						.gt(0, "Owed Amount must be greater than 0"),
				}),
			),
			isTransaction: z.boolean("Invalid flag for transaction"),
		}),
	}),
});

export const GetExpenseDataSchema = z.object({
	params: z.object({
		expenseId: z.uuid("Invalid Expense Id"),
	}),
});
