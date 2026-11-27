import { afterEach, expect, it, vi } from "vitest";
import type { ResultatRecherche } from "../src/shared/schemas";
import { api, connecter } from "./outils";

const offreLBA = (id: string, title: string) => ({
	identifier: { id, partner_job_id: id, partner_label: "Hellowork" },
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

const prediction = [
	{
		metiersRome: [
			{
				codeRome: "M1805",
				libelleRome: "Études et développement informatique",
			},
			{
				codeRome: "M1805",
				libelleRome: "Études et développement informatique",
			},
			{ codeRome: "E1205", libelleRome: "Réalisation de contenus multimédias" },
		],
	},
];

// Simule les services externes et garde les URL et corps envoyés.
function simuler(reponses: { romeo?: Response; lba?: unknown[] }) {
	const appels: { url: string; corps?: string }[] = [];
	vi.spyOn(globalThis, "fetch").mockImplementation(async (entree, init) => {
		const url = String(entree);
		appels.push({ url, corps: init?.body?.toString() });
		if (url.startsWith("https://geo.api.gouv.fr"))
			return Response.json(
				url.includes("Introuvable")
					? []
					: [{ centre: { coordinates: [4.83, 45.76] } }],
			);
		if (url.includes("access_token"))
			return Response.json({ access_token: "jeton", expires_in: 1500 });
		if (url.includes("romeo"))
			return reponses.romeo?.clone() ?? Response.json(prediction);
		if (url.includes("apprentissage.beta.gouv.fr"))
			return Response.json({ jobs: reponses.lba ?? [], recruiters: [] });
		throw new Error(`appel inattendu ${url}`);
	});
	return appels;
}

afterEach(() => vi.restoreAllMocks());

it("cherche sur La bonne alternance avec les métiers reconnus par ROMEO", async () => {
	const cookie = await connecter("recherche-1@exemple.test");
	const appels = simuler({ lba: [offreLBA("b", "Développeur web")] });
	const res = await api(
		cookie,
		"/recherche?motsCles=d%C3%A9veloppeur%20web&ville=Lyon&distance=20",
	);
	expect(res.status).toBe(200);
	const r = await res.json<ResultatRecherche>();
	expect(r.sources).toEqual([{ nom: "La bonne alternance", ok: true }]);
	expect(r.metiers).toEqual([
		"Études et développement informatique",
		"Réalisation de contenus multimédias",
	]);
	expect(r.offres).toEqual([
		{
			source: "La bonne alternance",
			idSource: "b",
			intitule: "Développeur web",
			entreprise: "Atelier inventé",
			lieu: "Lyon",
			lien: "https://exemple.test/b",
			datePublication: "2026-11-21",
			dateDebut: "2027-09-01",
			description: "Description",
		},
	]);
	const romeo = appels.find((a) => a.url.includes("romeo"));
	expect(JSON.parse(romeo?.corps ?? "")).toMatchObject({
		appellations: [{ intitule: "développeur web" }],
	});
	const lba = new URL(appels.find((a) => a.url.includes("job/v1"))?.url ?? "");
	expect(lba.searchParams.get("romes")).toBe("M1805,E1205");
	expect(lba.searchParams.get("latitude")).toBe("45.76");
	expect(lba.searchParams.get("radius")).toBe("20");
});

it("filtre sur l'intitulé quand ROMEO ne répond pas", async () => {
	const cookie = await connecter("recherche-2@exemple.test");
	const appels = simuler({
		romeo: new Response("panne", { status: 500 }),
		lba: [offreLBA("a", "Développeur web"), offreLBA("b", "Boulanger")],
	});
	const r = await (
		await api(cookie, "/recherche?motsCles=developpeur&ville=Lyon")
	).json<ResultatRecherche>();
	expect(r.avertissement).toBeDefined();
	// Accents ignorés : « developpeur » trouve « Développeur ».
	expect(r.offres.map((o) => o.idSource)).toEqual(["a"]);
	const lba = new URL(appels.find((a) => a.url.includes("job/v1"))?.url ?? "");
	expect(lba.searchParams.has("romes")).toBe(false);
});

it("n'interroge pas La bonne alternance sans métier reconnu ni ville", async () => {
	const cookie = await connecter("recherche-3@exemple.test");
	const appels = simuler({ romeo: Response.json([{ metiersRome: [] }]) });
	const r = await (
		await api(cookie, "/recherche?motsCles=zzz")
	).json<ResultatRecherche>();
	expect(r.offres).toEqual([]);
	expect(r.sources[0]).toMatchObject({ ok: false });
	expect(appels.some((a) => a.url.includes("job/v1"))).toBe(false);
});

it("indique une source en panne sans planter", async () => {
	const cookie = await connecter("recherche-4@exemple.test");
	vi.spyOn(globalThis, "fetch").mockImplementation(async (entree) =>
		String(entree).includes("job/v1")
			? new Response("panne", { status: 502 })
			: Response.json([{ centre: { coordinates: [4.83, 45.76] } }]),
	);
	const r = await (
		await api(cookie, "/recherche?ville=Lyon")
	).json<ResultatRecherche>();
	expect(r.sources[0]).toMatchObject({
		ok: false,
		message: "Source indisponible pour le moment.",
	});
});

it("refuse une recherche invalide ou sans connexion", async () => {
	const cookie = await connecter("recherche-5@exemple.test");
	simuler({});
	expect((await api(cookie, "/recherche?ville=Introuvable")).status).toBe(400);
	expect((await api(cookie, "/recherche?distance=999")).status).toBe(400);
	expect((await api(cookie, "/recherche")).status).toBe(400);
	expect((await api("", "/recherche?motsCles=web")).status).toBe(401);
});
