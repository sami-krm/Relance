import { afterEach, expect, it, vi } from "vitest";
import type { ResultatRecherche } from "../src/shared/schemas";
import { api, connecter } from "./outils";

const offreFT = (id: string, romeCode: string) => ({
	id,
	intitule: `Développeur web ${id}`,
	romeCode,
	dateCreation: "2026-11-20T10:00:00.000Z",
	lieuTravail: { libelle: "69 - Lyon" },
	entreprise: { nom: "Entreprise inventée" },
});

const offreLBA = (id: string, partner_label: string, title: string) => ({
	identifier: { id, partner_job_id: id, partner_label },
	workplace: {
		name: "Atelier inventé",
		legal_name: null,
		location: { address: "Lyon" },
	},
	apply: { url: `https://exemple.test/${id}` },
	contract: { start: "2027-09-01T00:00:00.000Z" },
	offer: {
		title,
		description: "Description",
		publication: { creation: "2026-11-21T00:00:00.000Z" },
	},
});

// Simule les trois services et garde les URL appelées.
function simuler(reponses: { ft?: Response; lba?: unknown[] }) {
	const appels: string[] = [];
	vi.spyOn(globalThis, "fetch").mockImplementation(async (entree) => {
		const url = String(entree);
		appels.push(url);
		if (url.startsWith("https://geo.api.gouv.fr"))
			return Response.json(
				url.includes("Introuvable")
					? []
					: [{ code: "69123", centre: { coordinates: [4.83, 45.76] } }],
			);
		if (url.includes("access_token"))
			return Response.json({ access_token: "jeton", expires_in: 1500 });
		if (url.includes("francetravail.io"))
			return (
				reponses.ft?.clone() ??
				Response.json({
					resultats: [offreFT("1", "M1805"), offreFT("2", "M1805")],
				})
			);
		if (url.includes("apprentissage.beta.gouv.fr"))
			return Response.json({ jobs: reponses.lba ?? [], recruiters: [] });
		throw new Error(`appel inattendu ${url}`);
	});
	return appels;
}

afterEach(() => vi.restoreAllMocks());

it("réunit les deux sources sans reprendre deux fois les offres France Travail", async () => {
	const cookie = await connecter("recherche-1@exemple.test");
	const appels = simuler({
		lba: [
			offreLBA("a", "France Travail", "Développeur web"),
			offreLBA("b", "Hellowork", "Développeur web"),
		],
	});
	const res = await api(
		cookie,
		"/recherche?motsCles=d%C3%A9veloppeur&ville=Lyon&distance=20",
	);
	expect(res.status).toBe(200);
	const r = await res.json<ResultatRecherche>();
	expect(r.sources).toEqual([
		{ nom: "France Travail", ok: true },
		{ nom: "La bonne alternance", ok: true },
	]);
	expect(r.offres.map((o) => `${o.source}:${o.idSource}`)).toEqual([
		"France Travail:1",
		"France Travail:2",
		"La bonne alternance:b",
	]);
	expect(r.offres[2]).toMatchObject({
		lien: "https://exemple.test/b",
		dateDebut: "2027-09-01",
		datePublication: "2026-11-21",
	});
	const ft = new URL(appels.find((u) => u.includes("offresdemploi")) ?? "");
	expect(ft.searchParams.get("commune")).toBe("69123");
	expect(ft.searchParams.get("natureContrat")).toBe("E2,FS");
	const lba = new URL(appels.find((u) => u.includes("job/v1")) ?? "");
	expect(lba.searchParams.get("romes")).toBe("M1805");
	expect(lba.searchParams.get("latitude")).toBe("45.76");
	expect(lba.searchParams.get("radius")).toBe("20");
});

it("garde La bonne alternance quand France Travail ne répond pas", async () => {
	const cookie = await connecter("recherche-2@exemple.test");
	simuler({
		ft: new Response("panne", { status: 500 }),
		lba: [
			offreLBA("a", "France Travail", "Développeur web"),
			offreLBA("b", "Hellowork", "Boulanger"),
		],
	});
	const r = await (
		await api(cookie, "/recherche?motsCles=developpeur&ville=Lyon")
	).json<ResultatRecherche>();
	expect(r.sources[0]).toMatchObject({ nom: "France Travail", ok: false });
	// Sans codes ROME, seul l'intitulé qui contient le mot-clé reste, accents ignorés.
	expect(r.offres.map((o) => o.idSource)).toEqual(["a"]);
});

it("n'interroge pas La bonne alternance sans ville ni code ROME", async () => {
	const cookie = await connecter("recherche-3@exemple.test");
	const appels = simuler({ ft: new Response(null, { status: 204 }) });
	const r = await (
		await api(cookie, "/recherche?motsCles=astronaute")
	).json<ResultatRecherche>();
	expect(r.offres).toEqual([]);
	expect(r.sources[1]).toMatchObject({ ok: false });
	expect(appels.some((u) => u.includes("job/v1"))).toBe(false);
});

it("refuse une ville inconnue et une recherche sans connexion", async () => {
	const cookie = await connecter("recherche-4@exemple.test");
	simuler({});
	expect((await api(cookie, "/recherche?ville=Introuvable")).status).toBe(400);
	expect((await api(cookie, "/recherche?distance=999")).status).toBe(400);
	expect((await api("", "/recherche?motsCles=web")).status).toBe(401);
});
