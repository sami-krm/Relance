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
import {
	alerte,
	bouton,
	boutonSecondaire,
	Chargement,
	carte,
	champ,
	discret,
	EnTete,
	EtatVide,
	lien,
} from "./ui";

const aujourdhui = () => new Date().toLocaleDateString("sv-SE");
const dateFr = (iso: string) =>
	new Date(`${iso}T00:00`).toLocaleDateString("fr-FR", {
		weekday: "short",
		day: "numeric",
		month: "short",
	});

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

	const enRetard = !fait && r.date < aujourdhui();

	return (
		<li className="flex items-start gap-3 py-3">
			<button
				type="button"
				aria-pressed={fait}
				onClick={() =>
					agir(modifier(r.id, { statut: fait ? "a_faire" : "fait" }))
				}
				className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border text-xs font-bold transition-colors ${
					fait
						? "border-teal-600 bg-teal-600 text-white dark:border-teal-400 dark:bg-teal-400 dark:text-teal-950"
						: "border-zinc-400 hover:border-teal-500 dark:border-zinc-600"
				}`}
			>
				<span aria-hidden="true">{fait ? "✓" : ""}</span>
				<span className="sr-only">
					{fait ? "Remettre à faire" : "Marquer comme fait"} : {r.titre}
				</span>
			</button>
			<div className="flex min-w-0 grow flex-col gap-0.5">
				<span
					className={`font-medium ${fait ? `line-through ${discret}` : ""}`}
				>
					{r.titre}
				</span>
				<span className={`text-sm ${discret}`}>
					{typesRappel[r.type]} ·{" "}
					<span
						className={
							enRetard ? "font-medium text-rose-700 dark:text-rose-300" : ""
						}
					>
						{enRetard ? "en retard, " : ""}
						{dateFr(r.date)}
					</span>
				</span>
				{candidature && (
					<Link
						to={`/candidatures/${candidature.id}`}
						className={`text-sm ${lien}`}
					>
						{candidature.poste}
					</Link>
				)}
			</div>
			<div className="flex shrink-0 items-center gap-1">
				{!fait && (
					<details className="relative">
						<summary className={`${boutonSecondaire} list-none`}>
							Reporter<span className="sr-only"> : {r.titre}</span>
						</summary>
						<div className="absolute right-0 z-20 mt-1 flex w-64 flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
							<div className="flex gap-2">
								<button
									type="button"
									className={`${boutonSecondaire} grow`}
									onClick={() => reporter(3)}
								>
									+3 jours
								</button>
								<button
									type="button"
									className={`${boutonSecondaire} grow`}
									onClick={() => reporter(7)}
								>
									+1 semaine
								</button>
							</div>
							<label htmlFor={id} className={`text-sm ${discret}`}>
								Ou à une date précise
							</label>
							<div className="flex gap-2">
								<input
									id={id}
									type="date"
									value={date}
									onChange={(e) => setDate(e.target.value)}
									className={`${champ} min-w-0 grow py-1 text-sm`}
								/>
								<button
									type="button"
									className={boutonSecondaire}
									disabled={!date}
									onClick={() =>
										agir(modifier(r.id, { date }).then(() => setDate("")))
									}
								>
									OK
								</button>
							</div>
						</div>
					</details>
				)}
				<button
					type="button"
					className={`rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${discret}`}
					onClick={() =>
						window.confirm(`Supprimer le rappel « ${r.titre} » ?`) &&
						agir(supprimer(r.id))
					}
				>
					Supprimer<span className="sr-only"> : {r.titre}</span>
				</button>
			</div>
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
		<section className={carte}>
			<h2 className="flex items-baseline gap-2">
				{titre}
				<span className={`text-sm font-normal tabular-nums ${discret}`}>
					{rappels.length}
				</span>
			</h2>
			<ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
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
	if (!rappels || !candidatures.liste.data || !reglages) return <Chargement />;
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
			<EnTete
				titre="Rappels"
				description={
					<>
						{reglages.emailsRappel
							? "Un e-mail récapitule vos rappels du jour à 7 h (heure de Paris)."
							: "Les e-mails de rappel sont désactivés."}{" "}
						<Link to="/parametres" className={lien}>
							Modifier
						</Link>
					</>
				}
				actions={
					<a
						href="/api/rappels/export.ics"
						download
						className={boutonSecondaire}
					>
						Exporter (.ics)
					</a>
				}
			/>
			{erreur && (
				<p role="alert" className={alerte}>
					{erreur}
				</p>
			)}
			<details className={carte}>
				<summary className="font-semibold">Ajouter un rappel</summary>
				<div className="mt-3">
					<NouveauRappel candidatures={liste} />
				</div>
			</details>
			<details className={carte}>
				<summary className="font-semibold">Vue calendrier</summary>
				<div className="mt-4">
					<Calendrier rappels={rappels} aujourdhui={auj} />
				</div>
			</details>
			<p className={`text-sm ${discret}`}>
				L'export .ics s'importe dans Google Agenda, Outlook ou Calendrier ; il
				n'est pas mis à jour automatiquement.
			</p>

			{sansReponse.length > 0 && (
				<section className={`${carte} border-amber-200 dark:border-amber-900`}>
					<h2>Sans réponse depuis plus de {reglages.delaiSansReponse} jours</h2>
					<p className={`text-sm ${discret}`}>
						Relancer ou abandonner : à vous de décider.
					</p>
					<ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
						{sansReponse.map((c) => (
							<li key={c.id} className="flex flex-col gap-2 py-3">
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
			{aFaire.length === 0 && (
				<EtatVide titre="Aucun rappel à faire">
					Les relances sont proposées automatiquement une semaine après chaque
					envoi. Ajoutez un rappel pour un entretien ou une date limite.
				</EtatVide>
			)}
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
		<section className={carte}>
			<h2>Rappels</h2>
			{erreur && (
				<p role="alert" className={alerte}>
					{erreur}
				</p>
			)}
			{siens.length === 0 ? (
				<p className={`text-sm ${discret}`}>
					Aucun rappel pour cette candidature.
				</p>
			) : (
				<ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
					{siens.map((r) => (
						<ElementRappel key={r.id} r={r} onErreur={setErreur} />
					))}
				</ul>
			)}
			<details className="rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
				<summary className="text-sm font-semibold">Ajouter un rappel</summary>
				<div className="mt-3">
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
			<h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
			<form onSubmit={envoyer} className="flex flex-col gap-4">
				<fieldset className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
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
