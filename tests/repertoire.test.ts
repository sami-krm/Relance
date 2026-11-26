import { exports } from "cloudflare:workers";
import { expect, it } from "vitest";
import type { Contact, Entreprise, Offre } from "../src/shared/schemas";
import { api, connecter, json, site } from "./outils";

const creer = async (cookie: string, chemin: string, corps: unknown) => {
	const res = await api(cookie, chemin, { method: "POST", ...json(corps) });
	expect(res.status).toBe(201);
	return (await res.json<{ id: string }>()).id;
};
const lister = async <T>(cookie: string, chemin: string) =>
	(await api(cookie, chemin)).json<T[]>();

it("refuse les entreprises, contacts et offres sans session", async () => {
	for (const chemin of ["/entreprises", "/contacts", "/offres"])
		expect((await exports.default.fetch(`${site}/api${chemin}`)).status).toBe(
			401,
		);
});

it("crée une entreprise, un contact et une offre, puis les retrouve", async () => {
	const alice = await connecter("alice-rep@example.com");
	const entrepriseId = await creer(alice, "/entreprises", {
		nom: "Acme",
		ville: "Montpellier",
		site: "https://acme.example",
	});
	await creer(alice, "/contacts", {
		entrepriseId,
		nom: "Claire Dupont",
		role: "RH",
		email: "claire@acme.example",
	});
	const offreId = await creer(alice, "/offres", {
		entrepriseId,
		intitule: "Alternance développeur web",
		contrat: "Alternance",
		source: "Salon",
		dateLimite: "2027-03-31",
	});

	expect(await lister<Entreprise>(alice, "/entreprises")).toMatchObject([
		{ id: entrepriseId, nom: "Acme", ville: "Montpellier", secteur: "" },
	]);
	expect(await lister<Contact>(alice, "/contacts")).toMatchObject([
		{ entrepriseId, nom: "Claire Dupont", role: "RH" },
	]);
	expect(await lister<Offre>(alice, "/offres")).toMatchObject([
		{
			id: offreId,
			entrepriseId,
			intitule: "Alternance développeur web",
			expiree: false,
		},
	]);

	// Marquer expirée ne touche pas aux autres champs.
	expect(
		(
			await api(alice, `/offres/${offreId}`, {
				method: "PATCH",
				...json({ expiree: true }),
			})
		).status,
	).toBe(204);
	expect(await lister<Offre>(alice, "/offres")).toMatchObject([
		{ expiree: true, source: "Salon", dateLimite: "2027-03-31" },
	]);

	// Supprimer l'entreprise supprime ses contacts et ses offres.
	expect(
		(await api(alice, `/entreprises/${entrepriseId}`, { method: "DELETE" }))
			.status,
	).toBe(204);
	expect(await lister(alice, "/contacts")).toEqual([]);
	expect(await lister(alice, "/offres")).toEqual([]);
});

it("isole les comptes, y compris pour rattacher un contact", async () => {
	const alice = await connecter("alice-iso@example.com");
	const entrepriseId = await creer(alice, "/entreprises", { nom: "Acme" });
	const bob = await connecter("bob-iso@example.com");

	expect(await lister(bob, "/entreprises")).toEqual([]);
	expect(
		(
			await api(bob, `/entreprises/${entrepriseId}`, {
				method: "PATCH",
				...json({ nom: "Piraté" }),
			})
		).status,
	).toBe(404);
	expect(
		(await api(bob, `/entreprises/${entrepriseId}`, { method: "DELETE" }))
			.status,
	).toBe(404);
	const intrus = await api(bob, "/contacts", {
		method: "POST",
		...json({ entrepriseId, nom: "Intrus" }),
	});
	expect(intrus.status).toBe(400);
	expect(await lister<Entreprise>(alice, "/entreprises")).toMatchObject([
		{ nom: "Acme" },
	]);
});

it("rejette les liens non web et les adresses e-mail invalides", async () => {
	const alice = await connecter("alice-valid@example.com");
	const entrepriseId = await creer(alice, "/entreprises", { nom: "Acme" });
	const offre = await api(alice, "/offres", {
		method: "POST",
		...json({ entrepriseId, intitule: "Stage", lien: "javascript:alert(1)" }),
	});
	expect(offre.status).toBe(400);
	expect(await offre.json()).toMatchObject({ champs: ["lien"] });
	const contact = await api(alice, "/contacts", {
		method: "POST",
		...json({ entrepriseId, nom: "X", email: "pas-un-email" }),
	});
	expect(await contact.json()).toMatchObject({ champs: ["email"] });
	expect(
		(await api(alice, "/entreprises", { method: "POST", ...json({ nom: "" }) }))
			.status,
	).toBe(400);
});
