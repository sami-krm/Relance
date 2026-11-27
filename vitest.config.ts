import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest(async () => ({
			wrangler: { configPath: "./wrangler.jsonc" },
			// Workers AI est simulé dans les tests : aucune connexion à Cloudflare, en local comme en CI.
			remoteBindings: false,
			miniflare: {
				bindings: {
					TEST_MIGRATIONS: await readD1Migrations("./migrations"),
					// Valeurs fixes : les tests ne lisent pas le .dev.vars du poste.
					BETTER_AUTH_URL: "https://relance.skrim.dev",
					BETTER_AUTH_SECRET: "secret-de-test-uniquement-pour-vitest-0000",
					BREVO_API_KEY: "cle-de-test",
					FRANCE_TRAVAIL_CLIENT_ID: "id-de-test",
					FRANCE_TRAVAIL_CLIENT_SECRET: "secret-de-test",
					LBA_API_TOKEN: "jeton-de-test",
				},
			},
		})),
	],
	test: { setupFiles: ["./tests/apply-migrations.ts"] },
});
