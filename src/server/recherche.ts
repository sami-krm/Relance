import { Hono } from "hono";
import {
	type OffreTrouvee,
	type ResultatRecherche,
	rechercheSchema,
} from "../shared/schemas";
import { type Contexte, exigerSession } from "./session";

const FT_JETON =
	"https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire";
const ROMEO =
	"https://api.francetravail.io/partenaire/romeo/v2/predictionMetiers";
const LBA_OFFRES = "https://api.apprentissage.beta.gouv.fr/api/job/v1/search";
const GEO = "https://geo.api.gouv.fr/communes";

type Commune = { latitude: number; longitude: number };

// Jeton France Travail gardé en mémoire de l'isolat jusqu'à une minute avant son expiration.
let jetonFT: { valeur: string; expire: number } | undefined;

async function jetonFranceTravail(env: Env) {
	if (jetonFT && jetonFT.expire > Date.now()) return jetonFT.valeur;
	const res = await fetch(FT_JETON, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "client_credentials",
			client_id: env.FRANCE_TRAVAIL_CLIENT_ID,
			client_secret: env.FRANCE_TRAVAIL_CLIENT_SECRET,
			scope: "api_romeov2",
		}),
	});
	// La réponse d'erreur OAuth (error, error_description) ne contient pas de secret.
	if (!res.ok)
		throw new Error(`jeton ${res.status} ${(await res.text()).slice(0, 200)}`);
	const { access_token, expires_in } = await res.json<{
		access_token: string;
		expires_in: number;
	}>();
	jetonFT = {
		valeur: access_token,
		expire: Date.now() + (expires_in - 60) * 1000,
	};
	return access_token;
}

// ROMEO (France Travail) traduit les mots-clés en métiers du ROME : La bonne alternance ne cherche pas par mots-clés.
async function metiersRome(env: Env, motsCles: string) {
	const res = await fetch(ROMEO, {
		method: "POST",
		headers: {
			authorization: `Bearer ${await jetonFranceTravail(env)}`,
			"content-type": "application/json",
			accept: "application/json",
		},
		body: JSON.stringify({
			appellations: [{ intitule: motsCles, identifiant: "1" }],
			options: { nomAppelant: "relance", nbResultats: 3 },
		}),
	});
	if (!res.ok) throw new Error(`romeo ${res.status}`);
	const [prediction] =
		await res.json<
			{ metiersRome?: { codeRome: string; libelleRome: string }[] }[]
		>();
	// Plusieurs appellations peuvent appartenir au même métier.
	return [
		...new Map(
			(prediction?.metiersRome ?? []).map((m) => [m.codeRome, m.libelleRome]),
		),
	];
}

type OffreLBA = {
	identifier: { id: string | null; partner_job_id: string };
	workplace: {
		name: string | null;
		legal_name: string | null;
		location: { address: string };
	};
	apply: { url: string };
	contract: { start: string | null };
	offer: {
		title: string;
		description: string;
		publication: { creation: string | null };
	};
};

async function bonneAlternance(
	env: Env,
	romes: string[],
	commune: Commune | undefined,
	distance: number,
) {
	const params = new URLSearchParams();
	if (romes.length) params.set("romes", romes.join(","));
	if (commune) {
		params.set("latitude", String(commune.latitude));
		params.set("longitude", String(commune.longitude));
		params.set("radius", String(distance));
	}
	const res = await fetch(`${LBA_OFFRES}?${params}`, {
		headers: { authorization: `Bearer ${env.LBA_API_TOKEN}` },
	});
	if (!res.ok) throw new Error(`offres ${res.status}`);
	const texte = await res.text();
	const { jobs = [], recruiters = [] } = JSON.parse(texte) as {
		jobs?: OffreLBA[];
		recruiters?: unknown[];
	};
	// Diagnostic temporaire du coût CPU : à retirer une fois mesuré.
	console.log("lba", {
		octets: texte.length,
		jobs: jobs.length,
		recruiters: recruiters.length,
	});
	return jobs;
}

const depuisLBA = (o: OffreLBA): OffreTrouvee => ({
	source: "La bonne alternance",
	idSource: o.identifier.id ?? o.identifier.partner_job_id,
	intitule: o.offer.title,
	entreprise: o.workplace.name ?? o.workplace.legal_name ?? "",
	lieu: o.workplace.location.address,
	lien: o.apply.url,
	datePublication: o.offer.publication.creation?.slice(0, 10) ?? "",
	dateDebut: o.contract.start?.slice(0, 10) ?? "",
	description: o.offer.description,
});

async function trouverCommune(ville: string): Promise<Commune | undefined> {
	const params = new URLSearchParams({
		nom: ville,
		fields: "centre",
		boost: "population",
		limit: "1",
	});
	const res = await fetch(`${GEO}?${params}`);
	if (!res.ok) throw new Error(`commune ${res.status}`);
	const [c] = await res.json<{ centre: { coordinates: [number, number] } }[]>();
	return (
		c && {
			longitude: c.centre.coordinates[0],
			latitude: c.centre.coordinates[1],
		}
	);
}

const motsDe = (s: string) =>
	s
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.split(/[^a-z0-9]+/)
		.filter(Boolean);

export const routesRecherche = new Hono<Contexte>()
	.use(exigerSession)
	.get("/", async (c) => {
		const r = rechercheSchema.safeParse(c.req.query());
		if (!r.success) return c.json({ message: "Recherche invalide." }, 400);
		const { motsCles, ville, distance } = r.data;
		if (!motsCles && !ville)
			return c.json({ message: "Indiquez des mots-clés ou une ville." }, 400);

		let commune: Commune | undefined;
		if (ville) {
			commune = await trouverCommune(ville).catch(() => undefined);
			if (!commune)
				return c.json({ message: `Ville introuvable : « ${ville} ».` }, 400);
		}

		let metiers: [string, string][] = [];
		let avertissement: string | undefined;
		if (motsCles)
			try {
				metiers = await metiersRome(c.env, motsCles);
			} catch (e) {
				console.error("recherche ROMEO", e);
				avertissement =
					"Les métiers n'ont pas pu être reconnus : seuls les intitulés contenant vos mots-clés sont affichés.";
			}
		// Sans métier ni lieu, La bonne alternance renverrait toute la France sans rapport avec la recherche.
		if (!metiers.length && !commune)
			return c.json<ResultatRecherche>({
				offres: [],
				metiers: [],
				sources: [
					{
						nom: "La bonne alternance",
						ok: false,
						message:
							"Aucun métier reconnu : précisez les mots-clés ou indiquez une ville.",
					},
				],
				avertissement,
			});

		try {
			let offres = (
				await bonneAlternance(
					c.env,
					metiers.map(([code]) => code),
					commune,
					distance,
				)
			).map(depuisLBA);
			const mots = motsDe(motsCles);
			if (!metiers.length && mots.length)
				offres = offres.filter((o) =>
					motsDe(o.intitule).some((m) => mots.includes(m)),
				);
			return c.json<ResultatRecherche>({
				offres,
				metiers: metiers.map(([, libelle]) => libelle),
				sources: [{ nom: "La bonne alternance", ok: true }],
				avertissement,
			});
		} catch (e) {
			console.error("recherche La bonne alternance", e);
			return c.json<ResultatRecherche>({
				offres: [],
				metiers: metiers.map(([, libelle]) => libelle),
				sources: [
					{
						nom: "La bonne alternance",
						ok: false,
						message: "Source indisponible pour le moment.",
					},
				],
				avertissement,
			});
		}
	});
