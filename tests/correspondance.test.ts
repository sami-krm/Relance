import { expect, it } from "vitest";
import { correspondance } from "../src/shared/correspondance";

const profil = {
	metiers: "Développeur web",
	motsCles: "front-end",
	competences: "React, TypeScript, SQL, gestion de projet",
	formation: "BUT informatique",
	ville: "Lyon",
	typeRecherche: "Alternance",
	dateDebut: "2027-09-01",
};

it("explique une bonne correspondance", () => {
	const r = correspondance(profil, {
		intitule: "Alternance développeur React (H/F)",
		description:
			"Vous travaillerez en TypeScript et React. Formation en informatique.",
		lieu: "69001 Lyon",
		contrat: "Alternance",
		dateDebut: "2027-09-15",
	});
	expect(r.score).toBeGreaterThanOrEqual(80);
	expect(r.criteres.map((c) => [c.nom, c.effet])).toEqual([
		["Métier et mots-clés", "plus"],
		["Compétences", "plus"],
		["Formation et niveau", "plus"],
		["Lieu", "plus"],
		["Type de contrat", "plus"],
		["Date de début", "plus"],
	]);
	expect(r.criteres[1].explication).toContain("react");
});

it("signale ce qui diminue la correspondance", () => {
	const r = correspondance(profil, {
		intitule: "Boulanger (H/F)",
		description: "Fabrication du pain et des viennoiseries.",
		lieu: "Marseille",
		contrat: "CDI",
	});
	expect(r.score).toBeLessThan(20);
	expect(r.criteres.find((c) => c.nom === "Type de contrat")?.effet).toBe(
		"moins",
	);
	expect(r.criteres.find((c) => c.nom === "Lieu")?.explication).toContain(
		"Marseille",
	);
});

it("ne donne pas de score sans profil renseigné", () => {
	expect(
		correspondance({}, { intitule: "Poste", description: "", lieu: "" }),
	).toEqual({ score: 0, criteres: [] });
});

it("ne confond pas un mot avec une partie de mot", () => {
	const r = correspondance(
		{ competences: "SQL" },
		{ intitule: "Poste", description: "PostgreSQLite avancé", lieu: "" },
	);
	expect(r.criteres[0].effet).toBe("moins");
});
