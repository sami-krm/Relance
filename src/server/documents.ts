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
const DOCX =
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Le format se lit dans le contenu, jamais dans le nom ou l'en-tête envoyés.
// DOCX : une archive ZIP dont le répertoire (à la fin du fichier) contient word/document.xml.
export function formatCv(octets: ArrayBuffer): "pdf" | "docx" | null {
	const debut = new Uint8Array(octets, 0, Math.min(5, octets.byteLength));
	if (new TextDecoder().decode(debut) === "%PDF-") return "pdf";
	const zip = [0x50, 0x4b, 0x03, 0x04].every((o, i) => debut[i] === o);
	if (!zip) return null;
	// Les octets binaires deviennent des caractères de remplacement, mais un nom ASCII reste intact.
	const fin = new Uint8Array(octets, Math.max(0, octets.byteLength - 65_536));
	return new TextDecoder().decode(fin).includes("word/document.xml")
		? "docx"
		: null;
}
const typeMime = { pdf: "application/pdf", docx: DOCX } as const;
const formatDe = (cleR2: string | null) =>
	cleR2?.endsWith(".docx") ? "docx" : "pdf";

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
				cleR2: document.cleR2,
			})
			.from(document)
			.where(and(eq(document.userId, c.var.userId), isNull(document.archiveLe)))
			.orderBy(desc(document.createdAt));
		return c.json(
			docs.map(({ cleR2, ...d }) => ({
				...d,
				format: d.type === "cv" ? formatDe(cleR2) : null,
			})),
		);
	})
	// Le fichier (PDF ou DOCX) arrive brut dans le corps (pas de multipart à analyser) et le nom dans l'URL.
	.post("/cv", async (c) => {
		const nom = nomDocument.safeParse(c.req.query("nom"));
		if (!nom.success) return c.json({ message: "Donnez un nom au CV." }, 400);
		const annonce = Number(c.req.header("content-length"));
		if (!annonce)
			return c.json({ message: "Taille du fichier inconnue." }, 411);
		if (annonce > TAILLE_MAX_CV) return c.json(tropGros, 413);
		const octets = await c.req.arrayBuffer();
		if (octets.byteLength > TAILLE_MAX_CV) return c.json(tropGros, 413);
		const format = formatCv(octets);
		if (!format)
			return c.json(
				{ message: "Le fichier doit être un PDF ou un document Word (DOCX)." },
				400,
			);

		const id = crypto.randomUUID();
		const cleR2 = `${c.var.userId}/${id}.${format}`;
		await c.env.DOCUMENTS.put(cleR2, octets, {
			httpMetadata: { contentType: typeMime[format] },
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
		const format = formatDe(doc.cleR2);
		// Un PDF s'affiche dans le navigateur ; un DOCX se télécharge.
		return new Response(objet.body, {
			headers: {
				"content-type": typeMime[format],
				"content-disposition": `${format === "pdf" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(doc.nom)}.${format}`,
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
