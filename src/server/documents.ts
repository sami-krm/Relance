import { and, desc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { candidature, document } from "../db/schema";
import {
	modificationDocumentSchema,
	nomDocument,
	nouveauTexteSchema,
	TAILLE_MAX_CV,
} from "../shared/schemas";
import { bd, type Contexte, exigerSession } from "./session";

const tropGros = { message: "Le fichier doit faire 5 Mo au plus." };
const estPdf = (octets: ArrayBuffer) =>
	new TextDecoder().decode(octets.slice(0, 5)) === "%PDF-";

// Chaque requête est filtrée par l'utilisateur connecté : un document d'un autre compte répond 404.
const duCompte = (c: { var: { userId: string } }, id: string) =>
	and(eq(document.id, id), eq(document.userId, c.var.userId));

export const routesDocuments = new Hono<Contexte>()
	.use(exigerSession)
	.get("/", async (c) => {
		const docs = await bd(c.env)
			.select({
				id: document.id,
				type: document.type,
				nom: document.nom,
				taille: document.taille,
				contenu: document.contenu,
				parDefaut: document.parDefaut,
				createdAt: document.createdAt,
			})
			.from(document)
			.where(and(eq(document.userId, c.var.userId), isNull(document.archiveLe)))
			.orderBy(desc(document.createdAt));
		return c.json(docs);
	})
	// Le PDF arrive brut dans le corps (pas de multipart à analyser) et le nom dans l'URL.
	.post("/cv", async (c) => {
		const nom = nomDocument.safeParse(c.req.query("nom"));
		if (!nom.success) return c.json({ message: "Donnez un nom au CV." }, 400);
		const annonce = Number(c.req.header("content-length"));
		if (!annonce)
			return c.json({ message: "Taille du fichier inconnue." }, 411);
		if (annonce > TAILLE_MAX_CV) return c.json(tropGros, 413);
		const octets = await c.req.arrayBuffer();
		if (octets.byteLength > TAILLE_MAX_CV) return c.json(tropGros, 413);
		if (!estPdf(octets))
			return c.json({ message: "Le fichier n'est pas un PDF." }, 400);

		const id = crypto.randomUUID();
		const cleR2 = `${c.var.userId}/${id}.pdf`;
		await c.env.DOCUMENTS.put(cleR2, octets, {
			httpMetadata: { contentType: "application/pdf" },
		});
		try {
			const dejaUnCv = await bd(c.env)
				.select({ id: document.id })
				.from(document)
				.where(
					and(
						eq(document.userId, c.var.userId),
						eq(document.type, "cv"),
						isNull(document.archiveLe),
					),
				)
				.get();
			await bd(c.env).insert(document).values({
				id,
				userId: c.var.userId,
				type: "cv",
				nom: nom.data,
				cleR2,
				taille: octets.byteLength,
				parDefaut: !dejaUnCv,
			});
		} catch (e) {
			await c.env.DOCUMENTS.delete(cleR2);
			throw e;
		}
		return c.json({ id }, 201);
	})
	.post("/", async (c) => {
		const r = nouveauTexteSchema.safeParse(
			await c.req.json().catch(() => null),
		);
		if (!r.success) return c.json({ message: "Nom ou texte invalide." }, 400);
		const id = crypto.randomUUID();
		await bd(c.env)
			.insert(document)
			.values({ id, userId: c.var.userId, ...r.data });
		return c.json({ id }, 201);
	})
	.get("/:id/fichier", async (c) => {
		const doc = await bd(c.env)
			.select({ cleR2: document.cleR2, nom: document.nom })
			.from(document)
			.where(duCompte(c, c.req.param("id")))
			.get();
		const objet = doc?.cleR2 && (await c.env.DOCUMENTS.get(doc.cleR2));
		if (!doc || !objet)
			return c.json({ message: "Document introuvable." }, 404);
		return new Response(objet.body, {
			headers: {
				"content-type": "application/pdf",
				"content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.nom)}.pdf`,
				"x-content-type-options": "nosniff",
				"cache-control": "private, no-store",
			},
		});
	})
	.patch("/:id", async (c) => {
		const r = modificationDocumentSchema.safeParse(
			await c.req.json().catch(() => null),
		);
		if (!r.success) return c.json({ message: "Modification invalide." }, 400);
		const doc = await bd(c.env)
			.select({ type: document.type })
			.from(document)
			.where(duCompte(c, c.req.param("id")))
			.get();
		if (!doc) return c.json({ message: "Document introuvable." }, 404);
		// Un CV importé n'est jamais modifié : seuls son nom et son statut « par défaut » changent.
		if (doc.type === "cv" && r.data.contenu !== undefined)
			return c.json({ message: "Un CV ne se modifie pas." }, 400);
		if (doc.type !== "cv" && r.data.parDefaut)
			return c.json({ message: "Seul un CV peut être par défaut." }, 400);

		const { nom, contenu, parDefaut } = r.data;
		const maj = bd(c.env)
			.update(document)
			.set({ nom, contenu, updatedAt: new Date() })
			.where(duCompte(c, c.req.param("id")));
		if (!parDefaut) await maj;
		else
			await bd(c.env).batch([
				maj,
				bd(c.env)
					.update(document)
					.set({ parDefaut: false })
					.where(
						and(eq(document.userId, c.var.userId), eq(document.type, "cv")),
					),
				bd(c.env)
					.update(document)
					.set({ parDefaut: true })
					.where(duCompte(c, c.req.param("id"))),
			]);
		return c.body(null, 204);
	})
	// Un CV utilisé par une candidature est seulement masqué (il n'est effacé qu'avec le compte).
	.delete("/:id", async (c) => {
		const utilise = await bd(c.env)
			.select({ id: candidature.id })
			.from(candidature)
			.where(
				and(
					eq(candidature.cvId, c.req.param("id")),
					eq(candidature.userId, c.var.userId),
				),
			)
			.get();
		if (utilise) {
			const masques = await bd(c.env)
				.update(document)
				.set({ archiveLe: new Date(), parDefaut: false })
				.where(duCompte(c, c.req.param("id")))
				.returning({ id: document.id });
			if (!masques.length)
				return c.json({ message: "Document introuvable." }, 404);
			return c.body(null, 204);
		}
		const doc = await bd(c.env)
			.delete(document)
			.where(duCompte(c, c.req.param("id")))
			.returning({ cleR2: document.cleR2 })
			.get();
		if (!doc) return c.json({ message: "Document introuvable." }, 404);
		if (doc.cleR2) await c.env.DOCUMENTS.delete(doc.cleR2);
		return c.body(null, 204);
	});
