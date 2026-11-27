import { Link } from "react-router";
import {
	type Candidature,
	libellesStatut,
	type Rappel,
	typesRappel,
} from "../shared/schemas";
import { statistiques } from "../shared/statistiques";
import { useRessource } from "./repertoire";
import {
	alerte,
	bouton,
	Chargement,
	carte,
	discret,
	EnTete,
	lien,
	pastilleStatut,
} from "./ui";

const aujourdhui = () => new Date().toLocaleDateString("sv-SE");
const dateCourte = (iso: string) =>
	new Date(`${iso}T00:00`).toLocaleDateString("fr-FR", {
		weekday: "short",
		day: "numeric",
		month: "short",
	});

function Demarrage() {
	const etapes: [string, string, string][] = [
		[
			"/profil",
			"Compléter votre profil",
			"Formation, rythme d'alternance et métiers recherchés : ils préremplissent la recherche d'offres.",
		],
		[
			"/documents",
			"Importer votre CV",
			"En PDF ou DOCX. Relance le garde tel quel et ne le modifie jamais.",
		],
		[
			"/recherche",
			"Trouver des offres",
			"Recherchez des offres d'alternance ou ajoutez-en une depuis son lien.",
		],
		[
			"/candidatures/nouvelle",
			"Créer votre première candidature",
			"Depuis une offre ou en candidature spontanée, puis suivez-la jusqu'à la réponse.",
		],
	];
	return (
		<>
			<EnTete
				titre="Bienvenue sur Relance"
				description="Vous n'avez encore aucune candidature. Quatre étapes pour démarrer :"
			/>
			<ol className="grid gap-3 sm:grid-cols-2">
				{etapes.map(([vers, titre, texte], i) => (
					<li key={vers}>
						<Link
							to={vers}
							className={`${carte} h-full transition-colors hover:border-accent-300 dark:hover:border-accent-800`}
						>
							<span className="flex items-center gap-3">
								<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-50 text-sm font-semibold text-accent-800 dark:bg-accent-950 dark:text-accent-200">
									{i + 1}
								</span>
								<span className="font-semibold">{titre}</span>
							</span>
							<span className={`text-sm ${discret}`}>{texte}</span>
						</Link>
					</li>
				))}
			</ol>
			<p className={`text-sm ${discret}`}>
				Dès qu'une candidature passe à « Envoyée », Relance vous propose une
				relance une semaine plus tard.
			</p>
		</>
	);
}

function LigneRappel({ r, auj }: { r: Rappel; auj: string }) {
	const enRetard = r.date < auj;
	return (
		<li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
			<span
				className={`rounded-md px-2 py-0.5 text-xs font-medium ${
					enRetard
						? "bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
						: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
				}`}
			>
				{enRetard ? `En retard · ${dateCourte(r.date)}` : dateCourte(r.date)}
			</span>
			<span className="min-w-0 grow">
				{r.candidatureId ? (
					<Link to={`/candidatures/${r.candidatureId}`} className={lien}>
						{r.titre}
					</Link>
				) : (
					r.titre
				)}
			</span>
			<span className={`text-sm ${discret}`}>{typesRappel[r.type]}</span>
		</li>
	);
}

export function PageTableau() {
	const candidatures = useRessource<Candidature>("/candidatures").liste;
	const rappels = useRessource<Rappel>("/rappels").liste;
	if (candidatures.isError || rappels.isError)
		return (
			<p role="alert" className={alerte}>
				Impossible de charger le tableau de bord. Rechargez la page.
			</p>
		);
	if (!candidatures.data || !rappels.data) return <Chargement />;
	if (candidatures.data.length === 0) return <Demarrage />;

	const auj = aujourdhui();
	const s = statistiques(candidatures.data, rappels.data, auj);
	const aFaire = rappels.data.filter(
		(r) => r.statut === "a_faire" && r.date <= auj,
	);
	const entretiens = rappels.data.filter(
		(r) => r.statut === "a_faire" && r.type === "entretien" && r.date > auj,
	);
	const brouillons = candidatures.data.filter((c) => c.statut === "brouillon");
	const principaux: [string, string | number, string][] = [
		["En cours", s.enCours, "candidatures envoyées ou en discussion"],
		["Cette semaine", s.envoyeesSemaine, "candidatures envoyées"],
		["Entretiens", s.entretiensAVenir, "à venir"],
		[
			"Taux de réponse",
			s.tauxReponse === null ? "—" : `${s.tauxReponse} %`,
			"réponse, entretien, offre ou refus",
		],
	];
	const total = Math.max(
		1,
		s.parStatut.reduce((n, p) => n + p.nombre, 0),
	);

	return (
		<>
			<EnTete
				titre="Tableau de bord"
				description="Ce qui demande votre attention aujourd'hui, puis où en est votre recherche."
				actions={
					// Sur ordinateur, le bouton est déjà dans la barre latérale.
					<Link to="/candidatures/nouvelle" className={`${bouton} lg:hidden`}>
						Nouvelle candidature
					</Link>
				}
			/>

			<div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
				<section aria-labelledby="titre-afaire" className={carte}>
					<div className="flex items-baseline justify-between gap-3">
						<h2 id="titre-afaire">À faire maintenant</h2>
						<Link to="/rappels" className={`text-sm ${lien}`}>
							Tous les rappels
						</Link>
					</div>
					{aFaire.length === 0 && brouillons.length === 0 ? (
						<p className={`py-2 text-sm ${discret}`}>
							Rien d'urgent : aucun rappel pour aujourd'hui ni en retard.
						</p>
					) : (
						<ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
							{aFaire.map((r) => (
								<LigneRappel key={r.id} r={r} auj={auj} />
							))}
							{brouillons.slice(0, 3).map((c) => (
								<li
									key={c.id}
									className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3"
								>
									<span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
										Brouillon
									</span>
									<span className="min-w-0 grow">
										<Link to={`/candidatures/${c.id}`} className={lien}>
											{c.poste}
										</Link>
									</span>
									<span className={`text-sm ${discret}`}>
										à préparer et envoyer
									</span>
								</li>
							))}
						</ul>
					)}
				</section>

				<section aria-labelledby="titre-entretiens" className={carte}>
					<h2 id="titre-entretiens">Entretiens à venir</h2>
					{entretiens.length === 0 ? (
						<p className={`py-2 text-sm ${discret}`}>
							Aucun entretien prévu. Ajoutez-en un depuis la candidature
							concernée.
						</p>
					) : (
						<ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
							{entretiens.slice(0, 5).map((r) => (
								<LigneRappel key={r.id} r={r} auj={auj} />
							))}
						</ul>
					)}
				</section>
			</div>

			<section aria-labelledby="titre-chiffres" className="flex flex-col gap-3">
				<h2 id="titre-chiffres">Votre recherche en chiffres</h2>
				<dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
					{principaux.map(([libelle, valeur, aide]) => (
						<div key={libelle} className={carte}>
							<dt className={`text-sm font-medium ${discret}`}>{libelle}</dt>
							<dd className="flex flex-col">
								<span className="text-3xl font-semibold tracking-tight tabular-nums">
									{valeur}
								</span>
								<span className={`text-xs ${discret}`}>{aide}</span>
							</dd>
						</div>
					))}
				</dl>
				<p className={`text-sm ${discret}`}>
					Ce mois-ci : {s.envoyeesMois} envoyée{s.envoyeesMois > 1 ? "s" : ""} ·{" "}
					{s.reponses} réponse{s.reponses > 1 ? "s" : ""} reçue
					{s.reponses > 1 ? "s" : ""} au total · {s.rappelsEnRetard} rappel
					{s.rappelsEnRetard > 1 ? "s" : ""} en retard.
				</p>
			</section>

			<section aria-labelledby="titre-statuts" className={carte}>
				<h2 id="titre-statuts">Répartition par statut</h2>
				<div
					aria-hidden="true"
					className="flex h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
				>
					{s.parStatut.map(({ statut, nombre }) => (
						<span
							key={statut}
							className={pastilleStatut[statut]}
							style={{ width: `${(100 * nombre) / total}%` }}
						/>
					))}
				</div>
				<ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
					{s.parStatut.map(({ statut, nombre }) => (
						<li key={statut} className="flex items-center gap-2">
							<span
								aria-hidden="true"
								className={`size-2.5 rounded-full ${pastilleStatut[statut]}`}
							/>
							<Link
								to={`/candidatures?vue=liste&statut=${statut}`}
								className="hover:underline"
							>
								{libellesStatut[statut]}
							</Link>
							<span className={`ml-auto tabular-nums ${discret}`}>
								{nombre}
							</span>
						</li>
					))}
				</ul>
			</section>
		</>
	);
}
