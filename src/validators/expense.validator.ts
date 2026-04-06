import { z } from "zod";

export const GetExpenseSchema = z.object({
	body: z.object({
		groupId: z.uuid("Invalid Group ID"),
	}),
});
