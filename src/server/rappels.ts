import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { type Context, Hono } from "hono";
import {
	candidature,
	entreprise,
	preference,
	rappel,
	user,
} from "../db/schema";
import {
	ajouterJours,
	modificationRappelSchema,
	type Reglages,
	rappelSchema,
	reglagesParDefaut,
	reglagesSchema,
	typesRappel,
} from "../shared/schemas";
import { sendEmail } from "./email";
import { bd, type Contexte, exigerSession } from "./session";

type C = Context<Contexte>;

export const aujourdhuiParis = (maintenant = new Date()) =>
	new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(
		maintenant,
	);

export async function lireReglages(
	env: Env,
	userId: string,
): Promise<Reglages> {
	const r = await bd(env)
		.select({
			delaiRelance: preference.delaiRelance,
			delaiSansReponse: preference.delaiSansReponse,
			emailsRappel: preference.emailsRappel,
		})
		.from(preference)
		.where(eq(preference.userId, userId))
		.get();
	return r ?? reglagesParDefaut;
}

// Au passage à « Envoyée », Relance propose une relance à date d'envoi + délai (modifiable ou supprimable ensuite).
export async function relanceAuto(
	env: Env,
	userId: string,
	candidatureId: string,
	poste: string,
	dateEnvoi: string,
) {
	const db = bd(env);
	const dejaPrevue = await db
		.select({ id: rappel.id })
		.from(rappel)
		.where(
			and(
				eq(rappel.candidatureId, candidatureId),
				eq(rappel.type, "relance"),
				eq(rappel.statut, "a_faire"),
			),
		)
		.get();
	if (dejaPrevue) return [];
	const { delaiRelance } = await lireReglages(env, userId);
	// Renvoyée dans un tableau : une requête Drizzle s'exécuterait dès l'await (elle est « thenable »).
	return [
		db.insert(rappel).values({
			id: crypto.randomUUID(),
			userId,
			candidatureId,
			type: "relance",
			titre: `Relancer « ${poste} »`,
			date: ajouterJours(dateEnvoi, delaiRelance),
		}),
	];
}

const duCompte = (c: C) =>
	and(eq(rappel.id, c.req.param("id") ?? ""), eq(rappel.userId, c.var.userId));

export const routesRappels = new Hono<Contexte>()
	.use(exigerSession)
	.get("/", async (c) =>
		c.json(
			await bd(c.env)
				.select()
				.from(rappel)
				.where(eq(rappel.userId, c.var.userId))
				.orderBy(asc(rappel.date)),
		),
	)
	.post("/", async (c) => {
		const r = rappelSchema.safeParse(await c.req.json().catch(() => null));
		if (!r.success)
			return c.json({ message: "Type, titre ou date invalide." }, 400);
		const { candidatureId, ...reste } = r.data;
		if (candidatureId) {
			const cand = await bd(c.env)
				.select({ id: candidature.id })
				.from(candidature)
				.where(
					and(
						eq(candidature.id, candidatureId),
						eq(candidature.userId, c.var.userId),
					),
				)
				.get();
			if (!cand) return c.json({ message: "Candidature introuvable." }, 400);
		}
		const id = crypto.randomUUID();
		await bd(c.env)
			.insert(rappel)
			.values({
				...reste,
				id,
				userId: c.var.userId,
				candidatureId: candidatureId || null,
			});
		return c.json({ id }, 201);
	})
	.patch("/:id", async (c) => {
		const r = modificationRappelSchema.safeParse(
			await c.req.json().catch(() => null),
		);
		if (!r.success) return c.json({ message: "Modification invalide." }, 400);
		const lignes = await bd(c.env)
			.update(rappel)
			// Une nouvelle date (report) donnera lieu à un nouvel e-mail.
			.set({
				...r.data,
				...(r.data.date && { emailEnvoye: false }),
				updatedAt: new Date(),
			})
			.where(duCompte(c))
			.returning({ id: rappel.id });
		if (!lignes.length) return c.json({ message: "Rappel introuvable." }, 404);
		return c.body(null, 204);
	})
	.delete("/:id", async (c) => {
		const lignes = await bd(c.env)
			.delete(rappel)
			.where(duCompte(c))
			.returning({ id: rappel.id });
		if (!lignes.length) return c.json({ message: "Rappel introuvable." }, 404);
		return c.body(null, 204);
	});

export const routesReglages = new Hono<Contexte>()
	.use(exigerSession)
	.get("/", async (c) => c.json(await lireReglages(c.env, c.var.userId)))
	.put("/", async (c) => {
		const r = reglagesSchema.safeParse(await c.req.json().catch(() => null));
		if (!r.success) return c.json({ message: "Réglages invalides." }, 400);
		await bd(c.env)
			.insert(preference)
			.values({ userId: c.var.userId, ...r.data })
			.onConflictDoUpdate({
				target: preference.userId,
				set: { ...r.data, updatedAt: new Date() },
			});
		return c.json(r.data);
	});

// Les crons sont en UTC : on en déclare deux (5 h et 6 h) et on n'envoie qu'à 7 h à Paris, été comme hiver.
export const doitEnvoyer = (maintenant: Date) =>
	Number(
		new Intl.DateTimeFormat("en-GB", {
			timeZone: "Europe/Paris",
			hour: "2-digit",
			hourCycle: "h23",
		}).format(maintenant),
	) === 7;

const dateFr = (iso: string) => iso.split("-").reverse().join("/");

// Un e-mail par compte avec ses rappels du jour et en retard pas encore envoyés.
export async function envoyerRappels(env: Env, aujourdhui: string) {
	const db = bd(env);
	const dus = await db
		.select({
			id: rappel.id,
			userId: rappel.userId,
			type: rappel.type,
			titre: rappel.titre,
			date: rappel.date,
			email: user.email,
			emailsRappel: preference.emailsRappel,
			entreprise: entreprise.nom,
		})
		.from(rappel)
		.innerJoin(user, eq(user.id, rappel.userId))
		.leftJoin(preference, eq(preference.userId, rappel.userId))
		.leftJoin(candidature, eq(candidature.id, rappel.candidatureId))
		.leftJoin(entreprise, eq(entreprise.id, candidature.entrepriseId))
		.where(
			and(
				eq(rappel.statut, "a_faire"),
				eq(rappel.emailEnvoye, false),
				lte(rappel.date, aujourdhui),
			),
		)
		.orderBy(asc(rappel.date));

	const parCompte = Map.groupBy(
		dus.filter((r) => r.emailsRappel !== false),
		(r) => r.email,
	);
	for (const [email, rappels] of parCompte) {
		const lignes = rappels.map(
			(r) =>
				`- ${typesRappel[r.type as keyof typeof typesRappel] ?? r.type} : ${r.titre}${r.entreprise ? ` (${r.entreprise})` : ""}${r.date < aujourdhui ? `, prévu le ${dateFr(r.date)}` : ""}`,
		);
		try {
			await sendEmail({
				to: email,
				subject:
					rappels.length > 1
						? `Relance : ${rappels.length} rappels aujourd'hui`
						: "Relance : un rappel aujourd'hui",
				text: `Bonjour,\n\nVos rappels sur Relance :\n${lignes.join("\n")}\n\nPour les voir : ${env.BETTER_AUTH_URL}/rappels\nPour ne plus recevoir ces e-mails : ${env.BETTER_AUTH_URL}/parametres\n\nRelance`,
			});
			await db
				.update(rappel)
				.set({ emailEnvoye: true })
				.where(
					inArray(
						rappel.id,
						rappels.map((r) => r.id),
					),
				);
		} catch (e) {
			// Un envoi raté ne bloque pas les autres comptes ; il sera retenté demain.
			console.error("Rappels non envoyés", e);
		}
	}
	return parCompte.size;
}
