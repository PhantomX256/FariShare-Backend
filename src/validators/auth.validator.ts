import {z} from "zod";

export const GoogleAuthSchema = z.object({
    body: z.object({
        credential: z.string({
            error: issue => issue.input === undefined
                ? "Google ID Token is required"
                : "Invalid Google Token ID"
        }),
    })
});