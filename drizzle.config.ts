import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/database/schemas/*",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});
