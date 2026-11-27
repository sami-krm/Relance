import { type ReactNode, useState } from "react";
import {
	Link,
	Navigate,
	NavLink,
	Outlet,
	ScrollRestoration,
} from "react-router";
import { libellesStatut, type Statut } from "../shared/schemas";
import { authClient } from "./auth";

// Styles partagés, d'après le template Projectise : pilules blanches, surfaces translucides, accent pervenche.
export const bouton =
	"inline-flex items-center justify-center gap-2 self-start rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-40";
export const boutonSecondaire =
	"inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40";
export const champ =
	"rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white [color-scheme:dark] placeholder:text-white/35 focus:border-accent-400/60 focus:ring-2 focus:ring-accent-400/20 focus:outline-none";
export const discret = "text-white/55";
export const alerte =
	"rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200";
export const succes =
	"rounded-xl border border-accent-400/30 bg-accent-400/10 px-3 py-2 text-sm text-accent-100";
export const carte =
	"flex flex-col gap-2 rounded-2xl border border-white/10 bg-[radial-gradient(80%_100%_at_0%_0%,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]";
export const lien =
	"font-medium text-accent-300 underline decoration-accent-300/40 hover:decoration-current";

export const dateFr = (iso: string) =>
	iso ? new Date(`${iso}T00:00`).toLocaleDateString("fr-FR") : "";

// Couleurs des statuts : sobres, et toujours accompagnées du libellé (jamais la couleur seule).
const couleursStatut: Record<Statut, string> = {
	brouillon:
		"bg-zinc-100 text-zinc-700 ring-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700",
	envoyee:
		"bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900",
	reponse:
		"bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900",
	entretien:
		"bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900",
	offre:
		"bg-accent-50 text-accent-800 ring-accent-200 dark:bg-accent-950/50 dark:text-accent-200 dark:ring-accent-900",
	refusee:
		"bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-900",
	abandonnee:
		"bg-zinc-100 text-zinc-500 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700",
};
export const pastilleStatut: Record<Statut, string> = {
	brouillon: "bg-zinc-400",
	envoyee: "bg-sky-500",
	reponse: "bg-violet-500",
	entretien: "bg-amber-500",
	offre: "bg-accent-500",
	refusee: "bg-rose-500",
	abandonnee: "bg-zinc-300 dark:bg-zinc-600",
};

export function BadgeStatut({ statut }: { statut: Statut }) {
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${couleursStatut[statut]}`}
		>
			<span
				aria-hidden="true"
				className={`size-1.5 rounded-full ${pastilleStatut[statut]}`}
			/>
			{libellesStatut[statut]}
		</span>
	);
}

// En-tête de page : titre, phrase d'aide, et au plus une action principale.
export function EnTete({
	titre,
	description,
	actions,
	retour,
}: {
	titre: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	retour?: { vers: string; libelle: string };
}) {
	return (
		<header className="flex flex-col gap-3">
			{retour && (
				<Link
					to={retour.vers}
					className={`self-start text-sm hover:underline ${discret}`}
				>
					← {retour.libelle}
				</Link>
			)}
			<div className="flex flex-wrap items-start gap-x-4 gap-y-3">
				<div className="flex min-w-0 grow basis-64 flex-col gap-1">
					<h1>{titre}</h1>
					{description && (
						<p className={`max-w-prose ${discret}`}>{description}</p>
					)}
				</div>
				{actions && <div className="flex flex-wrap gap-2">{actions}</div>}
			</div>
		</header>
	);
}

// État vide : dit pourquoi c'est vide et propose la première action utile.
export function EtatVide({
	titre,
	children,
	action,
}: {
	titre: string;
	children?: ReactNode;
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6">
			<p className="font-medium">{titre}</p>
			{children && (
				<p className={`max-w-prose text-sm ${discret}`}>{children}</p>
			)}
			{action && <div className="mt-1">{action}</div>}
		</div>
	);
}

export function Chargement({ texte = "Chargement…" }: { texte?: string }) {
	return (
		<p role="status" className={`flex items-center gap-2 ${discret}`}>
			<span
				aria-hidden="true"
				className="size-4 animate-spin rounded-full border-2 border-white/15 border-t-accent-400"
			/>
			{texte}
		</p>
	);
}

export function Pied() {
	return (
		<footer className={`flex flex-wrap gap-4 py-6 text-sm ${discret}`}>
			<Link to="/mentions-legales" className="hover:underline">
				Mentions légales
			</Link>
			<Link to="/confidentialite" className="hover:underline">
				Confidentialité
			</Link>
			<a href="https://skrim.dev" className="hover:underline">
				skrim.dev
			</a>
		</footer>
	);
}

function Logo() {
	return (
		<Link
			to="/tableau"
			className="flex items-center gap-2 font-semibold tracking-tight"
		>
			<img
				src="/icone.svg"
				alt=""
				className="size-7 rounded-lg ring-1 ring-white/20"
			/>
			Relance
		</Link>
	);
}

// Pages publiques (connexion, mentions) : une colonne étroite et centrée.
export function Page({ children }: { children: ReactNode }) {
	return (
		<div className="mx-auto flex min-h-dvh max-w-md flex-col px-4">
			<div className="pt-8">
				<Logo />
			</div>
			<main className="flex grow flex-col justify-center gap-4 py-10">
				{children}
			</main>
			<Pied />
		</div>
	);
}

// Navigation rangée par intention : suivre, chercher, préparer son dossier.
const groupes: { titre: string; liens: [string, string][] }[] = [
	{
		titre: "Suivi",
		liens: [
			["/tableau", "Tableau de bord"],
			["/candidatures", "Candidatures"],
			["/rappels", "Rappels"],
		],
	},
	{
		titre: "Recherche",
		liens: [
			["/recherche", "Rechercher des offres"],
			["/offres", "Mes offres"],
			["/entreprises", "Entreprises"],
		],
	},
	{
		titre: "Mon dossier",
		liens: [
			["/profil", "Profil"],
			["/documents", "Documents"],
			["/parametres", "Paramètres"],
		],
	},
];

const lienNav = ({ isActive }: { isActive: boolean }) =>
	`block rounded-xl px-3 py-2 text-sm transition-colors ${
		isActive
			? "bg-white/10 font-medium text-white"
			: "text-white/60 hover:bg-white/5 hover:text-white"
	}`;

function Navigation({ onNaviguer }: { onNaviguer?: () => void }) {
	return (
		<nav aria-label="Navigation principale" className="flex flex-col gap-5">
			<Link
				to="/candidatures/nouvelle"
				onClick={onNaviguer}
				className={`${bouton} w-full`}
			>
				Nouvelle candidature
			</Link>
			{groupes.map((g) => (
				<div key={g.titre} className="flex flex-col gap-1">
					<p
						className={`px-3 text-xs font-semibold tracking-wide uppercase ${discret}`}
					>
						{g.titre}
					</p>
					<ul className="flex flex-col gap-0.5">
						{g.liens.map(([vers, libelle]) => (
							<li key={vers}>
								<NavLink to={vers} className={lienNav} onClick={onNaviguer}>
									{libelle}
								</NavLink>
							</li>
						))}
					</ul>
				</div>
			))}
		</nav>
	);
}

function Deconnexion() {
	return (
		<button
			type="button"
			className={`rounded-xl px-3 py-2 text-left text-sm hover:bg-white/5 hover:text-white ${discret}`}
			onClick={() => authClient.signOut()}
		>
			Se déconnecter
		</button>
	);
}

// Pages réservées aux comptes connectés : sans session, retour à la connexion.
export function EspaceConnecte() {
	const session = authClient.useSession();
	const [menu, setMenu] = useState(false);
	if (session.isPending)
		return (
			<div className="p-6">
				<Chargement />
			</div>
		);
	if (!session.data) return <Navigate to="/connexion" replace />;
	return (
		<div className="lg:grid lg:min-h-dvh lg:grid-cols-[16rem_1fr]">
			<a
				href="#contenu"
				className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-black"
			>
				Aller au contenu
			</a>
			{/* Ordinateur : barre latérale fixe. */}
			<aside className="hidden border-r border-white/10 bg-black lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:overflow-y-auto lg:p-4">
				<div className="px-2 pt-1">
					<Logo />
				</div>
				<Navigation />
				<div className="mt-auto flex flex-col">
					<p className={`truncate px-3 text-xs ${discret}`}>
						{session.data.user.email}
					</p>
					<Deconnexion />
				</div>
			</aside>
			{/* Mobile : barre du haut et menu déroulant. */}
			<header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur-md lg:hidden">
				<div className="flex items-center justify-between px-4 py-3">
					<Logo />
					<button
						type="button"
						aria-expanded={menu}
						aria-controls="menu-mobile"
						onClick={() => setMenu(!menu)}
						className={boutonSecondaire}
					>
						{menu ? "Fermer" : "Menu"}
					</button>
				</div>
				{menu && (
					<div
						id="menu-mobile"
						className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/10 px-4 py-4"
					>
						<Navigation onNaviguer={() => setMenu(false)} />
						<div className="mt-4 border-t border-white/10 pt-2">
							<Deconnexion />
						</div>
					</div>
				)}
			</header>
			<div className="flex min-w-0 flex-col px-4 sm:px-6 lg:px-10">
				<main
					id="contenu"
					className="mx-auto flex w-full max-w-5xl grow flex-col gap-6 py-6 lg:py-10"
				>
					<Outlet />
				</main>
				<ScrollRestoration />
				<div className="mx-auto w-full max-w-5xl">
					<Pied />
				</div>
			</div>
		</div>
	);
}
