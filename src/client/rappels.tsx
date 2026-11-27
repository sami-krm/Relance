import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { Link } from "react-router";
import {
	ajouterJours,
	type Candidature,
	type Rappel,
	type Reglages,
	type TypeRappel,
	typesRappel,
} from "../shared/schemas";
import { api, json } from "./api";
import { Calendrier } from "./calendrier";
import { MesDonnees } from "./compte";
import { AccordIa } from "./ia";
import { useRessource } from "./repertoire";
import { alerte, bouton, boutonSecondaire, champ, discret } from "./ui";

const aujourdhui = () => new Date().toLocaleDateString("sv-SE");
const dateFr = (iso: string) =>
	new Date(`${iso}T00:00`).toLocaleDateString("fr-FR", {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
const carte =
	"flex flex-col gap-2 rounded-md border border-zinc-300 p-3 dark:border-zinc-700";

function useReglages() {
	return useQuery({
		queryKey: ["/reglages"],
		queryFn: () => api<Reglages>("/reglages"),
	});
}

function ElementRappel({
	r,
	candidature,
	onErreur,
}: {
	r: Rappel;
	candidature?: Candidature;
	onErreur: (m: string) => void;
}) {
	const { modifier, supprimer } = useRessource<Rappel>("/rappels");
	const [date, setDate] = useState("");
	const id = useId();
	const agir = (p: Promise<unknown>) => p.catch((e) => onErreur(e.message));
	// Un report part de la date prévue, ou d'aujourd'hui si elle est passée.
	const reporter = (jours: number) => {
		// biome-ignore lint/complexity/useMathMinMax: dates texte AAAA-MM-JJ, Math.max donnerait NaN.
		const depart = r.date < aujourdhui() ? aujourdhui() : r.date;
		agir(modifier(r.id, { date: ajouterJours(depart, jours) }));
	};
	const fait = r.statut === "fait";

	return (
		<li className={`${carte} ${fait ? "opacity-70" : ""}`}>
			<span>
				<span className="font-medium">{r.titre}</span>{" "}
				<span className={`text-sm ${discret}`}>
					· {typesRappel[r.type]} · {dateFr(r.date)}
				</span>
			</span>
			{candidature && (
				<Link
					to={`/candidatures/${candidature.id}`}
					className="text-sm underline"
				>
					Candidature : {candidature.poste}
				</Link>
			)}
			<span className="flex flex-wrap items-end gap-2">
				<button
					type="button"
					className={boutonSecondaire}
					onClick={() =>
						agir(modifier(r.id, { statut: fait ? "a_faire" : "fait" }))
					}
				>
					{fait ? "Remettre à faire" : "Fait"}
					<span className="sr-only"> : {r.titre}</span>
				</button>
				{!fait && (
					<>
						<button
							type="button"
							className={boutonSecondaire}
							onClick={() => reporter(3)}
						>
							+3 jours<span className="sr-only"> : {r.titre}</span>
						</button>
						<button
							type="button"
							className={boutonSecondaire}
							onClick={() => reporter(7)}
						>
							+1 semaine<span className="sr-only"> : {r.titre}</span>
						</button>
						<span className="flex items-end gap-1">
							<label htmlFor={id} className="sr-only">
								Nouvelle date pour {r.titre}
							</label>
							<input
								id={id}
								type="date"
								value={date}
								onChange={(e) => setDate(e.target.value)}
								className={`${champ} py-1 text-sm`}
							/>
							<button
								type="button"
								className={boutonSecondaire}
								disabled={!date}
								onClick={() =>
									agir(modifier(r.id, { date }).then(() => setDate("")))
								}
							>
								Reporter
							</button>
						</span>
					</>
				)}
				<button
					type="button"
					className={boutonSecondaire}
					onClick={() =>
						window.confirm(`Supprimer le rappel « ${r.titre} » ?`) &&
						agir(supprimer(r.id))
					}
				>
					Supprimer<span className="sr-only"> : {r.titre}</span>
				</button>
			</span>
		</li>
	);
}

function NouveauRappel({
	candidatures,
	candidatureId,
	posteParDefaut,
}: {
	candidatures?: Candidature[];
	candidatureId?: string;
	posteParDefaut?: string;
}) {
	const id = useId();
	const { creer } = useRessource<Rappel>("/rappels");
	const vide = {
		type: "relance" as TypeRappel,
		titre: posteParDefaut ? `Relancer « ${posteParDefaut} »` : "",
		date: ajouterJours(aujourdhui(), 7),
		candidatureId: candidatureId ?? "",
	};
	const [r, setR] = useState(vide);
	const [erreur, setErreur] = useState("");

	async function envoyer(e: FormEvent) {
		e.preventDefault();
		setErreur("");
		try {
			await creer(r);
			setR(vide);
		} catch (err) {
			setErreur((err as Error).message);
		}
	}

	return (
		<form onSubmit={envoyer} className="flex flex-col gap-3">
			<label htmlFor={`${id}-type`} className="font-medium">
				Type
			</label>
			<select
				id={`${id}-type`}
				value={r.type}
				onChange={(e) => setR({ ...r, type: e.target.value as TypeRappel })}
				className={champ}
			>
				{Object.entries(typesRappel).map(([v, l]) => (
					<option key={v} value={v}>
						{l}
					</option>
				))}
			</select>
			<label htmlFor={`${id}-titre`} className="font-medium">
				Titre (obligatoire)
			</label>
			<input
				id={`${id}-titre`}
				required
				maxLength={200}
				value={r.titre}
				onChange={(e) => setR({ ...r, titre: e.target.value })}
				className={champ}
			/>
			<label htmlFor={`${id}-date`} className="font-medium">
				Date
			</label>
			<input
				id={`${id}-date`}
				type="date"
				required
				value={r.date}
				onChange={(e) => setR({ ...r, date: e.target.value })}
				className={champ}
			/>
			{candidatures && (
				<>
					<label htmlFor={`${id}-cand`} className="font-medium">
						Candidature liée
					</label>
					<select
						id={`${id}-cand`}
						value={r.candidatureId}
						onChange={(e) => setR({ ...r, candidatureId: e.target.value })}
						className={champ}
					>
						<option value="">Aucune</option>
						{candidatures.map((c) => (
							<option key={c.id} value={c.id}>
								{c.poste}
							</option>
						))}
					</select>
				</>
			)}
			<button type="submit" className={bouton}>
				Ajouter le rappel
			</button>
			{erreur && (
				<p role="alert" className={alerte}>
					{erreur}
				</p>
			)}
		</form>
	);
}

function Section({
	titre,
	rappels,
	candidatures,
	onErreur,
}: {
	titre: string;
	rappels: Rappel[];
	candidatures: Candidature[];
	onErreur: (m: string) => void;
}) {
	if (!rappels.length) return null;
	return (
		<section className="flex flex-col gap-2">
			<h2 className="text-xl font-semibold">
				{titre}{" "}
				<span className={`text-base font-normal ${discret}`}>
					{rappels.length}
				</span>
			</h2>
			<ul className="flex flex-col gap-2">
				{rappels.map((r) => (
					<ElementRappel
						key={r.id}
						r={r}
						candidature={candidatures.find((c) => c.id === r.candidatureId)}
						onErreur={onErreur}
					/>
				))}
			</ul>
		</section>
	);
}

export function PageRappels() {
	const rappels = useRessource<Rappel>("/rappels").liste.data;
	const candidatures = useRessource<Candidature>("/candidatures");
	const reglages = useReglages().data;
	const qc = useQueryClient();
	const [erreur, setErreur] = useState("");
	if (!rappels || !candidatures.liste.data || !reglages)
		return <p>Chargement…</p>;
	const liste = candidatures.liste.data;
	const auj = aujourdhui();
	const aFaire = rappels.filter((r) => r.statut === "a_faire");
	const limite = ajouterJours(auj, -reglages.delaiSansReponse);
	const sansReponse = liste.filter(
		(c) => c.statut === "envoyee" && c.dateEnvoi && c.dateEnvoi <= limite,
	);
	const agir = (p: Promise<unknown>) => p.catch((e) => setErreur(e.message));

	return (
		<>
			<h1 className="text-2xl font-bold">Rappels</h1>
			<p className={discret}>
				{reglages.emailsRappel
					? "Un e-mail récapitule vos rappels du jour à 7 h (heure de Paris)."
					: "Les e-mails de rappel sont désactivés."}{" "}
				<Link to="/parametres" className="underline">
					Modifier dans les paramètres
				</Link>
			</p>
			{erreur && (
				<p role="alert" className={alerte}>
					{erreur}
				</p>
			)}
			<details className="rounded-md border border-dashed border-zinc-400 p-4">
				<summary className="cursor-pointer font-semibold">
					Ajouter un rappel
				</summary>
				<div className="mt-4">
					<NouveauRappel candidatures={liste} />
				</div>
			</details>
			<details className="rounded-md border border-zinc-300 p-4 dark:border-zinc-700">
				<summary className="cursor-pointer font-semibold">
					Vue calendrier
				</summary>
				<div className="mt-4">
					<Calendrier rappels={rappels} aujourdhui={auj} />
				</div>
			</details>
			<p>
				<a href="/api/rappels/export.ics" download className="underline">
					Exporter les rappels à faire vers mon agenda (.ics)
				</a>
				<span className={`block text-sm ${discret}`}>
					Le fichier s'importe dans Google Agenda, Outlook ou Calendrier ; il
					n'est pas mis à jour automatiquement.
				</span>
			</p>

			{sansReponse.length > 0 && (
				<section className="flex flex-col gap-2">
					<h2 className="text-xl font-semibold">
						Sans réponse depuis plus de {reglages.delaiSansReponse} jours
					</h2>
					<p className={discret}>Relancer ou abandonner : à vous de décider.</p>
					<ul className="flex flex-col gap-2">
						{sansReponse.map((c) => (
							<li key={c.id} className={carte}>
								<Link
									to={`/candidatures/${c.id}`}
									className="font-medium underline"
								>
									{c.poste}
								</Link>
								<span className={`text-sm ${discret}`}>
									Envoyée le{" "}
									{new Date(`${c.dateEnvoi}T00:00`).toLocaleDateString("fr-FR")}
								</span>
								<span className="flex flex-wrap gap-2">
									<button
										type="button"
										className={boutonSecondaire}
										onClick={() =>
											agir(
												api(
													"/rappels",
													json("POST", {
														type: "relance",
														titre: `Relancer « ${c.poste} »`,
														date: auj,
														candidatureId: c.id,
													}),
												).then(() => qc.invalidateQueries()),
											)
										}
									>
										Programmer une relance aujourd'hui
										<span className="sr-only"> : {c.poste}</span>
									</button>
									<button
										type="button"
										className={boutonSecondaire}
										onClick={() =>
											window.confirm(
												`Passer « ${c.poste} » à « Abandonnée » ?`,
											) &&
											agir(
												candidatures.modifier(c.id, { statut: "abandonnee" }),
											)
										}
									>
										Abandonner<span className="sr-only"> : {c.poste}</span>
									</button>
								</span>
							</li>
						))}
					</ul>
				</section>
			)}

			<Section
				titre="En retard"
				rappels={aFaire.filter((r) => r.date < auj)}
				candidatures={liste}
				onErreur={setErreur}
			/>
			<Section
				titre="Aujourd'hui"
				rappels={aFaire.filter((r) => r.date === auj)}
				candidatures={liste}
				onErreur={setErreur}
			/>
			<Section
				titre="À venir"
				rappels={aFaire.filter((r) => r.date > auj)}
				candidatures={liste}
				onErreur={setErreur}
			/>
			{aFaire.length === 0 && <p className={discret}>Aucun rappel à faire.</p>}
			{rappels.some((r) => r.statut === "fait") && (
				<details>
					<summary className="cursor-pointer font-semibold">
						Rappels faits
					</summary>
					<ul className="mt-2 flex flex-col gap-2">
						{rappels
							.filter((r) => r.statut === "fait")
							.map((r) => (
								<ElementRappel
									key={r.id}
									r={r}
									candidature={liste.find((c) => c.id === r.candidatureId)}
									onErreur={setErreur}
								/>
							))}
					</ul>
				</details>
			)}
		</>
	);
}

export function RappelsCandidature({
	candidatureId,
	poste,
}: {
	candidatureId: string;
	poste: string;
}) {
	const rappels = useRessource<Rappel>("/rappels").liste.data ?? [];
	const [erreur, setErreur] = useState("");
	const siens = rappels.filter((r) => r.candidatureId === candidatureId);
	return (
		<section className="flex flex-col gap-3">
			<h2 className="text-xl font-semibold">Rappels</h2>
			{erreur && (
				<p role="alert" className={alerte}>
					{erreur}
				</p>
			)}
			{siens.length === 0 ? (
				<p className={discret}>Aucun rappel pour cette candidature.</p>
			) : (
				<ul className="flex flex-col gap-2">
					{siens.map((r) => (
						<ElementRappel key={r.id} r={r} onErreur={setErreur} />
					))}
				</ul>
			)}
			<details className="rounded-md border border-dashed border-zinc-400 p-4">
				<summary className="cursor-pointer font-semibold">
					Ajouter un rappel
				</summary>
				<div className="mt-4">
					<NouveauRappel candidatureId={candidatureId} posteParDefaut={poste} />
				</div>
			</details>
		</section>
	);
}

export function PageParametres() {
	const reglages = useReglages().data;
	if (!reglages) return <p>Chargement…</p>;
	return (
		<>
			<FormulaireReglages initial={reglages} />
			<AccordIa />
			<MesDonnees />
		</>
	);
}

function FormulaireReglages({ initial }: { initial: Reglages }) {
	const id = useId();
	const qc = useQueryClient();
	const [r, setR] = useState(initial);
	const [etat, setEtat] = useState<"" | "ok" | string>("");

	async function envoyer(e: FormEvent) {
		e.preventDefault();
		try {
			qc.setQueryData(
				["/reglages"],
				await api<Reglages>("/reglages", json("PUT", r)),
			);
			setEtat("ok");
		} catch (err) {
			setEtat((err as Error).message);
		}
	}

	return (
		<>
			<h1 className="text-2xl font-bold">Paramètres</h1>
			<form onSubmit={envoyer} className="flex flex-col gap-4">
				<fieldset className="flex flex-col gap-3 rounded-md border border-zinc-300 p-4 dark:border-zinc-700">
					<legend className="px-1 font-semibold">Rappels</legend>
					<label htmlFor={`${id}-relance`} className="font-medium">
						Relance proposée combien de jours après l'envoi
					</label>
					<input
						id={`${id}-relance`}
						type="number"
						min={1}
						max={60}
						required
						value={r.delaiRelance}
						onChange={(e) =>
							setR({ ...r, delaiRelance: Number(e.target.value) })
						}
						className={champ}
					/>
					<label htmlFor={`${id}-sans`} className="font-medium">
						Signaler une candidature sans réponse après combien de jours
					</label>
					<input
						id={`${id}-sans`}
						type="number"
						min={7}
						max={120}
						required
						value={r.delaiSansReponse}
						onChange={(e) =>
							setR({ ...r, delaiSansReponse: Number(e.target.value) })
						}
						className={champ}
					/>
					<label className="flex items-center gap-2">
						<input
							type="checkbox"
							checked={r.emailsRappel}
							onChange={(e) => setR({ ...r, emailsRappel: e.target.checked })}
						/>
						Recevoir un e-mail le jour de mes rappels (à 7 h, heure de Paris)
					</label>
				</fieldset>
				<button type="submit" className={bouton}>
					Enregistrer
				</button>
				{etat === "ok" && <p role="status">Paramètres enregistrés.</p>}
				{etat && etat !== "ok" && (
					<p role="alert" className={alerte}>
						{etat}
					</p>
				)}
			</form>
		</>
	);
}
