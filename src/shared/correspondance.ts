import { normaliser } from "./schemas";

// Estimation de la correspondance entre le profil et une offre, à partir de critères lisibles.
// C'est une aide au tri, jamais une garantie : chaque critère explique ce qu'il a trouvé.

export type Critere = {
	nom: string;
	effet: "plus" | "moins" | "neutre";
	explication: string;
};
export type Correspondance = { score: number; criteres: Critere[] };

type ProfilValeurs = Record<string, string | undefined>;
type OffreComparee = {
	intitule: string;
	description: string;
	lieu: string;
	contrat?: string;
	dateDebut?: string;
};

// Mots trop courants pour dire quoi que ce soit d'une offre.
const vides = new Set(
	"les des une un pour avec dans sur par aux est son ses vos nos leur leurs qui que et ou en au du de la le h f hf alternance alternant alternante contrat stage emploi poste".split(
		" ",
	),
);

const mots = (s = "") =>
	normaliser(s)
		.split(" ")
		.filter((m) => m.length >= 3 && !vides.has(m));

// Une compétence ou un métier peut faire plusieurs mots : « gestion de projet ».
const expressions = (s = "") =>
	s
		.split(/[,;\n/]+/)
		.map((e) => normaliser(e))
		.filter((e) => e.length >= 2);

const contient = (texte: string, expression: string) =>
	` ${texte} `.includes(` ${expression} `);

const liste = (l: string[]) =>
	l.length > 4 ? `${l.slice(0, 4).join(", ")}…` : l.join(", ");

export function correspondance(
	p: ProfilValeurs,
	o: OffreComparee,
): Correspondance {
	const titre = normaliser(o.intitule);
	const texte = normaliser(`${o.intitule} ${o.description}`);
	const criteres: Critere[] = [];
	let points = 0;
	let max = 0;

	// Métier et mots-clés (poids 3).
	const recherches = [...expressions(p.metiers), ...expressions(p.motsCles)];
	if (recherches.length) {
		max += 3;
		const dansTitre = recherches.filter((e) =>
			mots(e).some((m) => contient(titre, m)),
		);
		const dansTexte = recherches.filter((e) => contient(texte, e));
		if (dansTitre.length) {
			points += 3;
			criteres.push({
				nom: "Métier et mots-clés",
				effet: "plus",
				explication: `L'intitulé correspond à : ${liste(dansTitre)}.`,
			});
		} else if (dansTexte.length) {
			points += 1.5;
			criteres.push({
				nom: "Métier et mots-clés",
				effet: "plus",
				explication: `L'offre mentionne : ${liste(dansTexte)}, mais pas dans l'intitulé.`,
			});
		} else
			criteres.push({
				nom: "Métier et mots-clés",
				effet: "moins",
				explication:
					"Aucun de vos métiers ou mots-clés n'apparaît dans l'offre.",
			});
	}

	// Compétences (poids 3) : part de vos compétences citées dans l'offre.
	const competences = expressions(p.competences);
	if (competences.length) {
		max += 3;
		const trouvees = competences.filter((e) => contient(texte, e));
		points +=
			3 * Math.min(1, trouvees.length / Math.min(3, competences.length));
		criteres.push(
			trouvees.length
				? {
						nom: "Compétences",
						effet: "plus",
						explication: `L'offre cite : ${liste(trouvees)}.`,
					}
				: {
						nom: "Compétences",
						effet: "moins",
						explication: "L'offre ne cite aucune de vos compétences.",
					},
		);
	}

	// Formation et niveau (poids 1).
	const formation = [...mots(p.formation), ...mots(p.diplome)];
	if (formation.length) {
		max += 1;
		const trouves = [...new Set(formation.filter((m) => contient(texte, m)))];
		if (trouves.length) points += 1;
		criteres.push({
			nom: "Formation et niveau",
			effet: trouves.length ? "plus" : "neutre",
			explication: trouves.length
				? `L'offre mentionne : ${liste(trouves)}.`
				: "L'offre ne mentionne pas votre formation (souvent non précisée).",
		});
	}

	// Lieu et mode de travail (poids 2).
	const villes = [p.ville, p.localisation]
		.map((v) => normaliser(v ?? ""))
		.filter(Boolean);
	const lieu = normaliser(o.lieu);
	if (villes.length && lieu) {
		max += 2;
		const proche = villes.some((v) => contient(lieu, v) || contient(v, lieu));
		if (proche) points += 2;
		criteres.push({
			nom: "Lieu",
			effet: proche ? "plus" : "neutre",
			explication: proche
				? `L'offre est à ${o.lieu}, comme indiqué dans votre profil.`
				: `L'offre est à ${o.lieu} : vérifiez la distance.`,
		});
	}
	if (p.teletravail === "Télétravail complet") {
		const distanciel = /teletravail|remote|distance/.test(texte);
		criteres.push({
			nom: "Mode de travail",
			effet: distanciel ? "plus" : "moins",
			explication: distanciel
				? "L'offre parle de télétravail."
				: "Vous cherchez du télétravail complet ; l'offre n'en parle pas.",
		});
	}

	// Type de contrat et dates (poids 1).
	if (p.typeRecherche && o.contrat) {
		max += 1;
		const memeType =
			normaliser(p.typeRecherche) === normaliser(o.contrat) ||
			(p.typeRecherche === "Emploi" && /^(cdi|cdd)$/i.test(o.contrat));
		if (memeType) points += 1;
		criteres.push({
			nom: "Type de contrat",
			effet: memeType ? "plus" : "moins",
			explication: memeType
				? `Contrat : ${o.contrat}, ce que vous recherchez.`
				: `Contrat : ${o.contrat}, alors que vous recherchez : ${p.typeRecherche}.`,
		});
	}
	if (p.dateDebut && o.dateDebut) {
		const ecart =
			Math.abs(
				new Date(o.dateDebut).getTime() - new Date(p.dateDebut).getTime(),
			) / 86_400_000;
		criteres.push({
			nom: "Date de début",
			effet: ecart <= 45 ? "plus" : "moins",
			explication:
				ecart <= 45
					? "La date de début est proche de celle que vous souhaitez."
					: "La date de début est éloignée de celle que vous souhaitez.",
		});
	}

	return { score: max ? Math.round((100 * points) / max) : 0, criteres };
}
