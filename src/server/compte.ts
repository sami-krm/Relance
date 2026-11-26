import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { candidature, contact, document, entreprise, user } from "../db/schema";
import { libellesStatut, type Statut } from "../shared/schemas";
import { bd, type Contexte, exigerSession } from "./session";

// Cellule CSV : guillemets échappés, et une apostrophe devant =, +, -, @ pour qu'un tableur n'exécute pas de formule.
const cellule = (v: unknown) => {
	let texte = String(v ?? "");
	if (/^[=+\-@\t\r]/.test(texte)) texte = `'${texte}`;
	return `"${texte.replaceAll('"', '""')}"`;
};

export const routesCompte = new Hono<Contexte>()
	.use(exigerSession)
	.get("/export.csv", async (c) => {
		const lignes = await bd(c.env)
			.select({
				poste: candidature.poste,
				entreprise: entreprise.nom,
				statut: candidature.statut,
				dateEnvoi: candidature.dateEnvoi,
				canal: candidature.canal,
				contact: contact.nom,
				source: candidature.source,
				lien: candidature.lien,
				cv: document.nom,
				etiquettes: candidature.etiquettes,
				notes: candidature.notes,
				creeeLe: candidature.createdAt,
			})
			.from(candidature)
			.innerJoin(entreprise, eq(entreprise.id, candidature.entrepriseId))
			.leftJoin(contact, eq(contact.id, candidature.contactId))
			.leftJoin(document, eq(document.id, candidature.cvId))
			.where(eq(candidature.userId, c.var.userId))
			.orderBy(desc(candidature.createdAt));
		const entetes = [
			"Poste",
			"Entreprise",
			"Statut",
			"Date d'envoi",
			"Canal",
			"Contact",
			"Source",
			"Lien de l'offre",
			"CV",
			"Étiquettes",
			"Notes",
			"Créée le",
		];
		const csv = [
			entetes,
			...lignes.map((l) => [
				l.poste,
				l.entreprise,
				libellesStatut[l.statut as Statut] ?? l.statut,
				l.dateEnvoi,
				l.canal,
				l.contact,
				l.source,
				l.lien,
				l.cv,
				l.etiquettes.join(", "),
				l.notes,
				l.creeeLe.toISOString().slice(0, 10),
			]),
		]
			.map((ligne) => ligne.map(cellule).join(";"))
			.join("\r\n");
		// BOM et « ; » : Excel en français ouvre le fichier directement avec les accents.
		return c.body(`﻿${csv}\r\n`, 200, {
			"content-type": "text/csv; charset=utf-8",
			"content-disposition": 'attachment; filename="candidatures-relance.csv"',
			"cache-control": "private, no-store",
		});
	})
	.delete("/", async (c) => {
		const r = z
			.object({ confirmation: z.literal("SUPPRIMER") })
			.safeParse(await c.req.json().catch(() => null));
		if (!r.success)
			return c.json({ message: "Tapez SUPPRIMER pour confirmer." }, 400);
		// Fichiers d'abord : si R2 échoue, la base reste intacte et l'on peut réessayer.
		let curseur: string | undefined;
		do {
			const page = await c.env.DOCUMENTS.list({
				prefix: `${c.var.userId}/`,
				cursor: curseur,
			});
			if (page.objects.length)
				await c.env.DOCUMENTS.delete(page.objects.map((o) => o.key));
			curseur = page.truncated ? page.cursor : undefined;
		} while (curseur);
		// Toutes les tables du compte sont en cascade sur user (sessions comprises).
		await bd(c.env).delete(user).where(eq(user.id, c.var.userId));
		return c.body(null, 204);
	});
