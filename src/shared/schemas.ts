import { z } from "zod";

type Champ = {
	cle: string;
	libelle: string;
	type?: "texte" | "long" | "tel" | "url" | "date" | "nombre" | "choix";
	options?: readonly string[];
};

// Une seule définition du profil : elle sert à la validation dans l'API et au formulaire.
export const sectionsProfil: { titre: string; champs: Champ[] }[] = [
	{
		titre: "Identité et coordonnées",
		champs: [
			{ cle: "nom", libelle: "Nom et prénom" },
			{ cle: "telephone", libelle: "Téléphone", type: "tel" },
			{ cle: "ville", libelle: "Ville" },
			{ cle: "lien", libelle: "LinkedIn ou portfolio", type: "url" },
		],
	},
	{
		titre: "Formation",
		champs: [
			{ cle: "ecole", libelle: "École" },
			{ cle: "formation", libelle: "Formation" },
			{ cle: "diplome", libelle: "Diplôme préparé" },
			{ cle: "anneeEtude", libelle: "Année d'étude" },
		],
	},
	{
		titre: "Alternance",
		champs: [
			{
				cle: "rythme",
				libelle:
					"Rythme (par exemple 3 semaines en entreprise, 1 semaine à l'école)",
			},
			{ cle: "dateDebut", libelle: "Date de début souhaitée", type: "date" },
			{ cle: "dureeContrat", libelle: "Durée du contrat" },
		],
	},
	{
		titre: "Recherche",
		champs: [
			{
				cle: "typeRecherche",
				libelle: "Type de recherche",
				type: "choix",
				options: ["Alternance", "Stage", "Emploi", "Job étudiant", "Autre"],
			},
			{ cle: "metiers", libelle: "Métiers recherchés" },
			{ cle: "secteurs", libelle: "Secteurs" },
			{ cle: "motsCles", libelle: "Mots-clés" },
			{ cle: "localisation", libelle: "Localisation" },
			{ cle: "distanceMax", libelle: "Distance maximale (km)", type: "nombre" },
			{
				cle: "teletravail",
				libelle: "Télétravail",
				type: "choix",
				options: ["Sur place", "Hybride", "Télétravail complet", "Indifférent"],
			},
			{ cle: "remuneration", libelle: "Rémunération souhaitée (facultatif)" },
		],
	},
	{
		titre: "Parcours",
		champs: [
			{ cle: "competences", libelle: "Compétences", type: "long" },
			{ cle: "experiences", libelle: "Expériences", type: "long" },
			{ cle: "projets", libelle: "Projets", type: "long" },
		],
	},
];

const champs = sectionsProfil.flatMap((s) => s.champs);
const vide = z.literal("");

function valeur(c: Champ) {
	switch (c.type) {
		case "long":
			return z.string().max(5000);
		case "choix":
			return z.enum(["", ...(c.options ?? [])]);
		case "nombre":
			return z.string().regex(/^\d{0,4}$/);
		case "date":
			return vide.or(z.iso.date());
		case "url":
			return vide.or(z.url({ protocol: /^https?$/ }).max(300));
		default:
			return z.string().trim().max(200);
	}
}

// « email » vient du compte : seul son partage se règle dans le profil.
export const clesPartageables = ["email", ...champs.map((c) => c.cle)];

export const profilSchema = z.object({
	valeurs: z.object(
		Object.fromEntries(champs.map((c) => [c.cle, valeur(c).optional()])),
	),
	partages: z.array(z.enum(clesPartageables)).max(clesPartageables.length),
});
export type Profil = { valeurs: Record<string, string>; partages: string[] };

export const TAILLE_MAX_CV = 5 * 1024 * 1024;
export const nomDocument = z.string().trim().min(1).max(120);
const contenu = z.string().max(20000);

export const nouveauTexteSchema = z.object({
	type: z.enum(["lettre", "reponse"]),
	nom: nomDocument,
	contenu,
});
export const modificationDocumentSchema = z.object({
	nom: nomDocument.optional(),
	contenu: contenu.optional(),
	parDefaut: z.literal(true).optional(),
});

export type Document = {
	id: string;
	type: "cv" | "lettre" | "reponse";
	nom: string;
	taille: number | null;
	contenu: string | null;
	parDefaut: boolean;
	createdAt: string;
};

// Entreprises, contacts et offres : chaînes vides plutôt que null, pour des formulaires simples.
const requis = z.string().trim().min(1).max(200);
const texte = (max = 200) => z.string().trim().max(max).default("");
const lienWeb = vide.or(z.url({ protocol: /^https?$/ }).max(300)).default("");
const dateOuVide = vide.or(z.iso.date()).default("");

export const typesContrat = [
	"Alternance",
	"Stage",
	"CDI",
	"CDD",
	"Job étudiant",
	"Autre",
] as const;

export const entrepriseSchema = z.object({
	nom: requis,
	ville: texte(),
	site: lienWeb,
	secteur: texte(),
	notes: texte(5000),
});
export const contactSchema = z.object({
	entrepriseId: z.string().min(1),
	nom: requis,
	role: texte(),
	email: vide.or(z.email().max(200)).default(""),
	telephone: texte(40),
	linkedin: lienWeb,
	notes: texte(5000),
});
export const offreSchema = z.object({
	entrepriseId: z.string().min(1),
	intitule: requis,
	lieu: texte(),
	contrat: z.enum(["", ...typesContrat]).default(""),
	source: texte(),
	lien: lienWeb,
	datePublication: dateOuVide,
	dateLimite: dateOuVide,
	description: texte(20000),
	expiree: z.boolean().default(false),
});

export type Entreprise = z.infer<typeof entrepriseSchema> & { id: string };
export type Contact = z.infer<typeof contactSchema> & { id: string };
export type Offre = z.infer<typeof offreSchema> & {
	id: string;
	createdAt: string;
};

// Candidatures
export const statuts = [
	"brouillon",
	"envoyee",
	"reponse",
	"entretien",
	"offre",
	"refusee",
	"abandonnee",
] as const;
export type Statut = (typeof statuts)[number];
export const libellesStatut: Record<Statut, string> = {
	brouillon: "Brouillon",
	envoyee: "Envoyée",
	reponse: "Réponse reçue",
	entretien: "Entretien",
	offre: "Offre reçue",
	refusee: "Refusée",
	abandonnee: "Abandonnée",
};
export const canaux = [
	"Site de l'offre",
	"E-mail",
	"LinkedIn",
	"Sur place",
	"Salon",
] as const;

// Identifiant facultatif : "" veut dire « aucun » (candidature spontanée, pas de contact, pas de CV).
const idFacultatif = z.string().max(64).default("");

export const candidatureSchema = z.object({
	// Déduite de l'offre quand il y en a une.
	entrepriseId: idFacultatif,
	offreId: idFacultatif,
	contactId: idFacultatif,
	cvId: idFacultatif,
	poste: texte(),
	canal: z.enum(["", ...canaux]).default(""),
	statut: z.enum(statuts).default("brouillon"),
	dateEnvoi: dateOuVide,
	source: texte(),
	lien: lienWeb,
	lettre: texte(20000),
	notes: texte(5000),
	etiquettes: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});
export const reponseSchema = z.object({
	texte: z.string().trim().min(1).max(20000),
	date: z.iso.date(),
});

export type Candidature = Omit<
	z.infer<typeof candidatureSchema>,
	"offreId" | "contactId" | "cvId"
> & {
	id: string;
	offreId: string | null;
	contactId: string | null;
	cvId: string | null;
	createdAt: string;
	updatedAt: string;
};
export type Evenement = {
	id: string;
	type: "statut" | "reponse";
	statut: Statut | null;
	texte: string;
	date: string;
	createdAt: string;
};

// Rappels et réglages
export const typesRappel = {
	relance: "Relance",
	entretien: "Entretien",
	date_limite: "Date limite",
	tache: "Tâche",
} as const;
export type TypeRappel = keyof typeof typesRappel;
const typeRappel = z.enum(
	Object.keys(typesRappel) as [TypeRappel, ...TypeRappel[]],
);

export const rappelSchema = z.object({
	type: typeRappel,
	titre: requis,
	date: z.iso.date(),
	candidatureId: idFacultatif,
});
export const modificationRappelSchema = z.object({
	titre: requis.optional(),
	date: z.iso.date().optional(),
	statut: z.enum(["a_faire", "fait"]).optional(),
});
export type Rappel = {
	id: string;
	type: TypeRappel;
	titre: string;
	date: string;
	candidatureId: string | null;
	statut: "a_faire" | "fait";
	emailEnvoye: boolean;
};

export const reglagesSchema = z.object({
	delaiRelance: z.number().int().min(1).max(60),
	delaiSansReponse: z.number().int().min(7).max(120),
	emailsRappel: z.boolean(),
});
export type Reglages = z.infer<typeof reglagesSchema>;
export const reglagesParDefaut: Reglages = {
	delaiRelance: 7,
	delaiSansReponse: 21,
	emailsRappel: true,
};

// Ajoute des jours à une date AAAA-MM-JJ (sans fuseau horaire).
export function ajouterJours(iso: string, jours: number) {
	const d = new Date(`${iso}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + jours);
	return d.toISOString().slice(0, 10);
}

// Recherche d'offres (V1.5) : les offres des sources officielles, ramenées à un même format.
export const sourcesOffres = ["France Travail", "La bonne alternance"] as const;
export type SourceOffres = (typeof sourcesOffres)[number];

export const rechercheSchema = z.object({
	motsCles: z.string().trim().max(200).default(""),
	ville: z.string().trim().max(100).default(""),
	distance: z.coerce.number().int().min(0).max(200).default(30),
});

export type OffreTrouvee = {
	source: SourceOffres;
	idSource: string;
	intitule: string;
	entreprise: string;
	lieu: string;
	lien: string;
	datePublication: string;
	dateDebut: string;
	description: string;
};

export type ResultatRecherche = {
	offres: OffreTrouvee[];
	sources: { nom: SourceOffres; ok: boolean; message?: string }[];
};
