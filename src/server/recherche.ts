import { Hono } from "hono";
import {
	type OffreTrouvee,
	type ResultatRecherche,
	rechercheSchema,
	type SourceOffres,
} from "../shared/schemas";
import { type Contexte, exigerSession } from "./session";

const FT_JETON =
	"https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire";
const FT_OFFRES =
	"https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search";
const LBA_OFFRES = "https://api.apprentissage.beta.gouv.fr/api/job/v1/search";
const GEO = "https://geo.api.gouv.fr/communes";

type Commune = { code: string; latitude: number; longitude: number };

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
			scope: "api_offresdemploiv2 o2dsoffre",
		}),
	});
	if (!res.ok) throw new Error(`jeton ${res.status}`);
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

type OffreFT = {
	id: string;
	intitule: string;
	description?: string;
	dateCreation?: string;
	romeCode?: string;
	lieuTravail?: { libelle?: string };
	entreprise?: { nom?: string };
	origineOffre?: { urlOrigine?: string };
};

async function franceTravail(
	env: Env,
	motsCles: string,
	commune: Commune | undefined,
	distance: number,
) {
	const params = new URLSearchParams({
		range: "0-49",
		// Contrat d'apprentissage et contrat de professionnalisation.
		natureContrat: "E2,FS",
	});
	if (motsCles) params.set("motsCles", motsCles);
	if (commune) {
		params.set("commune", commune.code);
		params.set("distance", String(distance));
	}
	const res = await fetch(`${FT_OFFRES}?${params}`, {
		headers: {
			authorization: `Bearer ${await jetonFranceTravail(env)}`,
			accept: "application/json",
		},
	});
	if (res.status === 204) return [];
	if (!res.ok) throw new Error(`offres ${res.status}`);
	const { resultats = [] } = await res.json<{ resultats?: OffreFT[] }>();
	return resultats;
}

const depuisFT = (o: OffreFT): OffreTrouvee => ({
	source: "France Travail",
	idSource: o.id,
	intitule: o.intitule,
	entreprise: o.entreprise?.nom ?? "",
	lieu: o.lieuTravail?.libelle ?? "",
	lien:
		o.origineOffre?.urlOrigine ??
		`https://candidat.francetravail.fr/offres/recherche/detail/${o.id}`,
	datePublication: o.dateCreation?.slice(0, 10) ?? "",
	dateDebut: "",
	description: o.description ?? "",
});

type OffreLBA = {
	identifier: {
		id: string | null;
		partner_job_id: string;
		partner_label: string;
	};
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
	const { jobs = [] } = await res.json<{ jobs?: OffreLBA[] }>();
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
		fields: "code,centre",
		boost: "population",
		limit: "1",
	});
	const res = await fetch(`${GEO}?${params}`);
	if (!res.ok) throw new Error(`commune ${res.status}`);
	const [c] =
		await res.json<
			{ code: string; centre: { coordinates: [number, number] } }[]
		>();
	return (
		c && {
			code: c.code,
			longitude: c.centre.coordinates[0],
			latitude: c.centre.coordinates[1],
		}
	);
}

// Codes ROME les plus fréquents parmi les offres France Travail : La bonne alternance ne cherche pas par mots-clés.
function romesFrequents(offres: OffreFT[]) {
	const n = new Map<string, number>();
	for (const o of offres)
		if (o.romeCode) n.set(o.romeCode, (n.get(o.romeCode) ?? 0) + 1);
	return [...n]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 3)
		.map(([r]) => r);
}

const motsDe = (s: string) =>
	s
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.split(/[^a-z0-9]+/)
		.filter(Boolean);

const indisponible = (nom: SourceOffres, e: unknown) => {
	console.error(`recherche ${nom}`, e);
	return { nom, ok: false, message: "Source indisponible pour le moment." };
};

export const routesRecherche = new Hono<Contexte>()
	.use(exigerSession)
	.get("/", async (c) => {
		const r = rechercheSchema.safeParse(c.req.query());
		if (!r.success) return c.json({ message: "Recherche invalide." }, 400);
		const { motsCles, ville, distance } = r.data;
		let commune: Commune | undefined;
		if (ville) {
			commune = await trouverCommune(ville).catch(() => undefined);
			if (!commune)
				return c.json({ message: `Ville introuvable : « ${ville} ».` }, 400);
		}
		const sources: ResultatRecherche["sources"] = [];

		let ft: OffreFT[] = [];
		let ftOk = false;
		try {
			ft = await franceTravail(c.env, motsCles, commune, distance);
			ftOk = true;
			sources.push({ nom: "France Travail", ok: true });
		} catch (e) {
			sources.push(indisponible("France Travail", e));
		}

		let lba: OffreTrouvee[] = [];
		const romes = romesFrequents(ft);
		// Sans code ROME ni lieu, La bonne alternance renverrait toute la France sans rapport avec la recherche.
		if (romes.length || commune) {
			try {
				lba = (await bonneAlternance(c.env, romes, commune, distance))
					// Les offres France Travail reprises par La bonne alternance sont déjà dans la liste.
					.filter(
						(o) =>
							!(ftOk && /france travail/i.test(o.identifier.partner_label)),
					)
					.map(depuisLBA);
				// Sans codes ROME, on garde les offres dont l'intitulé contient un des mots-clés.
				const mots = motsDe(motsCles);
				if (!romes.length && mots.length)
					lba = lba.filter((o) =>
						motsDe(o.intitule).some((m) => mots.includes(m)),
					);
				sources.push({ nom: "La bonne alternance", ok: true });
			} catch (e) {
				sources.push(indisponible("La bonne alternance", e));
			}
		} else
			sources.push({
				nom: "La bonne alternance",
				ok: false,
				message: "Indiquez une ville pour chercher sur cette source.",
			});

		return c.json<ResultatRecherche>({
			offres: [...ft.map(depuisFT), ...lba],
			sources,
		});
	});
