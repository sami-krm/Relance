import { Link } from "react-router";
import {
	type Candidature,
	libellesStatut,
	type Rappel,
	typesRappel,
} from "../shared/schemas";
import { statistiques } from "../shared/statistiques";
import { useRessource } from "./repertoire";
import { bouton, discret } from "./ui";

const aujourdhui = () => new Date().toLocaleDateString("sv-SE");
const dateFr = (iso: string) =>
	new Date(`${iso}T00:00`).toLocaleDateString("fr-FR", {
		weekday: "short",
		day: "numeric",
		month: "short",
	});

function Demarrage() {
	const etapes: [string, string][] = [
		[
			"/profil",
			"Complétez votre profil (formation, rythme d'alternance, recherche).",
		],
		["/documents", "Importez votre CV en PDF et vos lettres types."],
		[
			"/entreprises",
			"Ajoutez les entreprises qui vous intéressent, puis leurs offres.",
		],
		[
			"/candidatures/nouvelle",
			"Créez votre première candidature et suivez-la jusqu'à la réponse.",
		],
	];
	return (
		<>
			<h1 className="text-2xl font-bold">Bienvenue sur Relance</h1>
			<p className={discret}>
				Vous n'avez encore aucune candidature. Pour commencer :
			</p>
			<ol className="flex list-decimal flex-col gap-2 pl-6">
				{etapes.map(([lien, texte]) => (
					<li key={lien}>
						<Link to={lien} className="underline">
							{texte}
						</Link>
					</li>
				))}
			</ol>
			<p className={discret}>
				Dès qu'une candidature passe à « Envoyée », Relance vous propose une
				relance une semaine plus tard.
			</p>
		</>
	);
}

export function PageTableau() {
	const candidatures = useRessource<Candidature>("/candidatures").liste.data;
	const rappels = useRessource<Rappel>("/rappels").liste.data;
	if (!candidatures || !rappels) return <p>Chargement…</p>;
	if (candidatures.length === 0) return <Demarrage />;

	const auj = aujourdhui();
	const s = statistiques(candidatures, rappels, auj);
	const chiffres: [string, string | number][] = [
		["Candidatures en cours", s.enCours],
		["Envoyées cette semaine", s.envoyeesSemaine],
		["Envoyées ce mois-ci", s.envoyeesMois],
		["Entretiens à venir", s.entretiensAVenir],
		["Rappels du jour", s.rappelsDuJour],
		["Rappels en retard", s.rappelsEnRetard],
		["Réponses reçues", s.reponses],
		["Taux de réponse", s.tauxReponse === null ? "—" : `${s.tauxReponse} %`],
	];
	const urgents = rappels
		.filter((r) => r.statut === "a_faire" && r.date <= auj)
		.slice(0, 5);
	const entretiens = rappels.filter(
		(r) => r.statut === "a_faire" && r.type === "entretien" && r.date >= auj,
	);
	const max = Math.max(1, ...s.parStatut.map((p) => p.nombre));

	return (
		<>
			<div className="flex flex-wrap items-center gap-3">
				<h1 className="mr-auto text-2xl font-bold">Tableau de bord</h1>
				<Link to="/candidatures/nouvelle" className={bouton}>
					Nouvelle candidature
				</Link>
			</div>
			<dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{chiffres.map(([libelle, valeur]) => (
					<div
						key={libelle}
						className="flex flex-col-reverse rounded-md border border-zinc-300 p-3 dark:border-zinc-700"
					>
						<dt className={`text-sm ${discret}`}>{libelle}</dt>
						<dd className="text-2xl font-bold">{valeur}</dd>
					</div>
				))}
			</dl>
			<p className={`text-sm ${discret}`}>
				Le taux de réponse compte les candidatures qui ont obtenu une réponse
				(réponse, entretien, offre ou refus) parmi celles envoyées.
			</p>

			<section className="flex flex-col gap-2">
				<h2 className="text-xl font-semibold">Rappels du jour et en retard</h2>
				{urgents.length === 0 ? (
					<p className={discret}>Rien d'urgent.</p>
				) : (
					<ul className="flex flex-col gap-1">
						{urgents.map((r) => (
							<li key={r.id}>
								{r.titre}{" "}
								<span className={discret}>
									· {typesRappel[r.type]} ·{" "}
									{r.date < auj
										? `en retard (${dateFr(r.date)})`
										: "aujourd'hui"}
								</span>
							</li>
						))}
					</ul>
				)}
				<Link to="/rappels" className="self-start underline">
					Tous les rappels
				</Link>
			</section>

			{entretiens.length > 0 && (
				<section className="flex flex-col gap-2">
					<h2 className="text-xl font-semibold">Entretiens à venir</h2>
					<ul className="flex flex-col gap-1">
						{entretiens.map((r) => (
							<li key={r.id}>
								{dateFr(r.date)} · {r.titre}
							</li>
						))}
					</ul>
				</section>
			)}

			<section className="flex flex-col gap-2">
				<h2 className="text-xl font-semibold">Répartition par statut</h2>
				<ul className="flex flex-col gap-2">
					{s.parStatut.map(({ statut, nombre }) => (
						<li
							key={statut}
							className="grid grid-cols-[9rem_1fr_2rem] items-center gap-2"
						>
							<span>{libellesStatut[statut]}</span>
							<span
								aria-hidden="true"
								className="h-3 rounded bg-zinc-700 dark:bg-zinc-300"
								style={{ width: `${(100 * nombre) / max}%` }}
							/>
							<span className="text-right">{nombre}</span>
						</li>
					))}
				</ul>
			</section>
		</>
	);
}
