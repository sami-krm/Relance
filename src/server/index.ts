import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { auth } from "./auth";
import { routesCandidatures } from "./candidatures";
import { routesCompte } from "./compte";
import { routesDocuments } from "./documents";
import { routesProfil } from "./profil";
import {
	aujourdhuiParis,
	doitEnvoyer,
	envoyerRappels,
	routesRappels,
	routesReglages,
} from "./rappels";
import { routesContacts, routesEntreprises, routesOffres } from "./repertoire";

const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.use(secureHeaders());

app.get("/health", async (c) => {
	await drizzle(c.env.DB).run(sql`select 1`);
	return c.json({ status: "ok" });
});

// Limite les demandes de lien par IP et par adresse (abus, boîte de réception d'un tiers, quota Brevo).
// shortcut: 5 par minute seulement ; le quota Brevo (300 par jour) n'est pas protégé contre beaucoup d'IP différentes.
app.post("/auth/sign-in/magic-link", async (c, next) => {
	const { email } = await c.req.raw
		.clone()
		.json<{ email?: unknown }>()
		.catch(() => ({ email: undefined }));
	for (const key of [
		`ip:${c.req.header("cf-connecting-ip")}`,
		`email:${String(email).toLowerCase()}`,
	]) {
		const { success } = await c.env.LIMITE_LIENS.limit({ key });
		if (!success)
			return c.json(
				{ message: "Trop de demandes. Réessayez dans une minute." },
				429,
			);
	}
	await next();
});

app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));

app.route("/profil", routesProfil);
app.route("/documents", routesDocuments);
app.route("/entreprises", routesEntreprises);
app.route("/contacts", routesContacts);
app.route("/offres", routesOffres);
app.route("/candidatures", routesCandidatures);
app.route("/rappels", routesRappels);
app.route("/reglages", routesReglages);
app.route("/compte", routesCompte);

export default {
	fetch: app.fetch,
	// Rappels du matin : envoyés une seule fois, à 7 h heure de Paris.
	async scheduled(controleur, env, ctx) {
		const moment = new Date(controleur.scheduledTime);
		if (doitEnvoyer(moment))
			ctx.waitUntil(envoyerRappels(env, aujourdhuiParis(moment)));
	},
} satisfies ExportedHandler<Env>;
