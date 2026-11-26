import { ajouterJours, type Statut, statuts } from "./schemas";

type C = { statut: Statut; dateEnvoi: string };
type R = { type: string; date: string; statut: string };

const enCours: Statut[] = ["envoyee", "reponse", "entretien", "offre"];
const avecReponse: Statut[] = ["reponse", "entretien", "offre", "refusee"];

// Chiffres du tableau de bord, calculés uniquement à partir des données du compte.
export function statistiques(
	candidatures: C[],
	rappels: R[],
	aujourdhui: string,
) {
	const jour = new Date(`${aujourdhui}T00:00:00Z`).getUTCDay();
	const lundi = ajouterJours(aujourdhui, -((jour + 6) % 7));
	const envoyees = candidatures.filter((c) => c.statut !== "brouillon");
	const reponses = candidatures.filter((c) => avecReponse.includes(c.statut));
	const aFaire = rappels.filter((r) => r.statut === "a_faire");
	return {
		enCours: candidatures.filter((c) => enCours.includes(c.statut)).length,
		envoyeesSemaine: candidatures.filter(
			(c) => c.dateEnvoi >= lundi && c.dateEnvoi <= aujourdhui,
		).length,
		envoyeesMois: candidatures.filter((c) =>
			c.dateEnvoi.startsWith(aujourdhui.slice(0, 7)),
		).length,
		entretiensAVenir: aFaire.filter(
			(r) => r.type === "entretien" && r.date >= aujourdhui,
		).length,
		rappelsDuJour: aFaire.filter((r) => r.date === aujourdhui).length,
		rappelsEnRetard: aFaire.filter((r) => r.date < aujourdhui).length,
		reponses: reponses.length,
		// null tant que rien n'est envoyé : pas de taux inventé.
		tauxReponse: envoyees.length
			? Math.round((100 * reponses.length) / envoyees.length)
			: null,
		parStatut: statuts.map((s) => ({
			statut: s,
			nombre: candidatures.filter((c) => c.statut === s).length,
		})),
	};
}
