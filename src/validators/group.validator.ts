import { number, string, z } from "zod";

const ALLOWED_ICONS = [
	"home",
	"flight",
	"restaurant",
	"shopping_cart",
	"payments",
	"movie",
	"fitness_center",
	"directions_car",
] as const;

export const CreateGroupSchema = z.object({
	body: z.object({
		createGroupForm: z.object({
			name: z.string("Invalid name").min(1),
			icon: z.enum(ALLOWED_ICONS),
			color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color"),
			users: z
				.array(z.number())
				.min(1, "At least one user is required")
				.refine(
					(arr) => new Set(arr).size === arr.length,
					"Users must be unique",
				),
			guests: z.array(string().min(1)),
		}),
	}),
});