import { z } from "zod";

export const GetGroupBalancesSchema = z.object({
	query: z.object({
		groupId: z.uuid("Invalid Group ID"),
	}),
});
