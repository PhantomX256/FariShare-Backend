declare namespace Express {
	interface Request {
		user?: {
			internal_id: number;
			id: string;
		};
	}
}
