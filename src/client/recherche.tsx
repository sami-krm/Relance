import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { Link } from "react-router";
import {
	type Entreprise,
	memeOffre,
	type Offre,
	type OffreTrouvee,
	type Profil,
	type RechercheEnregistree,
	type ResultatRecherche,
} from "../shared/schemas";
import { api, json } from "./api";
import { useRessource } from "./repertoire";
import { alerte, bouton, boutonSecondaire, champ, discret } from "./ui";

type Criteres = {
	motsCles: string;
	ville: string;
	distance: string;
	debut: string;
};

const carte =
	"flex flex-col gap-1 rounded-md border border-zinc-300 p-3 dark:border-zinc-700";
const dateFr = (iso: string) =>
	iso ? new Date(`${iso}T00:00`).toLocaleDateString("fr-FR") : "";

export function PageRecherche() {
	const profil = useQuery({
		queryKey: ["profil"],
		queryFn: () => api<Profil>("/profil"),
	});
	if (profil.isError)
		return <p className={alerte}>Impossible de charger votre profil.</p>;
	if (!profil.data) return <p>Chargement…</p>;
	const p = profil.data.valeurs;
	return (
		<Recherche
			initial={{
				motsCles: p.metiers || p.motsCles || "",
				ville: p.localisation || p.ville || "",
				distance: p.distanceMax || "30",
				debut: p.dateDebut || "",
			}}
		/>
	);
}

function Recherche({ initial }: { initial: Criteres }) {
	const id = useId();
	const [saisie, setSaisie] = useState(initial);
	const [criteres, setCriteres] = useState<Criteres>();
	const resultat = useQuery({
		queryKey: ["recherche", criteres],
		enabled: !!criteres,
		// Les sources limitent leurs appels : on ne relance pas une recherche déjà faite.
		staleTime: 10 * 60 * 1000,
		retry: false,
		queryFn: () =>
			api<ResultatRecherche>(
				`/recherche?${new URLSearchParams({
					motsCles: criteres?.motsCles ?? "",
					ville: criteres?.ville ?? "",
					distance: criteres?.distance || "30",
				})}`,
			),
	});

	function chercher(e: FormEvent) {
		e.preventDefault();
		setCriteres({ ...saisie });
	}

	const modifier =
		(cle: keyof Criteres) => (e: React.ChangeEvent<HTMLInputElement>) =>
			setSaisie({ ...saisie, [cle]: e.target.value });

	function relancer(r: RechercheEnregistree) {
		const c = { ...r, distance: String(r.distance) };
		setSaisie(c);
		setCriteres(c);
	}

	return (
		<>
			<h1 className="text-2xl font-bold">Rechercher des offres</h1>
			<p className={discret}>
				Les champs sont préremplis depuis votre{" "}
				<Link to="/profil" className="underline">
					profil
				</Link>
				. Seules les offres en alternance (apprentissage ou
				professionnalisation) sont cherchées.
			</p>
			<Enregistrees onRelancer={relancer} />
			<form onSubmit={chercher} className="flex flex-col gap-3">
				<div className="flex flex-col gap-1">
					<label htmlFor={`${id}-mots`} className="font-medium">
						Métier ou mots-clés
					</label>
					<input
						id={`${id}-mots`}
						className={champ}
						value={saisie.motsCles}
						onChange={modifier("motsCles")}
						maxLength={200}
						placeholder="Par exemple : développeur web"
					/>
				</div>
				<div className="flex flex-wrap gap-3">
					<div className="flex flex-col gap-1">
						<label htmlFor={`${id}-ville`} className="font-medium">
							Ville
						</label>
						<input
							id={`${id}-ville`}
							className={champ}
							value={saisie.ville}
							onChange={modifier("ville")}
							maxLength={100}
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label htmlFor={`${id}-distance`} className="font-medium">
							Distance (km)
						</label>
						<input
							id={`${id}-distance`}
							type="number"
							min={0}
							max={200}
							className={`${champ} w-28`}
							value={saisie.distance}
							onChange={modifier("distance")}
						/>
					</div>
					<div className="flex flex-col gap-1">
						<label htmlFor={`${id}-debut`} className="font-medium">
							Début du contrat à partir du
						</label>
						<input
							id={`${id}-debut`}
							type="date"
							className={champ}
							value={saisie.debut}
							onChange={modifier("debut")}
						/>
					</div>
				</div>
				<button
					type="submit"
					className={bouton}
					disabled={
						resultat.isFetching ||
						(!saisie.motsCles.trim() && !saisie.ville.trim())
					}
				>
					{resultat.isFetching ? "Recherche…" : "Rechercher"}
				</button>
			</form>

			{resultat.isError && (
				<p role="alert" className={alerte}>
					{resultat.error.message}
				</p>
			)}
			{resultat.data && criteres && (
				<>
					<Enregistrer key={JSON.stringify(criteres)} criteres={criteres} />
					<Resultats resultat={resultat.data} debut={criteres.debut} />
				</>
			)}
			<Sources />
		</>
	);
}

function Enregistrees({
	onRelancer,
}: {
	onRelancer: (r: RechercheEnregistree) => void;
}) {
	const recherches = useRessource<RechercheEnregistree>("/recherches");
	const [erreur, setErreur] = useState("");
	const liste = recherches.liste.data ?? [];
	if (!liste.length) return null;
	return (
		<section className="flex flex-col gap-2">
			<h2 className="text-lg font-semibold">Mes recherches enregistrées</h2>
			{erreur && (
				<p role="alert" className={alerte}>
					{erreur}
				</p>
			)}
			<ul className="flex flex-col gap-2">
				{liste.map((r) => (
					<li key={r.id} className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							className={boutonSecondaire}
							onClick={() => onRelancer(r)}
						>
							{r.nom}
						</button>
						<span className={`text-sm ${discret}`}>
							{[r.motsCles, r.ville && `${r.ville}, ${r.distance} km`]
								.filter(Boolean)
								.join(" · ")}
						</span>
						<button
							type="button"
							className="text-sm underline"
							aria-label={`Supprimer la recherche ${r.nom}`}
							onClick={() =>
								recherches
									.supprimer(r.id)
									.catch((e) => setErreur((e as Error).message))
							}
						>
							Supprimer
						</button>
					</li>
				))}
			</ul>
		</section>
	);
}

function Enregistrer({ criteres }: { criteres: Criteres }) {
	const id = useId();
	const recherches = useRessource<RechercheEnregistree>("/recherches");
	const nomParDefaut = [criteres.motsCles, criteres.ville]
		.filter(Boolean)
		.join(" · ")
		.slice(0, 100);
	const [nom, setNom] = useState(nomParDefaut);
	const [etat, setEtat] = useState<"" | "enCours" | "fait">("");
	const [erreur, setErreur] = useState("");

	async function enregistrer(e: FormEvent) {
		e.preventDefault();
		setEtat("enCours");
		setErreur("");
		try {
			await recherches.creer({
				nom,
				motsCles: criteres.motsCles,
				ville: criteres.ville,
				distance: Number(criteres.distance) || 30,
				debut: criteres.debut,
			});
			setEtat("fait");
		} catch (err) {
			setErreur((err as Error).message);
			setEtat("");
		}
	}

	if (etat === "fait")
		return <p className={`text-sm ${discret}`}>Recherche enregistrée.</p>;
	return (
		<form onSubmit={enregistrer} className="flex flex-wrap items-end gap-2">
			<div className="flex flex-col gap-1">
				<label htmlFor={`${id}-nom`} className="text-sm font-medium">
					Nom de la recherche
				</label>
				<input
					id={`${id}-nom`}
					className={champ}
					value={nom}
					onChange={(e) => setNom(e.target.value)}
					required
					maxLength={100}
				/>
			</div>
			<button
				type="submit"
				className={boutonSecondaire}
				disabled={etat === "enCours"}
			>
				Enregistrer cette recherche
			</button>
			{erreur && (
				<p role="alert" className={alerte}>
					{erreur}
				</p>
			)}
		</form>
	);
}

function Resultats({
	resultat,
	debut,
}: {
	resultat: ResultatRecherche;
	debut: string;
}) {
	const offres = useRessource<Offre>("/offres").liste.data ?? [];
	const entreprises = useRessource<Entreprise>("/entreprises").liste.data ?? [];
	const mesOffres = offres.map((o) => ({
		...o,
		idSource: o.sourceId,
		entreprise: entreprises.find((e) => e.id === o.entrepriseId)?.nom ?? "",
	}));
	// Une offre sans date de début connue reste affichée : la source ne la donne pas toujours.
	const visibles = resultat.offres.filter(
		(o) => !debut || !o.dateDebut || o.dateDebut >= debut,
	);

	return (
		<section aria-live="polite" className="flex flex-col gap-3">
			{resultat.metiers.length > 0 && (
				<p className={discret}>
					Métiers recherchés : {resultat.metiers.join(", ")}.
				</p>
			)}
			{resultat.avertissement && (
				<p className={alerte}>{resultat.avertissement}</p>
			)}
			{resultat.sources
				.filter((s) => !s.ok)
				.map((s) => (
					<p key={s.nom} className={alerte}>
						{s.nom} : {s.message}
					</p>
				))}
			<h2 className="text-lg font-semibold">
				{visibles.length} offre{visibles.length > 1 ? "s" : ""}
			</h2>
			<ul className="flex flex-col gap-2">
				{visibles.map((o) => (
					<CarteOffre
						key={`${o.source}-${o.idSource}`}
						offre={o}
						dejaAjoutee={mesOffres.some((m) => memeOffre(m, o))}
					/>
				))}
			</ul>
		</section>
	);
}

function CarteOffre({
	offre: o,
	dejaAjoutee,
}: {
	offre: OffreTrouvee;
	dejaAjoutee: boolean;
}) {
	const qc = useQueryClient();
	const [enCours, setEnCours] = useState(false);
	const [erreur, setErreur] = useState("");

	async function ajouter() {
		setEnCours(true);
		setErreur("");
		try {
			await api("/recherche/offres", json("POST", o));
		} catch (e) {
			setErreur((e as Error).message);
		} finally {
			// Recharge « Mes offres » et les entreprises : la carte passe à « déjà ajoutée ».
			await qc.invalidateQueries({ queryKey: ["/offres"] });
			await qc.invalidateQueries({ queryKey: ["/entreprises"] });
			setEnCours(false);
		}
	}

	return (
		<li className={carte}>
			<span className="font-medium">{o.intitule}</span>
			<span className={`text-sm ${discret}`}>
				{[
					o.entreprise,
					o.lieu,
					o.datePublication && `publiée le ${dateFr(o.datePublication)}`,
					o.dateDebut && `début le ${dateFr(o.dateDebut)}`,
					`source : ${o.source}`,
				]
					.filter(Boolean)
					.join(" · ")}
			</span>
			{o.lien && (
				<a
					href={o.lien}
					target="_blank"
					rel="noreferrer"
					className="underline break-all"
				>
					Voir l'offre sur le site d'origine
				</a>
			)}
			{o.description && (
				<details>
					<summary className="cursor-pointer text-sm">Description</summary>
					<p className="mt-2 whitespace-pre-line">{o.description}</p>
				</details>
			)}
			{erreur && (
				<p role="alert" className={alerte}>
					{erreur}
				</p>
			)}
			{dejaAjoutee ? (
				<p className="text-sm">
					Déjà dans{" "}
					<Link to="/offres" className="underline">
						vos offres
					</Link>
					.
				</p>
			) : (
				<button
					type="button"
					className={`${boutonSecondaire} self-start`}
					onClick={ajouter}
					disabled={enCours}
				>
					{enCours ? "Ajout…" : "Ajouter à mes offres"}
				</button>
			)}
		</li>
	);
}

// Les sources réellement utilisées, sans en promettre d'autres.
function Sources() {
	return (
		<details className="rounded-md border border-zinc-300 p-4 dark:border-zinc-700">
			<summary className="cursor-pointer font-semibold">
				Sources prises en charge
			</summary>
			<ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
				<li>
					<strong>La bonne alternance</strong> (API officielle de l'État) : les
					offres d'alternance de France Travail et de nombreux sites
					partenaires.
				</li>
				<li>
					<strong>ROMEO</strong> (API de France Travail) : reconnaît les métiers
					à partir de vos mots-clés. Seuls vos mots-clés lui sont envoyés.
				</li>
				<li>
					<strong>Découpage administratif</strong> (geo.api.gouv.fr) : situe la
					ville saisie.
				</li>
			</ul>
			<p className={`mt-3 text-sm ${discret}`}>
				L'API « Offres d'emploi » de France Travail n'est pas proposée aux
				nouvelles applications : ses offres d'alternance arrivent par La bonne
				alternance. Les autres sites (LinkedIn, Indeed…) ne sont pas interrogés
				; ajoutez leurs offres à la main.
			</p>
			<p className={`mt-2 text-sm ${discret}`}>
				Chaque matin, les offres ajoutées depuis La bonne alternance sont
				vérifiées auprès d'elle : une offre pourvue, annulée ou expirée est
				marquée « Expirée ». Les offres France Travail qu'elle relaie ne peuvent
				pas être vérifiées ainsi.
			</p>
		</details>
	);
}
