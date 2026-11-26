import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { sendEmail } from "./email";

export const auth = betterAuth({
	baseURL: env.BETTER_AUTH_URL,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(drizzle(env.DB), { provider: "sqlite", schema }),
	telemetry: { enabled: false },
	// La limitation de débit est faite par Cloudflare dans index.ts (celle de Better Auth vit en mémoire, par isolat).
	rateLimit: { enabled: false },
	advanced: { ipAddress: { disableIpTracking: true } },
	plugins: [
		magicLink({
			expiresIn: 15 * 60,
			storeToken: "hashed",
			// Le lien ouvre une page du front : un antivirus qui visite le lien ne consomme pas le jeton.
			sendMagicLink: ({ email, token }) => {
				const lien = new URL("/connexion/lien", env.BETTER_AUTH_URL);
				lien.searchParams.set("token", token);
				return sendEmail({
					to: email,
					subject: "Votre lien de connexion à Relance",
					text: `Bonjour,\n\nPour vous connecter à Relance, ouvrez ce lien :\n${lien}\n\nIl expire dans 15 minutes et ne sert qu'une fois. Si vous n'avez rien demandé, ignorez cet e-mail.\n\nRelance`,
				});
			},
		}),
	],
});

// Prépare Better Auth au démarrage du Worker : ce temps-là ne compte pas dans la limite de 10 ms de CPU par requête.
auth
	.handler(new Request(new URL("/api/auth/ok", env.BETTER_AUTH_URL)))
	.catch(() => {});
