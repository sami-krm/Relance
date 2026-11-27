import { and, asc, desc, eq } from "drizzle-orm";
import { type Context, Hono } from "hono";
import type { z } from "zod";
import {
	candidature,
	contact,
	document,
	entreprise,
	evenement,
	offre,
	profil,
	user,
} from "../db/schema";
import {
	type ApercuEnvoi,
	candidatureSchema,
	type ModeEnvoi,
	modesEnvoi,
	reponseSchema,
	sectionsProfil,
} from "../shared/schemas";
import { relanceAuto } from "./rappels";
import { bd, type Contexte, exigerSession } from "./session";

type C = Context<Contexte>;
type Donnees = z.infer<typeof candidatureSchema>;

const aujourdhui = () =>
	new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(
		new Date(),
	);

const duCompte = (c: C) =>
	and(
		eq(candidature.id, c.req.param("id") ?? ""),
		eq(candidature.userId, c.var.userId),
	);

// Vérifie que tout ce qui est lié appartient au compte et complète depuis l'offre. Renvoie un message d'erreur ou null.
async function resoudre(c: C, d: Donnees) {
	const db = bd(c.env);
	const u = c.var.userId;
	if (d.offreId) {
		const o = await db
			.select()
			.from(offre)
			.where(and(eq(offre.id, d.offreId), eq(offre.userId, u)))
			.get();
		if (!o) return "Offre introuvable.";
		d.entrepriseId = o.entrepriseId;
		d.poste ||= o.intitule;
		d.source ||= o.source;
		d.lien ||= o.lien;
	}
	const e = await db
		.select({ id: entreprise.id })
		.from(entreprise)
		.where(and(eq(entreprise.id, d.entrepriseId), eq(entreprise.userId, u)))
		.get();
	if (!e) return "Entreprise introuvable.";
	if (d.contactId) {
		const ct = await db
			.select({ entrepriseId: contact.entrepriseId })
			.from(contact)
			.where(and(eq(contact.id, d.contactId), eq(contact.userId, u)))
			.get();
		if (ct?.entrepriseId !== d.entrepriseId)
			return "Ce contact n'appartient pas à cette entreprise.";
	}
	if (d.cvId) {
		const cv = await db
			.select({ type: document.type })
			.from(document)
			.where(and(eq(document.id, d.cvId), eq(document.userId, u)))
			.get();
		if (cv?.type !== "cv") return "CV introuvable.";
	}
	if (!d.poste) return "Indiquez le poste.";
	return null;
}

const enBase = (d: Donnees) => ({
	...d,
	offreId: d.offreId || null,
	contactId: d.contactId || null,
	cvId: d.cvId || null,
});

const evenementStatut = (candidatureId: string, statut: string) => ({
	id: crypto.randomUUID(),
	candidatureId,
	type: "statut" as const,
	statut,
	date: aujourdhui(),
});

const champsCoordonnees = ["nom", "email", "telephone", "ville", "lien"];
const libelleChamp: Record<string, string> = Object.fromEntries([
	["email", "Adresse e-mail"],
	...sectionsProfil.flatMap((s) => s.champs.map((ch) => [ch.cle, ch.libelle])),
]);

// L'aperçu de l'envoi : ce qui est affiché est exactement ce qui sera conservé à la confirmation.
async function apercuEnvoi(
	c: C,
	mode: ModeEnvoi,
): Promise<(ApercuEnvoi & { statut: string; id: string }) | undefined> {
	const db = bd(c.env);
	const userId = c.var.userId;
	const ligne = await db
		.select({
			id: candidature.id,
			statut: candidature.statut,
			poste: candidature.poste,
			lien: candidature.lien,
			lettre: candidature.lettre,
			reponses: candidature.reponsesFormulaire,
			entreprise: entreprise.nom,
			emailContact: contact.email,
			cv: document.nom,
		})
		.from(candidature)
		.innerJoin(entreprise, eq(candidature.entrepriseId, entreprise.id))
		.leftJoin(contact, eq(candidature.contactId, contact.id))
		.leftJoin(document, eq(candidature.cvId, document.id))
		.where(duCompte(c))
		.get();
	if (!ligne) return undefined;
	const [p, compte] = await Promise.all([
		db
			.select({ donnees: profil.donnees })
			.from(profil)
			.where(eq(profil.userId, userId))
			.get(),
		db
			.select({ email: user.email })
			.from(user)
			.where(eq(user.id, userId))
			.get(),
	]);
	const valeurs: Record<string, string | undefined> = {
		...p?.donnees.valeurs,
		email: compte?.email,
	};
	const partages = new Set(p?.donnees.partages ?? []);
	// Un e-mail part de votre adresse : elle est toujours transmise dans ce mode.
	if (mode === "email") partages.add("email");
	const coordonnees = champsCoordonnees
		.filter((k) => partages.has(k) && valeurs[k]?.trim())
		.map((k) => ({
			libelle: libelleChamp[k],
			valeur: valeurs[k]?.trim() ?? "",
		}));

	let hote = "";
	try {
		hote = ligne.lien ? new URL(ligne.lien).hostname : "";
	} catch {}
	const destinataire = mode === "email" ? (ligne.emailContact ?? "") : hote;
	const manquants = [
		!ligne.cv && "Le CV",
		!ligne.lettre && "La lettre de motivation",
		!valeurs.nom?.trim() && "Votre nom (dans le profil)",
	].filter((x): x is string => !!x);
	return {
		id: ligne.id,
		statut: ligne.statut,
		mode,
		date: aujourdhui(),
		entreprise: ligne.entreprise,
		poste: ligne.poste,
		destinataire,
		lien: ligne.lien,
		cv: ligne.cv ?? "",
		lettre: ligne.lettre,
		reponses: ligne.reponses,
		coordonnees,
		manquants,
		bloquant: destinataire
			? ""
			: mode === "email"
				? "Ajoutez un contact avec une adresse e-mail à cette candidature."
				: "Ajoutez le lien de l'offre à cette candidature.",
	};
}

const lireMode = (v: unknown): ModeEnvoi | undefined =>
	typeof v === "string" && v in modesEnvoi ? (v as ModeEnvoi) : undefined;

export const routesCandidatures = new Hono<Contexte>()
	.use(exigerSession)
	.get("/", async (c) =>
		c.json(
			await bd(c.env)
				.select()
				.from(candidature)
				.where(eq(candidature.userId, c.var.userId))
				.orderBy(desc(candidature.updatedAt)),
		),
	)
	.post("/", async (c) => {
		const r = candidatureSchema.safeParse(await c.req.json().catch(() => null));
		if (!r.success)
			return c.json(
				{
					message: "Certains champs sont invalides.",
					champs: r.error.issues.map((i) => i.path[0]),
				},
				400,
			);
		const d = r.data;
		const erreur = await resoudre(c, d);
		if (erreur) return c.json({ message: erreur }, 400);
		if (d.statut === "envoyee") d.dateEnvoi ||= aujourdhui();
		const id = crypto.randomUUID();
		const relance =
			d.statut === "envoyee"
				? await relanceAuto(c.env, c.var.userId, id, d.poste, d.dateEnvoi)
				: [];
		await bd(c.env).batch([
			bd(c.env)
				.insert(candidature)
				.values({ ...enBase(d), id, userId: c.var.userId }),
			bd(c.env).insert(evenement).values(evenementStatut(id, d.statut)),
			...relance,
		]);
		return c.json({ id }, 201);
	})
	.patch("/:id", async (c) => {
		const entree = await c.req.json().catch(() => null);
		const r = candidatureSchema.partial().safeParse(entree);
		if (!r.success)
			return c.json(
				{
					message: "Certains champs sont invalides.",
					champs: r.error.issues.map((i) => i.path[0]),
				},
				400,
			);
		const avant = await bd(c.env)
			.select()
			.from(candidature)
			.where(duCompte(c))
			.get();
		if (!avant) return c.json({ message: "Candidature introuvable." }, 404);
		// partial() remet les valeurs par défaut : on ne garde que les champs envoyés.
		const envoyes = Object.fromEntries(
			Object.entries(r.data).filter(([k]) => k in entree),
		);
		const d: Donnees = {
			...avant,
			offreId: avant.offreId ?? "",
			contactId: avant.contactId ?? "",
			cvId: avant.cvId ?? "",
			canal: avant.canal as Donnees["canal"],
			statut: avant.statut as Donnees["statut"],
			...envoyes,
		};
		// Liens déjà vérifiés à la création : on ne les revérifie que s'ils changent (un changement de statut coûte moins de CPU).
		const liensModifies = ["entrepriseId", "offreId", "contactId", "cvId"].some(
			(k) => k in envoyes,
		);
		const erreur = liensModifies
			? await resoudre(c, d)
			: !d.poste && "Indiquez le poste.";
		if (erreur) return c.json({ message: erreur }, 400);
		const changeStatut = d.statut !== avant.statut;
		if (changeStatut && d.statut === "envoyee") d.dateEnvoi ||= aujourdhui();
		const maj = bd(c.env)
			.update(candidature)
			.set({ ...enBase(d), updatedAt: new Date() })
			.where(duCompte(c));
		const relance =
			changeStatut && d.statut === "envoyee"
				? await relanceAuto(c.env, c.var.userId, avant.id, d.poste, d.dateEnvoi)
				: [];
		if (changeStatut)
			await bd(c.env).batch([
				maj,
				bd(c.env).insert(evenement).values(evenementStatut(avant.id, d.statut)),
				...relance,
			]);
		else await maj;
		return c.body(null, 204);
	})
	.get("/:id/envoi", async (c) => {
		const mode = lireMode(c.req.query("mode"));
		if (!mode) return c.json({ message: "Mode d'envoi invalide." }, 400);
		const a = await apercuEnvoi(c, mode);
		if (!a) return c.json({ message: "Candidature introuvable." }, 404);
		const { id: _id, statut: _statut, ...apercu } = a;
		return c.json<ApercuEnvoi>(apercu);
	})
	// Confirmation de l'envoi : la candidature passe à « Envoyée » et ce qui est transmis est conservé.
	.post("/:id/envoi", async (c) => {
		const corps = await c.req
			.json<{ mode?: unknown }>()
			.catch(() => ({}) as { mode?: unknown });
		const mode = lireMode(corps.mode);
		if (!mode) return c.json({ message: "Mode d'envoi invalide." }, 400);
		const a = await apercuEnvoi(c, mode);
		if (!a) return c.json({ message: "Candidature introuvable." }, 404);
		if (a.bloquant) return c.json({ message: a.bloquant }, 400);
		if (a.statut !== "brouillon")
			return c.json({ message: "Cette candidature est déjà envoyée." }, 409);
		const { id, statut: _statut, manquants: _m, bloquant: _b, ...envoi } = a;
		const db = bd(c.env);
		await db.batch([
			db
				.update(candidature)
				.set({
					statut: "envoyee",
					dateEnvoi: envoi.date,
					canal: mode === "email" ? "E-mail" : "Site de l'offre",
					envoi,
					updatedAt: new Date(),
				})
				.where(duCompte(c)),
			db.insert(evenement).values(evenementStatut(id, "envoyee")),
			...(await relanceAuto(c.env, c.var.userId, id, envoi.poste, envoi.date)),
		]);
		return c.json(envoi);
	})
	.delete("/:id", async (c) => {
		const lignes = await bd(c.env)
			.delete(candidature)
			.where(duCompte(c))
			.returning({ id: candidature.id });
		if (!lignes.length)
			return c.json({ message: "Candidature introuvable." }, 404);
		return c.body(null, 204);
	})
	.get("/:id/historique", async (c) => {
		const cand = await bd(c.env)
			.select({ id: candidature.id })
			.from(candidature)
			.where(duCompte(c))
			.get();
		if (!cand) return c.json({ message: "Candidature introuvable." }, 404);
		return c.json(
			await bd(c.env)
				.select()
				.from(evenement)
				.where(eq(evenement.candidatureId, cand.id))
				.orderBy(asc(evenement.date), asc(evenement.createdAt)),
		);
	})
	.post("/:id/reponses", async (c) => {
		const r = reponseSchema.safeParse(await c.req.json().catch(() => null));
		if (!r.success)
			return c.json({ message: "Réponse ou date invalide." }, 400);
		const cand = await bd(c.env)
			.select({ id: candidature.id })
			.from(candidature)
			.where(duCompte(c))
			.get();
		if (!cand) return c.json({ message: "Candidature introuvable." }, 404);
		await bd(c.env)
			.insert(evenement)
			.values({
				id: crypto.randomUUID(),
				candidatureId: cand.id,
				type: "reponse",
				...r.data,
			});
		return c.json({ ok: true }, 201);
	});
