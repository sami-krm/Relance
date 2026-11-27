import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { offre } from "../db/schema";
import { bd } from "./session";

const LBA_OFFRE = "https://api.apprentissage.beta.gouv.fr/api/job/v1/offer";

// Offres vérifiées par passage : l'offre gratuite limite à 50 les appels sortants par exécution.
const PAR_PASSAGE = 30;

// Seules les offres stockées par La bonne alternance ont un identifiant chez elle (24 caractères hexadécimaux) ;
// les offres France Travail qu'elle relaie n'en ont pas et ne peuvent pas être vérifiées.
// shortcut: reconnaît l'identifiant à sa forme, à revoir si La bonne alternance change de format.
export const verifiable = (sourceId: string) =>
	/^[0-9a-f]{24}$/i.test(sourceId);

type Etat = "active" | "expiree" | "inconnu";

async function etatOffre(
	env: Env,
	sourceId: string,
	aujourdhui: string,
): Promise<Etat> {
	const res = await fetch(`${LBA_OFFRE}/${sourceId}`, {
		headers: { authorization: `Bearer ${env.LBA_API_TOKEN}` },
	});
	// Offre retirée de La bonne alternance.
	if (res.status === 404) return "expiree";
	if (!res.ok) return "inconnu";
	const { offer } = await res.json<{
		offer: { status: string; publication: { expiration: string | null } };
	}>();
	const date = offer.publication.expiration?.slice(0, 10);
	return offer.status !== "Active" || (date && date < aujourdhui)
		? "expiree"
		: "active";
}

// Chaque matin, signale les offres ajoutées depuis la recherche que leur source dit pourvues, annulées ou expirées.
export async function verifierExpirations(env: Env, aujourdhui: string) {
	const db = bd(env);
	const candidates = await db
		.select({ id: offre.id, sourceId: offre.sourceId })
		.from(offre)
		.where(
			and(
				eq(offre.source, "La bonne alternance"),
				eq(offre.expiree, false),
				// Écarte en SQL les offres non vérifiables, qui resteraient sinon en tête de file.
				sql`length(${offre.sourceId}) = 24`,
			),
		)
		.orderBy(asc(offre.verifieeLe))
		.limit(PAR_PASSAGE);
	const aVerifier = candidates.filter((o) => verifiable(o.sourceId));
	if (!aVerifier.length) return;

	const etats = await Promise.all(
		aVerifier.map((o) =>
			etatOffre(env, o.sourceId, aujourdhui).catch((): Etat => "inconnu"),
		),
	);
	const ids = (etat: Etat) =>
		aVerifier.filter((_, i) => etats[i] === etat).map((o) => o.id);
	const verifiees = [...ids("active"), ...ids("expiree")];
	if (verifiees.length)
		await db
			.update(offre)
			.set({ verifieeLe: aujourdhui })
			.where(inArray(offre.id, verifiees));
	const expirees = ids("expiree");
	if (expirees.length)
		await db
			.update(offre)
			.set({ expiree: true })
			.where(inArray(offre.id, expirees));
}
