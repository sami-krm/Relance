import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { Profil } from "../shared/schemas";

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;
const date = (nom: string) => integer(nom, { mode: "timestamp_ms" });
const horodatage = () => ({
	createdAt: date("created_at").notNull().default(now),
	updatedAt: date("updated_at")
		.notNull()
		.default(now)
		.$onUpdate(() => new Date()),
});

// Tables user, session, account et verification : schéma attendu par Better Auth.
export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" })
		.notNull()
		.default(false),
	image: text("image"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(now),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.default(now)
		.$onUpdate(() => new Date()),
});

export const session = sqliteTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: date("expires_at").notNull(),
		token: text("token").notNull().unique(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		...horodatage(),
	},
	(t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = sqliteTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: date("access_token_expires_at"),
		refreshTokenExpiresAt: date("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		...horodatage(),
	},
	(t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = sqliteTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: date("expires_at").notNull(),
		...horodatage(),
	},
	(t) => [index("verification_identifier_idx").on(t.identifier)],
);

// Un profil par compte, validé par profilSchema ; jamais interrogé champ par champ en SQL.
export const profil = sqliteTable("profil", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	donnees: text("donnees", { mode: "json" }).$type<Profil>().notNull(),
	...horodatage(),
});

// CV (fichier PDF dans R2, jamais modifié), lettres et réponses types (texte).
export const document = sqliteTable(
	"document",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		type: text("type", { enum: ["cv", "lettre", "reponse"] }).notNull(),
		nom: text("nom").notNull(),
		cleR2: text("cle_r2"),
		taille: integer("taille"),
		contenu: text("contenu"),
		parDefaut: integer("par_defaut", { mode: "boolean" })
			.notNull()
			.default(false),
		// Un CV supprimé alors qu'une candidature l'utilise est seulement masqué.
		archiveLe: date("archived_at"),
		...horodatage(),
	},
	(t) => [index("document_user_id_idx").on(t.userId)],
);

const proprietaire = () =>
	text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" });
const texte = (nom: string) => text(nom).notNull().default("");

export const entreprise = sqliteTable(
	"company",
	{
		id: text("id").primaryKey(),
		userId: proprietaire(),
		nom: text("nom").notNull(),
		ville: texte("ville"),
		site: texte("site"),
		secteur: texte("secteur"),
		notes: texte("notes"),
		...horodatage(),
	},
	(t) => [index("company_user_id_idx").on(t.userId)],
);

// shortcut: supprimer une entreprise supprime ses contacts et offres ; à revoir à l'étape 5 quand des candidatures y seront liées.
const entrepriseId = () =>
	text("company_id")
		.notNull()
		.references(() => entreprise.id, { onDelete: "cascade" });

export const contact = sqliteTable(
	"contact",
	{
		id: text("id").primaryKey(),
		userId: proprietaire(),
		entrepriseId: entrepriseId(),
		nom: text("nom").notNull(),
		role: texte("role"),
		email: texte("email"),
		telephone: texte("telephone"),
		linkedin: texte("linkedin"),
		notes: texte("notes"),
		...horodatage(),
	},
	(t) => [
		index("contact_user_id_idx").on(t.userId),
		index("contact_company_id_idx").on(t.entrepriseId),
	],
);

export const offre = sqliteTable(
	"offer",
	{
		id: text("id").primaryKey(),
		userId: proprietaire(),
		entrepriseId: entrepriseId(),
		intitule: text("intitule").notNull(),
		lieu: texte("lieu"),
		contrat: texte("contrat"),
		source: texte("source"),
		// Identifiant de l'offre chez sa source (recherche d'offres), vide pour une offre saisie à la main.
		sourceId: texte("source_id"),
		lien: texte("lien"),
		datePublication: texte("date_publication"),
		dateLimite: texte("date_limite"),
		description: texte("description"),
		expiree: integer("expiree", { mode: "boolean" }).notNull().default(false),
		// Dernière vérification de l'expiration auprès de la source (AAAA-MM-JJ), vide si jamais vérifiée.
		verifieeLe: texte("verifiee_le"),
		...horodatage(),
	},
	(t) => [
		index("offer_user_id_idx").on(t.userId),
		index("offer_company_id_idx").on(t.entrepriseId),
		// Une offre trouvée par la recherche n'est ajoutée qu'une fois, même après un double clic.
		uniqueIndex("offer_source_idx")
			.on(t.userId, t.source, t.sourceId)
			.where(sql`${t.sourceId} <> ''`),
	],
);

export const candidature = sqliteTable(
	"application",
	{
		id: text("id").primaryKey(),
		userId: proprietaire(),
		// Pas de cascade : l'API refuse de supprimer une entreprise qui a des candidatures.
		entrepriseId: text("company_id")
			.notNull()
			.references(() => entreprise.id),
		offreId: text("offer_id").references(() => offre.id, {
			onDelete: "set null",
		}),
		contactId: text("contact_id").references(() => contact.id, {
			onDelete: "set null",
		}),
		cvId: text("cv_id").references(() => document.id),
		poste: text("poste").notNull(),
		canal: texte("canal"),
		statut: text("statut").notNull().default("brouillon"),
		dateEnvoi: texte("date_envoi"),
		// Source, lien et lettre sont copiés : ils restent même si l'offre ou la lettre change.
		source: texte("source"),
		lien: texte("lien"),
		lettre: texte("lettre"),
		notes: texte("notes"),
		etiquettes: text("etiquettes", { mode: "json" })
			.$type<string[]>()
			.notNull()
			.default([]),
		...horodatage(),
	},
	(t) => [
		index("application_user_id_idx").on(t.userId),
		index("application_company_id_idx").on(t.entrepriseId),
	],
);

// Historique daté : changements de statut (automatiques) et réponses reçues.
export const evenement = sqliteTable(
	"application_event",
	{
		id: text("id").primaryKey(),
		candidatureId: text("application_id")
			.notNull()
			.references(() => candidature.id, { onDelete: "cascade" }),
		type: text("type", { enum: ["statut", "reponse"] }).notNull(),
		statut: text("statut"),
		texte: texte("texte"),
		date: text("date").notNull(),
		createdAt: date("created_at").notNull().default(now),
	},
	(t) => [index("application_event_application_id_idx").on(t.candidatureId)],
);

export const rappel = sqliteTable(
	"reminder",
	{
		id: text("id").primaryKey(),
		userId: proprietaire(),
		candidatureId: text("application_id").references(() => candidature.id, {
			onDelete: "cascade",
		}),
		type: text("type").notNull(),
		titre: text("titre").notNull(),
		date: text("date").notNull(),
		statut: text("statut").notNull().default("a_faire"),
		emailEnvoye: integer("email_envoye", { mode: "boolean" })
			.notNull()
			.default(false),
		...horodatage(),
	},
	(t) => [
		index("reminder_user_id_idx").on(t.userId),
		index("reminder_statut_date_idx").on(t.statut, t.date),
	],
);

export const preference = sqliteTable("preference", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	delaiRelance: integer("delai_relance").notNull().default(7),
	delaiSansReponse: integer("delai_sans_reponse").notNull().default(21),
	emailsRappel: integer("emails_rappel", { mode: "boolean" })
		.notNull()
		.default(true),
	// Accord pour les brouillons par IA (AAAA-MM-JJ), vide sans accord ou après retrait.
	iaAccordLe: texte("ia_accord_le"),
	// Générations du jour, pour la limite par compte.
	iaJour: texte("ia_jour"),
	iaNombre: integer("ia_nombre").notNull().default(0),
	...horodatage(),
});

// Recherches d'offres enregistrées avec leurs filtres (V1.5).
export const rechercheEnregistree = sqliteTable(
	"saved_search",
	{
		id: text("id").primaryKey(),
		userId: proprietaire(),
		nom: text("nom").notNull(),
		motsCles: texte("mots_cles"),
		ville: texte("ville"),
		distance: integer("distance").notNull().default(30),
		debut: texte("debut"),
		...horodatage(),
	},
	(t) => [index("saved_search_user_id_idx").on(t.userId)],
);
