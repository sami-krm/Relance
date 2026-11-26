import { exports } from "cloudflare:workers";
import { expect, it } from "vitest";
import type { Candidature, Document, Evenement } from "../src/shared/schemas";
import { api, connecter, json, site } from "./outils";

const aujourdhui = new Intl.DateTimeFormat("sv-SE", {
	timeZone: "Europe/Paris",
}).format(new Date());

async function creer(cookie: string, chemin: string, corps: unknown) {
	const res = await api(cookie, chemin, { method: "POST", ...json(corps) });
	expect(res.status).toBe(201);
	return (await res.json<{ id: string }>()).id;
}
const lire = async <T>(cookie: string, chemin: string) =>
	(await api(cookie, chemin)).json<T>();
const modifier = (cookie: string, id: string, corps: unknown) =>
	api(cookie, `/candidatures/${id}`, { method: "PATCH", ...json(corps) });

async function preparer(email: string) {
	const cookie = await connecter(email);
	const entrepriseId = await creer(cookie, "/entreprises", { nom: "Acme" });
	const offreId = await creer(cookie, "/offres", {
		entrepriseId,
		intitule: "Alternance développeur",
		source: "Salon",
		lien: "https://acme.example/offre",
	});
	const pdf = new TextEncoder().encode("%PDF-1.7\n");
	const cv = await api(cookie, "/documents/cv?nom=CV", {
		method: "POST",
		headers: { "content-type": "application/pdf" },
		body: pdf,
	});
	const cvId = (await cv.json<{ id: string }>()).id;
	return { cookie, entrepriseId, offreId, cvId };
}

it("refuse les candidatures sans session", async () => {
	expect((await exports.default.fetch(`${site}/api/candidatures`)).status).toBe(
		401,
	);
});

it("crée une candidature depuis une offre et la marque envoyée avec sa date", async () => {
	const { cookie, entrepriseId, offreId, cvId } =
		await preparer("a1@example.com");
	const id = await creer(cookie, "/candidatures", {
		entrepriseId: "",
		offreId,
		cvId,
		statut: "envoyee",
		canal: "E-mail",
		lettre: "Madame, Monsieur,",
	});
	expect(await lire<Candidature[]>(cookie, "/candidatures")).toMatchObject([
		{
			id,
			entrepriseId,
			poste: "Alternance développeur",
			source: "Salon",
			lien: "https://acme.example/offre",
			statut: "envoyee",
			dateEnvoi: aujourdhui,
			cvId,
			lettre: "Madame, Monsieur,",
		},
	]);
	expect(
		await lire<Evenement[]>(cookie, `/candidatures/${id}/historique`),
	).toMatchObject([{ type: "statut", statut: "envoyee", date: aujourdhui }]);
});

it("crée une candidature spontanée, et exige un poste", async () => {
	const { cookie, entrepriseId } = await preparer("a2@example.com");
	const sansPoste = await api(cookie, "/candidatures", {
		method: "POST",
		...json({ entrepriseId }),
	});
	expect(sansPoste.status).toBe(400);
	const id = await creer(cookie, "/candidatures", {
		entrepriseId,
		poste: "Développeur web",
		etiquettes: ["spontanée"],
	});
	expect(await lire<Candidature[]>(cookie, "/candidatures")).toMatchObject([
		{
			id,
			offreId: null,
			statut: "brouillon",
			dateEnvoi: "",
			etiquettes: ["spontanée"],
		},
	]);
});

it("historise les changements de statut et les réponses, sans toucher au reste", async () => {
	const { cookie, offreId } = await preparer("a3@example.com");
	const id = await creer(cookie, "/candidatures", {
		entrepriseId: "",
		offreId,
		notes: "Relancer en janvier",
	});
	expect(
		(await modifier(cookie, id, { notes: "Relancer en février" })).status,
	).toBe(204);
	expect((await modifier(cookie, id, { poste: "" })).status).toBe(400);
	expect((await modifier(cookie, id, { statut: "envoyee" })).status).toBe(204);
	expect((await modifier(cookie, id, { statut: "entretien" })).status).toBe(
		204,
	);
	expect(
		(
			await api(cookie, `/candidatures/${id}/reponses`, {
				method: "POST",
				...json({ texte: "Merci, entretien le 12.", date: "2026-11-20" }),
			})
		).status,
	).toBe(201);

	expect(await lire<Candidature[]>(cookie, "/candidatures")).toMatchObject([
		{
			statut: "entretien",
			notes: "Relancer en février",
			dateEnvoi: aujourdhui,
			source: "Salon",
		},
	]);
	const historique = await lire<Evenement[]>(
		cookie,
		`/candidatures/${id}/historique`,
	);
	expect(historique.map((e) => e.statut ?? e.texte)).toEqual([
		"Merci, entretien le 12.",
		"brouillon",
		"envoyee",
		"entretien",
	]);
});

it("isole les comptes et refuse un contact d'une autre entreprise", async () => {
	const alice = await preparer("a4@example.com");
	const id = await creer(alice.cookie, "/candidatures", {
		entrepriseId: alice.entrepriseId,
		poste: "Stage",
	});
	const autre = await creer(alice.cookie, "/entreprises", { nom: "Autre" });
	const contactAutre = await creer(alice.cookie, "/contacts", {
		entrepriseId: autre,
		nom: "Bob",
	});
	expect(
		(await modifier(alice.cookie, id, { contactId: contactAutre })).status,
	).toBe(400);

	const bob = await connecter("b4@example.com");
	expect(await lire(bob, "/candidatures")).toEqual([]);
	expect((await modifier(bob, id, { statut: "refusee" })).status).toBe(404);
	expect(
		(await api(bob, `/candidatures/${id}`, { method: "DELETE" })).status,
	).toBe(404);
	expect((await api(bob, `/candidatures/${id}/historique`)).status).toBe(404);
	const vol = await api(bob, "/candidatures", {
		method: "POST",
		...json({ entrepriseId: alice.entrepriseId, offreId: alice.offreId }),
	});
	expect(vol.status).toBe(400);
});

it("masque un CV utilisé au lieu de l'effacer, et protège l'entreprise", async () => {
	const { cookie, entrepriseId, cvId } = await preparer("a5@example.com");
	const id = await creer(cookie, "/candidatures", {
		entrepriseId,
		poste: "Stage",
		cvId,
	});

	expect(
		(await api(cookie, `/documents/${cvId}`, { method: "DELETE" })).status,
	).toBe(204);
	expect(await lire<Document[]>(cookie, "/documents")).toEqual([]);
	expect((await api(cookie, `/documents/${cvId}/fichier`)).status).toBe(200);
	expect(await lire<Candidature[]>(cookie, "/candidatures")).toMatchObject([
		{ cvId },
	]);

	expect(
		(await api(cookie, `/entreprises/${entrepriseId}`, { method: "DELETE" }))
			.status,
	).toBe(409);
	expect(
		(await api(cookie, `/candidatures/${id}`, { method: "DELETE" })).status,
	).toBe(204);
	expect(
		(await api(cookie, `/entreprises/${entrepriseId}`, { method: "DELETE" }))
			.status,
	).toBe(204);
});
