import { env, exports } from "cloudflare:workers";
import { expect, it } from "vitest";
import { type Document, TAILLE_MAX_CV } from "../src/shared/schemas";
import { api, connecter, json, site } from "./outils";

function pdf(taille = 100) {
	const octets = new Uint8Array(taille);
	octets.set(new TextEncoder().encode("%PDF-1.7\n"));
	return octets;
}

function envoyerCv(cookie: string, corps: Uint8Array, nom = "CV alternance") {
	return api(cookie, `/documents/cv?nom=${encodeURIComponent(nom)}`, {
		method: "POST",
		headers: { "content-type": "application/pdf" },
		body: corps,
	});
}

const documents = async (cookie: string) =>
	(await api(cookie, "/documents")).json<Document[]>();

it("refuse le profil et les documents sans session", async () => {
	for (const chemin of ["/profil", "/documents", "/documents/x/fichier"])
		expect((await exports.default.fetch(`${site}/api${chemin}`)).status).toBe(
			401,
		);
});

it("enregistre le profil de chacun et rejette un lien non web", async () => {
	const alice = await connecter("alice@example.com");
	expect(await (await api(alice, "/profil")).json()).toEqual({
		valeurs: {},
		partages: [],
	});

	const profil = {
		valeurs: {
			nom: "Alice Martin",
			dateDebut: "2027-09-01",
			typeRecherche: "Alternance",
			distanceMax: "30",
		},
		partages: ["nom", "email"],
	};
	expect(
		(await api(alice, "/profil", { method: "PUT", ...json(profil) })).status,
	).toBe(200);
	expect(await (await api(alice, "/profil")).json()).toEqual(profil);

	const invalide = await api(alice, "/profil", {
		method: "PUT",
		...json({ valeurs: { lien: "javascript:alert(1)" }, partages: [] }),
	});
	expect(invalide.status).toBe(400);
	expect(await invalide.json()).toMatchObject({ champs: ["lien"] });

	const bob = await connecter("bob@example.com");
	expect(await (await api(bob, "/profil")).json()).toEqual({
		valeurs: {},
		partages: [],
	});
});

it("importe un CV en PDF, le sert à son seul propriétaire et le supprime de R2", async () => {
	const alice = await connecter("alice-cv@example.com");
	expect(
		(await envoyerCv(alice, new TextEncoder().encode("pas un pdf"))).status,
	).toBe(400);
	expect((await envoyerCv(alice, pdf(TAILLE_MAX_CV + 1))).status).toBe(413);

	const cree = await envoyerCv(alice, pdf());
	expect(cree.status).toBe(201);
	const { id } = await cree.json<{ id: string }>();
	expect(await documents(alice)).toMatchObject([
		{ id, type: "cv", nom: "CV alternance", taille: 100, parDefaut: true },
	]);

	const fichier = await api(alice, `/documents/${id}/fichier`);
	expect(fichier.headers.get("content-type")).toBe("application/pdf");
	expect(new Uint8Array(await fichier.arrayBuffer())).toEqual(pdf());

	const bob = await connecter("bob@example.com");
	expect((await api(bob, `/documents/${id}/fichier`)).status).toBe(404);
	expect(
		(await api(bob, `/documents/${id}`, { method: "DELETE" })).status,
	).toBe(404);
	expect(await documents(bob)).toEqual([]);

	expect(
		(await api(alice, `/documents/${id}`, { method: "DELETE" })).status,
	).toBe(204);
	expect(
		(await env.DOCUMENTS.list()).objects.map((o) => o.key),
	).not.toContainEqual(expect.stringContaining(id));
	expect(await documents(alice)).toEqual([]);
});

it("garde un seul CV par défaut et ne modifie jamais le contenu d'un CV", async () => {
	const alice = await connecter("alice-defaut@example.com");
	const premier = (
		await (await envoyerCv(alice, pdf(), "CV 1")).json<{ id: string }>()
	).id;
	const second = (
		await (await envoyerCv(alice, pdf(), "CV 2")).json<{ id: string }>()
	).id;

	expect(
		(
			await api(alice, `/documents/${second}`, {
				method: "PATCH",
				...json({ parDefaut: true }),
			})
		).status,
	).toBe(204);
	const parDefaut = (await documents(alice))
		.filter((d) => d.parDefaut)
		.map((d) => d.id);
	expect(parDefaut).toEqual([second]);
	expect(parDefaut).not.toContain(premier);

	expect(
		(
			await api(alice, `/documents/${second}`, {
				method: "PATCH",
				...json({ contenu: "x" }),
			})
		).status,
	).toBe(400);
});

it("crée, modifie et supprime une lettre de motivation", async () => {
	const alice = await connecter("alice-lettre@example.com");
	const cree = await api(alice, "/documents", {
		method: "POST",
		...json({
			type: "lettre",
			nom: "Lettre type",
			contenu: "Madame, Monsieur,",
		}),
	});
	expect(cree.status).toBe(201);
	const { id } = await cree.json<{ id: string }>();

	await api(alice, `/documents/${id}`, {
		method: "PATCH",
		...json({ contenu: "Bonjour," }),
	});
	expect(await documents(alice)).toMatchObject([
		{
			id,
			type: "lettre",
			nom: "Lettre type",
			contenu: "Bonjour,",
			parDefaut: false,
		},
	]);
	expect(
		(
			await api(alice, `/documents/${id}`, {
				method: "PATCH",
				...json({ parDefaut: true }),
			})
		).status,
	).toBe(400);
	expect(
		(await api(alice, `/documents/${id}`, { method: "DELETE" })).status,
	).toBe(204);
});
