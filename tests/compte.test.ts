import { env, exports } from "cloudflare:workers";
import { expect, it } from "vitest";
import { api, connecter, json, site } from "./outils";

async function creer(cookie: string, chemin: string, corps: unknown) {
	const res = await api(cookie, chemin, { method: "POST", ...json(corps) });
	expect(res.status).toBe(201);
	return (await res.json<{ id: string }>()).id;
}

async function compteRempli(email: string) {
	const cookie = await connecter(email);
	const e = await creer(cookie, "/entreprises", { nom: "Acme" });
	const cv = await api(cookie, "/documents/cv?nom=Mon%20CV", {
		method: "POST",
		headers: { "content-type": "application/pdf" },
		body: new TextEncoder().encode("%PDF-1.7\n"),
	});
	const cvId = (await cv.json<{ id: string }>()).id;
	await creer(cookie, "/candidatures", {
		entrepriseId: e,
		poste: "Développeur web",
		statut: "envoyee",
		dateEnvoi: "2026-11-02",
		cvId,
		etiquettes: ["salon", "priorité"],
		notes: '=HYPERLINK("x") et "guillemets"',
	});
	await creer(cookie, "/rappels", {
		type: "tache",
		titre: "Relire",
		date: "2026-12-01",
	});
	await api(cookie, "/profil", {
		method: "PUT",
		...json({ valeurs: { nom: "Alice" }, partages: [] }),
	});
	return cookie;
}

it("refuse l'export et la suppression sans session", async () => {
	expect(
		(await exports.default.fetch(`${site}/api/compte/export.csv`)).status,
	).toBe(401);
	expect(
		(await exports.default.fetch(`${site}/api/compte`, { method: "DELETE" }))
			.status,
	).toBe(401);
});

it("exporte ses seules candidatures en CSV lisible par Excel, sans formule exécutable", async () => {
	const alice = await compteRempli("c1@example.com");
	const res = await api(alice, "/compte/export.csv");
	expect(res.headers.get("content-type")).toContain("text/csv");
	const octets = new Uint8Array(await res.arrayBuffer());
	expect([...octets.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM UTF-8 pour Excel
	const texte = new TextDecoder().decode(octets);
	expect(texte.startsWith('"Poste";"Entreprise";"Statut"')).toBe(true);
	expect(texte).toContain(
		'"Développeur web";"Acme";"Envoyée";"2026-11-02";"";"";"";"";"Mon CV";"salon, priorité";',
	);
	expect(texte).toContain('"\'=HYPERLINK(""x"") et ""guillemets"""');

	const bob = await connecter("c1b@example.com");
	const vide = await (await api(bob, "/compte/export.csv")).text();
	expect(vide.trim().split("\r\n")).toHaveLength(1);
});

it("supprime le compte, ses données et ses fichiers, après confirmation", async () => {
	const alice = await compteRempli("c2@example.com");
	const userId = (
		await env.DB.prepare("select id from user where email = ?")
			.bind("c2@example.com")
			.first<{
				id: string;
			}>()
	)?.id;
	expect(
		(await env.DOCUMENTS.list({ prefix: `${userId}/` })).objects,
	).toHaveLength(1);

	const sansConfirmation = await api(alice, "/compte", {
		method: "DELETE",
		...json({ confirmation: "oui" }),
	});
	expect(sansConfirmation.status).toBe(400);

	const res = await api(alice, "/compte", {
		method: "DELETE",
		...json({ confirmation: "SUPPRIMER" }),
	});
	expect(res.status).toBe(204);
	expect(
		(await env.DOCUMENTS.list({ prefix: `${userId}/` })).objects,
	).toHaveLength(0);
	for (const table of [
		"user",
		"session",
		"profil",
		"document",
		"company",
		"application",
		"reminder",
	]) {
		const n = await env.DB.prepare(
			`select count(*) as n from ${table} where ${table === "user" ? "id" : "user_id"} = ?`,
		)
			.bind(userId)
			.first<{ n: number }>();
		expect(n?.n, table).toBe(0);
	}
	expect((await api(alice, "/candidatures")).status).toBe(401);
});
