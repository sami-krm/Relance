import { expect, it } from "vitest";
import { statistiques } from "../src/shared/statistiques";

// Jeudi 26 novembre 2026 : la semaine commence le lundi 23.
const aujourdhui = "2026-11-26";

it("calcule les chiffres du tableau de bord", () => {
	const s = statistiques(
		[
			{ statut: "brouillon", dateEnvoi: "" },
			{ statut: "envoyee", dateEnvoi: "2026-11-23" },
			{ statut: "entretien", dateEnvoi: "2026-11-22" },
			{ statut: "refusee", dateEnvoi: "2026-10-30" },
			{ statut: "abandonnee", dateEnvoi: "2026-11-02" },
			{ statut: "brouillon", dateEnvoi: "2026-11-24" },
		],
		[
			{ type: "entretien", date: "2026-11-30", statut: "a_faire" },
			{ type: "entretien", date: "2026-11-20", statut: "a_faire" },
			{ type: "relance", date: "2026-11-26", statut: "a_faire" },
			{ type: "relance", date: "2026-11-26", statut: "fait" },
		],
		aujourdhui,
	);
	expect(s).toMatchObject({
		enCours: 2,
		envoyeesSemaine: 1,
		envoyeesMois: 3,
		entretiensAVenir: 1,
		rappelsDuJour: 1,
		rappelsEnRetard: 1,
		reponses: 2,
		tauxReponse: 50,
	});
	expect(s.parStatut.find((p) => p.statut === "brouillon")?.nombre).toBe(2);
});

it("ne donne pas de taux de réponse sans candidature envoyée", () => {
	expect(statistiques([], [], aujourdhui).tauxReponse).toBeNull();
});

it("commence la semaine le lundi, même un dimanche", () => {
	const s = statistiques(
		[
			{ statut: "envoyee", dateEnvoi: "2026-11-23" },
			{ statut: "envoyee", dateEnvoi: "2026-11-22" },
		],
		[],
		"2026-11-29",
	);
	expect(s.envoyeesSemaine).toBe(1);
});
