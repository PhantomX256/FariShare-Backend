import { z } from "zod";

export const SendFriendRequestSchema = z.object({
	body: z.object({
		friendId: z.string({
			error: (issue) =>
				issue.input === undefined
					? "No friendID provided"
					: "Invalid friendId",
		}),
	}),
});

export const ModifyFriendRequestSchema = z.object({
	body: z.object({
		senderId: z.number({
			error: (issue) =>
				issue.input === undefined
					? "No senderId provided"
					: "Invalid senderId",
		}),
		receiverId: z.number({
			error: (issue) =>
				issue.input === undefined
					? "No receiverID provided"
					: "Invalid receiverId",
		}),
		accept: z.boolean({
			error: (issue) =>
				issue.input === undefined
					? "No action provided"
					: "Invalid action",
		}),
	}),
});
