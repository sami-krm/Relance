import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Chaque test part d'une base locale à jour : une migration cassée fait échouer la suite.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
