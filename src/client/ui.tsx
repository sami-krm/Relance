import type { ReactNode } from "react";
import { Link, Navigate, NavLink, Outlet } from "react-router";
import { authClient } from "./auth";

export const bouton =
	"self-start rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";
export const boutonSecondaire =
	"rounded-md border border-zinc-400 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800";
export const champ =
	"rounded-md border border-zinc-400 bg-transparent px-3 py-2";
export const discret = "text-zinc-600 dark:text-zinc-400";
export const alerte = "text-red-700 dark:text-red-400";

export function Pied() {
	return (
		<footer
			className={`mx-auto flex max-w-3xl flex-wrap gap-4 px-4 py-6 text-sm ${discret}`}
		>
			<Link to="/mentions-legales" className="underline">
				Mentions légales
			</Link>
			<Link to="/confidentialite" className="underline">
				Confidentialité
			</Link>
			<a href="https://skrim.dev" className="underline">
				skrim.dev
			</a>
		</footer>
	);
}

export function Page({ children }: { children: ReactNode }) {
	return (
		<>
			<main className="mx-auto flex min-h-[85dvh] max-w-xl flex-col justify-center gap-4 px-4">
				{children}
			</main>
			<Pied />
		</>
	);
}

const lienNav = ({ isActive }: { isActive: boolean }) =>
	isActive ? "font-semibold underline" : "hover:underline";

// Pages réservées aux comptes connectés : sans session, retour à la connexion.
export function EspaceConnecte() {
	const session = authClient.useSession();
	if (session.isPending) return <p className="p-4">Chargement…</p>;
	if (!session.data) return <Navigate to="/connexion" replace />;
	return (
		<>
			<header className="border-b border-zinc-300 dark:border-zinc-700">
				<nav
					aria-label="Navigation principale"
					className="mx-auto flex max-w-3xl flex-wrap items-center gap-4 px-4 py-3"
				>
					<Link to="/tableau" className="font-bold">
						Relance
					</Link>
					<NavLink to="/candidatures" className={lienNav}>
						Candidatures
					</NavLink>
					<NavLink to="/rappels" className={lienNav}>
						Rappels
					</NavLink>
					<NavLink to="/profil" className={lienNav}>
						Profil
					</NavLink>
					<NavLink to="/documents" className={lienNav}>
						Documents
					</NavLink>
					<NavLink to="/entreprises" className={lienNav}>
						Entreprises
					</NavLink>
					<NavLink to="/offres" className={lienNav}>
						Offres
					</NavLink>
					<NavLink to="/recherche" className={lienNav}>
						Recherche
					</NavLink>
					<NavLink to="/parametres" className={lienNav}>
						Paramètres
					</NavLink>
					<button
						type="button"
						className="ml-auto text-sm hover:underline"
						onClick={() => authClient.signOut()}
					>
						Se déconnecter
					</button>
				</nav>
			</header>
			<main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
				<Outlet />
			</main>
			<Pied />
		</>
	);
}
