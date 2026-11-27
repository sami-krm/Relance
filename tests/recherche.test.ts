import { afterEach, expect, it, vi } from "vitest";
import { lireSansRecruteurs } from "../src/server/recherche";
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
	expect((await api(cookie, "/recherche?distance=999")).status).toBe(400);
	expect((await api(cookie, "/recherche")).status).toBe(400);
	expect((await api("", "/recherche?motsCles=web")).status).toBe(401);
});

it("ignore les entreprises jointes à la réponse sans perdre les offres", () => {
	const jobs = [{ offer: { title: 'Titre avec \\"recruiters\\":[ dedans' } }];
	const apres = JSON.stringify({ jobs, recruiters: [{ a: 1 }], warnings: [] });
	expect(lireSansRecruteurs(apres)).toEqual({ jobs });
	// Ordre inattendu : décodage complet.
	const avant = JSON.stringify({ recruiters: [], jobs });
	expect(lireSansRecruteurs(avant).jobs).toEqual(jobs);
});

const trouvee = {
	source: "La bonne alternance",
	idSource: "lba-1",
	intitule: "Développeur web (H/F)",
	entreprise: "Atelier inventé",
	lieu: "41 rue inventée 69001 Lyon",
	lien: "https://exemple.test/lba-1",
	datePublication: "2026-11-21",
	dateDebut: "2027-09-01",
	description: "Description",
};

it("ajoute une offre trouvée en un clic, avec son entreprise, une seule fois", async () => {
	const cookie = await connecter("recherche-ajout@exemple.test");
	const ajouter = (o: unknown) =>
		api(cookie, "/recherche/offres", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(o),
		});
	expect((await ajouter(trouvee)).status).toBe(201);
	const offres = await (await api(cookie, "/offres")).json<
		{
			intitule: string;
			source: string;
			sourceId: string;
			contrat: string;
			entrepriseId: string;
		}[]
	>();
	expect(offres).toMatchObject([
		{
			intitule: "Développeur web (H/F)",
			source: "La bonne alternance",
			sourceId: "lba-1",
			contrat: "Alternance",
		},
	]);
	// Même identifiant à la source : refusé.
	expect((await ajouter(trouvee)).status).toBe(409);
	// Autre identifiant, mais même entreprise, même intitulé, même ville : refusé aussi.
	const reprise = {
		...trouvee,
		idSource: "lba-2",
		entreprise: "ATELIER INVENTÉ",
		lieu: "Lyon",
	};
	expect((await ajouter(reprise)).status).toBe(409);
	// Autre poste dans la même entreprise : l'entreprise existante est reprise.
	const autre = { ...trouvee, idSource: "lba-3", intitule: "Data analyst" };
	expect((await ajouter(autre)).status).toBe(201);
	const entreprises = await (await api(cookie, "/entreprises")).json<
		unknown[]
	>();
	expect(entreprises).toHaveLength(1);
	expect(
		(await ajouter({ ...trouvee, lien: "javascript:alert(1)" })).status,
	).toBe(400);
});

it("ne montre qu'une fois une annonce publiée deux fois", async () => {
	const cookie = await connecter("recherche-doublon@exemple.test");
	simuler({
		lba: [offreLBA("a", "Développeur web"), offreLBA("b", "Développeur web")],
	});
	const r = await (
		await api(cookie, "/recherche?motsCles=web&ville=Lyon")
	).json<ResultatRecherche>();
	expect(r.offres.map((o) => o.idSource)).toEqual(["a"]);
});

it("cherche dans toute la France quand la ville n'est pas reconnue", async () => {
	const cookie = await connecter("recherche-ville@exemple.test");
	const appels = simuler({ lba: [offreLBA("a", "Développeur web")] });
	const res = await api(
		cookie,
		"/recherche?motsCles=web&ville=Peu%20importe%20Introuvable",
	);
	expect(res.status).toBe(200);
	const r = await res.json<ResultatRecherche>();
	expect(r.avertissement).toContain("non reconnue");
	expect(r.offres).toHaveLength(1);
	const lba = new URL(appels.find((a) => a.url.includes("job/v1"))?.url ?? "");
	expect(lba.searchParams.has("latitude")).toBe(false);
	expect(lba.searchParams.get("romes")).toBe("M1805,E1205");
});

it("enregistre, liste et supprime des recherches, propres à chaque compte", async () => {
	const cookie = await connecter("recherches-1@exemple.test");
	const autre = await connecter("recherches-2@exemple.test");
	const envoyer = (c: string, corps: unknown) =>
		api(c, "/recherches", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(corps),
		});
	const res = await envoyer(cookie, {
		nom: "Web à Lyon",
		motsCles: "développeur web",
		ville: "Lyon",
		distance: 20,
		debut: "2027-09-01",
	});
	expect(res.status).toBe(201);
	const { id } = await res.json<{ id: string }>();
	expect(await (await api(cookie, "/recherches")).json()).toMatchObject([
		{ id, nom: "Web à Lyon", motsCles: "développeur web", distance: 20 },
	]);
	expect(await (await api(autre, "/recherches")).json()).toEqual([]);
	expect(
		(await api(autre, `/recherches/${id}`, { method: "DELETE" })).status,
	).toBe(404);
	expect((await envoyer(cookie, { nom: "" })).status).toBe(400);
	expect((await envoyer(cookie, { nom: "x", distance: 999 })).status).toBe(400);
	expect(
		(await api(cookie, `/recherches/${id}`, { method: "DELETE" })).status,
	).toBe(204);
	expect(await (await api(cookie, "/recherches")).json()).toEqual([]);
});

it("ajoute une offre dont l'employeur reste anonyme", async () => {
	const cookie = await connecter("recherche-anonyme@exemple.test");
	const anonyme = offreLBA("anon", "Développeur web");
	anonyme.workplace.name = null as unknown as string;
	simuler({ lba: [anonyme] });
	const r = await (
		await api(cookie, "/recherche?motsCles=web&ville=Lyon")
	).json<ResultatRecherche>();
	expect(r.offres[0].entreprise).toBe("Entreprise non communiquée");
	vi.restoreAllMocks();
	const res = await api(cookie, "/recherche/offres", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(r.offres[0]),
	});
	expect(res.status).toBe(201);
});
