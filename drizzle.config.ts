import { defineConfig } from "drizzle-kit";

// Drizzle génère le SQL ; Wrangler l'applique (npm run db:migrate:local / db:migrate:remote).
export default defineConfig({
	dialect: "sqlite",
	schema: "./src/db/schema.ts",
	out: "./migrations",
});
