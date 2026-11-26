import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { type Context, Hono } from "hono";
import type { z } from "zod";
import { contact, entreprise, offre } from "../db/schema";
import {
	contactSchema,
	entrepriseSchema,
	offreSchema,
} from "../shared/schemas";
import { bd, type Contexte, exigerSession } from "./session";

type Table = SQLiteTable & { id: SQLiteColumn; userId: SQLiteColumn };
type C = Context<Contexte>;

const entrepriseDuCompte = (c: C, id: string) =>
	bd(c.env)
		.select({ id: entreprise.id })
		.from(entreprise)
		.where(and(eq(entreprise.id, id), eq(entreprise.userId, c.var.userId)))
		.get();

// Mêmes routes pour les entreprises, les contacts et les offres, toujours filtrées par compte.
function routes(table: Table, schema: z.ZodObject, ordre: SQL) {
	const duCompte = (c: C) =>
		and(eq(table.id, c.req.param("id") ?? ""), eq(table.userId, c.var.userId));

	async function lire(c: C, partiel: boolean) {
		const entree = await c.req.json().catch(() => null);
		const r = (partiel ? schema.partial() : schema).safeParse(entree);
		if (!r.success) {
			const champs = r.error.issues.map((i) => i.path[0]);
			return c.json(
				{ message: "Certains champs sont invalides.", champs },
				400,
			);
		}
		// En modification, partial() remettrait les valeurs par défaut : on ne garde que les champs envoyés.
		const donnees: Record<string, unknown> = partiel
			? Object.fromEntries(Object.entries(r.data).filter(([k]) => k in entree))
			: r.data;
		const idEntreprise = donnees.entrepriseId;
		if (
			typeof idEntreprise === "string" &&
			!(await entrepriseDuCompte(c, idEntreprise))
		)
			return c.json({ message: "Entreprise introuvable." }, 400);
		return donnees;
	}

	return new Hono<Contexte>()
		.use(exigerSession)
		.get("/", async (c) =>
			c.json(
				await bd(c.env)
					.select()
					.from(table)
					.where(eq(table.userId, c.var.userId))
					.orderBy(ordre),
			),
		)
		.post("/", async (c) => {
			const donnees = await lire(c, false);
			if (donnees instanceof Response) return donnees;
			const id = crypto.randomUUID();
			await bd(c.env)
				.insert(table)
				.values({ ...donnees, id, userId: c.var.userId } as never);
			return c.json({ id }, 201);
		})
		.patch("/:id", async (c) => {
			const donnees = await lire(c, true);
			if (donnees instanceof Response) return donnees;
			const lignes = await bd(c.env)
				.update(table)
				.set({ ...donnees, updatedAt: new Date() } as never)
				.where(duCompte(c))
				.returning({ id: table.id });
			if (!lignes.length) return c.json({ message: "Introuvable." }, 404);
			return c.body(null, 204);
		})
		.delete("/:id", async (c) => {
			try {
				const lignes = await bd(c.env)
					.delete(table)
					.where(duCompte(c))
					.returning({ id: table.id });
				if (!lignes.length) return c.json({ message: "Introuvable." }, 404);
			} catch (e) {
				// Une entreprise qui a des candidatures ne peut pas être supprimée (clé étrangère sans cascade).
				if (`${e} ${(e as Error).cause}`.includes("FOREIGN KEY"))
					return c.json(
						{ message: "Supprimez d'abord les candidatures liées." },
						409,
					);
				throw e;
			}
			return c.body(null, 204);
		});
}

export const routesEntreprises = routes(
	entreprise,
	entrepriseSchema,
	asc(entreprise.nom),
);
export const routesContacts = routes(contact, contactSchema, asc(contact.nom));
export const routesOffres = routes(offre, offreSchema, desc(offre.createdAt));
