import { env, exports } from "cloudflare:workers";
import { afterEach, expect, it, vi } from "vitest";
import {
	calendrierIcs,
	doitEnvoyer,
	envoyerRappels,
} from "../src/server/rappels";
import type { Rappel, Reglages } from "../src/shared/schemas";
import { api, connecter, json, site } from "./outils";

afterEach(() => vi.restoreAllMocks());

async function creer(cookie: string, chemin: string, corps: unknown) {
	const res = await api(cookie, chemin, { method: "POST", ...json(corps) });
	expect(res.status).toBe(201);
	return (await res.json<{ id: string }>()).id;
}
const rappels = async (cookie: string) =>
	(await api(cookie, "/rappels")).json<Rappel[]>();
const modifier = (cookie: string, chemin: string, corps: unknown) =>
	api(cookie, chemin, { method: "PATCH", ...json(corps) });

it("refuse les rappels et les réglages sans session", async () => {
	for (const chemin of ["/rappels", "/reglages"])
		expect((await exports.default.fetch(`${site}/api${chemin}`)).status).toBe(
			401,
		);
});

it("propose une relance à J+7 au passage à « Envoyée », sans doublon, selon le délai réglé", async () => {
	const cookie = await connecter("r1@example.com");
	const e = await creer(cookie, "/entreprises", { nom: "Acme" });
	const c = await creer(cookie, "/candidatures", {
		entrepriseId: e,
		poste: "Stage",
		statut: "envoyee",
		dateEnvoi: "2026-11-02",
	});
	expect(await rappels(cookie)).toMatchObject([
		{
			type: "relance",
			date: "2026-11-09",
			candidatureId: c,
			statut: "a_faire",
		},
	]);

	await modifier(cookie, `/candidatures/${c}`, { statut: "entretien" });
	await modifier(cookie, `/candidatures/${c}`, { statut: "envoyee" });
	expect(await rappels(cookie)).toHaveLength(1);

	const reglages: Reglages = {
		delaiRelance: 3,
		delaiSansReponse: 21,
		emailsRappel: true,
	};
	expect(
		(await api(cookie, "/reglages", { method: "PUT", ...json(reglages) }))
			.status,
	).toBe(200);
	const c2 = await creer(cookie, "/candidatures", {
		entrepriseId: e,
		poste: "Alternance",
		statut: "envoyee",
		dateEnvoi: "2026-11-02",
	});
	expect(
		(await rappels(cookie)).find((r) => r.candidatureId === c2)?.date,
	).toBe("2026-11-05");
});

it("crée, reporte, marque fait et supprime un rappel, chacun chez soi", async () => {
	const alice = await connecter("r2@example.com");
	const id = await creer(alice, "/rappels", {
		type: "entretien",
		titre: "Entretien chez Acme",
		date: "2026-12-01",
	});
	await env.DB.prepare("update reminder set email_envoye = 1 where id = ?")
		.bind(id)
		.run();
	expect(
		(await modifier(alice, `/rappels/${id}`, { date: "2026-12-04" })).status,
	).toBe(204);
	expect(await rappels(alice)).toMatchObject([
		{ date: "2026-12-04", emailEnvoye: false },
	]);
	expect(
		(await modifier(alice, `/rappels/${id}`, { statut: "fait" })).status,
	).toBe(204);
	expect(await rappels(alice)).toMatchObject([{ statut: "fait" }]);

	const bob = await connecter("b2@example.com");
	expect(await rappels(bob)).toEqual([]);
	expect(
		(await modifier(bob, `/rappels/${id}`, { statut: "a_faire" })).status,
	).toBe(404);
	expect((await api(bob, `/rappels/${id}`, { method: "DELETE" })).status).toBe(
		404,
	);
	const e = await creer(alice, "/entreprises", { nom: "Acme" });
	const c = await creer(alice, "/candidatures", {
		entrepriseId: e,
		poste: "Stage",
	});
	const intrus = await api(bob, "/rappels", {
		method: "POST",
		...json({
			type: "tache",
			titre: "X",
			date: "2026-12-01",
			candidatureId: c,
		}),
	});
	expect(intrus.status).toBe(400);

	expect(
		(await api(alice, `/rappels/${id}`, { method: "DELETE" })).status,
	).toBe(204);
});

it("garde des réglages par défaut et refuse les valeurs hors limites", async () => {
	const cookie = await connecter("r3@example.com");
	expect(await (await api(cookie, "/reglages")).json()).toEqual({
		delaiRelance: 7,
		delaiSansReponse: 21,
		emailsRappel: true,
	});
	const hors = await api(cookie, "/reglages", {
		method: "PUT",
		...json({ delaiRelance: 0, delaiSansReponse: 21, emailsRappel: true }),
	});
	expect(hors.status).toBe(400);
});

it("envoie un seul e-mail par compte avec les rappels dus, une seule fois, sauf si désactivé", async () => {
	const alice = await connecter("r4a@example.com");
	await creer(alice, "/rappels", {
		type: "tache",
		titre: "Aujourd'hui",
		date: "2027-01-10",
	});
	await creer(alice, "/rappels", {
		type: "relance",
		titre: "En retard",
		date: "2027-01-05",
	});
	await creer(alice, "/rappels", {
		type: "tache",
		titre: "Plus tard",
		date: "2027-01-20",
	});
	const bob = await connecter("r4b@example.com");
	await creer(bob, "/rappels", {
		type: "tache",
		titre: "Silencieux",
		date: "2027-01-10",
	});
	await api(bob, "/reglages", {
		method: "PUT",
		...json({ delaiRelance: 7, delaiSansReponse: 21, emailsRappel: false }),
	});

	const envois: { to: string; texte: string }[] = [];
	vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
		const corps = JSON.parse(String(init?.body));
		envois.push({ to: corps.to[0].email, texte: corps.textContent });
		return Response.json({}, { status: 201 });
	});
	// La base est partagée entre les tests du fichier : on regarde seulement Alice et Bob.
	const pour = (email: string) => envois.filter((e) => e.to === email);
	await envoyerRappels(env, "2027-01-10");
	expect(pour("r4a@example.com")).toHaveLength(1);
	expect(pour("r4b@example.com")).toHaveLength(0);
	// Ses rappels sont marqués traités : réactiver les e-mails ne les renverra pas en bloc.
	const silencieux = await env.DB.prepare(
		"select email_envoye from reminder where titre = 'Silencieux'",
	).first<{ email_envoye: number }>();
	expect(silencieux?.email_envoye).toBe(1);
	const texte = pour("r4a@example.com")[0].texte;
	expect(texte).toContain("Aujourd'hui");
	expect(texte).toContain("En retard, prévu le 05/01/2027");
	expect(texte).not.toContain("Plus tard");

	await envoyerRappels(env, "2027-01-10");
	expect(pour("r4a@example.com")).toHaveLength(1);
});

it("plafonne les e-mails du matin et envoie le reste le lendemain", async () => {
	for (const email of ["plafond-a@exemple.test", "plafond-b@exemple.test"])
		await creer(await connecter(email), "/rappels", {
			type: "tache",
			titre: "Plafond",
			date: "2027-03-01",
		});
	const envois: string[] = [];
	vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
		envois.push(JSON.parse(String(init?.body)).to[0].email);
		return Response.json({}, { status: 201 });
	});
	// Base partagée entre les tests du fichier : d'autres comptes ont aussi des rappels dus.
	for (let passage = 0; passage < 20; passage++) {
		const avant = envois.length;
		await envoyerRappels(env, "2027-03-01", 1);
		expect(envois.length - avant).toBeLessThanOrEqual(1);
		if (envois.length === avant) break;
	}
	for (const email of ["plafond-a@exemple.test", "plafond-b@exemple.test"])
		expect(envois.filter((e) => e === email)).toHaveLength(1);
});

it("n'envoie qu'à 7 h heure de Paris, été comme hiver", () => {
	expect(doitEnvoyer(new Date("2026-12-15T06:00:00Z"))).toBe(true);
	expect(doitEnvoyer(new Date("2026-12-15T05:00:00Z"))).toBe(false);
	expect(doitEnvoyer(new Date("2027-07-15T05:00:00Z"))).toBe(true);
	expect(doitEnvoyer(new Date("2027-07-15T06:00:00Z"))).toBe(false);
});

it("exporte les rappels à faire au format iCalendar", async () => {
	const cookie = await connecter("ics@exemple.test");
	await creer(cookie, "/rappels", {
		type: "entretien",
		titre: "Entretien Atelier, salle 2; bureau B",
		date: "2027-01-12",
	});
	const fait = await creer(cookie, "/rappels", {
		type: "tache",
		titre: "Déjà faite",
		date: "2027-01-13",
	});
	await modifier(cookie, `/rappels/${fait}`, { statut: "fait" });

	const res = await api(cookie, "/rappels/export.ics");
	expect(res.headers.get("content-type")).toContain("text/calendar");
	expect(res.headers.get("content-disposition")).toContain(".ics");
	const ics = await res.text();
	expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
	expect(ics).toContain("DTSTART;VALUE=DATE:20270112\r\n");
	expect(ics).toContain("DTEND;VALUE=DATE:20270113\r\n");
	expect(ics).toContain(
		"SUMMARY:Entretien : Entretien Atelier\\, salle 2\\; bureau B",
	);
	expect(ics).not.toContain("Déjà faite");
	expect(
		(await exports.default.fetch(`${site}/api/rappels/export.ics`)).status,
	).toBe(401);
});

it("replie les lignes iCalendar trop longues sans couper un caractère", () => {
	const ics = calendrierIcs(
		[{ id: "x", type: "tache", titre: "é".repeat(80), date: "2027-01-01" }],
		new Date("2026-11-27T10:00:00Z"),
	);
	for (const ligne of ics.split("\r\n"))
		expect(new TextEncoder().encode(ligne).length).toBeLessThanOrEqual(75);
	expect(ics.replace(/\r\n /g, "")).toContain(
		`SUMMARY:Tâche : ${"é".repeat(80)}`,
	);
	expect(ics).toContain("DTSTAMP:20261127T100000Z");
});
