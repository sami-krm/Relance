import { expect, it } from "vitest";
import type {
	ApercuEnvoi,
	Candidature,
	Envoi,
	Rappel,
} from "../src/shared/schemas";
import { api, connecter, json } from "./outils";

async function creer(cookie: string, chemin: string, corps: unknown) {
	const res = await api(cookie, chemin, { method: "POST", ...json(corps) });
	expect(res.status).toBe(201);
	return (await res.json<{ id: string }>()).id;
}

async function preparer(email: string, avecContact = true) {
	const cookie = await connecter(email);
	const entrepriseId = await creer(cookie, "/entreprises", {
		nom: "Atelier inventé",
	});
	const contactId = avecContact
		? await creer(cookie, "/contacts", {
				entrepriseId,
				nom: "Dominique Recruteur",
				email: "recrutement@exemple.test",
			})
		: "";
	const offreId = await creer(cookie, "/offres", {
		entrepriseId,
		intitule: "Alternance développeur web",
		lien: "https://emplois.exemple.test/offre/42",
	});
	const cv = await api(cookie, "/documents/cv?nom=CV%20Camille", {
		method: "POST",
		headers: { "content-type": "application/pdf" },
		body: new TextEncoder().encode("%PDF-1.7\n"),
	});
	const cvId = (await cv.json<{ id: string }>()).id;
	const id = await creer(cookie, "/candidatures", {
		entrepriseId: "",
		offreId,
		contactId,
		cvId,
		lettre: "Madame, Monsieur,",
		reponsesFormulaire: "Pourquoi nous ? Parce que…",
	});
	await api(cookie, "/profil", {
		method: "PUT",
		...json({
			valeurs: {
				nom: "Camille Exemple",
				telephone: "0600000000",
				ville: "Lyon",
			},
			partages: ["nom", "telephone"],
		}),
	});
	return { cookie, id };
}

const apercu = async (cookie: string, id: string, mode: string) =>
	(
		await api(cookie, `/candidatures/${id}/envoi?mode=${mode}`)
	).json<ApercuEnvoi>();
const confirmer = (cookie: string, id: string, mode: string) =>
	api(cookie, `/candidatures/${id}/envoi`, {
		method: "POST",
		...json({ mode }),
	});

it("montre l'aperçu puis conserve exactement ce qui a été transmis", async () => {
	const { cookie, id } = await preparer("envoi-1@exemple.test");
	const a = await apercu(cookie, id, "email");
	expect(a).toMatchObject({
		mode: "email",
		entreprise: "Atelier inventé",
		poste: "Alternance développeur web",
		destinataire: "recrutement@exemple.test",
		lien: "https://emplois.exemple.test/offre/42",
		cv: "CV Camille",
		lettre: "Madame, Monsieur,",
		reponses: "Pourquoi nous ? Parce que…",
		manquants: [],
		bloquant: "",
	});
	// La ville n'est pas partagée ; l'adresse e-mail l'est forcément pour un e-mail.
	expect(a.coordonnees).toEqual([
		{ libelle: "Nom et prénom", valeur: "Camille Exemple" },
		{ libelle: "Adresse e-mail", valeur: "envoi-1@exemple.test" },
		{ libelle: "Téléphone", valeur: "0600000000" },
	]);
	expect((await apercu(cookie, id, "site")).destinataire).toBe(
		"emplois.exemple.test",
	);

	const res = await confirmer(cookie, id, "email");
	expect(res.status).toBe(200);
	const [c] = await (await api(cookie, "/candidatures")).json<Candidature[]>();
	expect(c).toMatchObject({ statut: "envoyee", canal: "E-mail" });
	const { manquants: _m, bloquant: _b, ...attendu } = a;
	expect(c.envoi).toEqual(attendu satisfies Envoi);
	// La relance automatique est proposée, comme pour un envoi manuel.
	const rappels = await (await api(cookie, "/rappels")).json<Rappel[]>();
	expect(
		rappels.some((r) => r.candidatureId === id && r.type === "relance"),
	).toBe(true);
	expect((await confirmer(cookie, id, "email")).status).toBe(409);
});

it("bloque l'envoi sans destinataire et protège les autres comptes", async () => {
	const { cookie, id } = await preparer("envoi-2@exemple.test", false);
	const a = await apercu(cookie, id, "email");
	expect(a.destinataire).toBe("");
	expect(a.bloquant).not.toBe("");
	expect((await confirmer(cookie, id, "email")).status).toBe(400);
	expect((await confirmer(cookie, id, "fax")).status).toBe(400);

	const autre = await connecter("envoi-3@exemple.test");
	expect((await api(autre, `/candidatures/${id}/envoi?mode=site`)).status).toBe(
		404,
	);
	expect((await confirmer(autre, id, "site")).status).toBe(404);
});
