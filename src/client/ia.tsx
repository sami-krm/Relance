import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Link } from "react-router";
import {
	type DonneesIa,
	type EtatIa,
	type TypeBrouillon,
	typesBrouillon,
} from "../shared/schemas";
import { api, json } from "./api";
import { alerte, bouton, boutonSecondaire, champ, discret } from "./ui";

const useEtatIa = () =>
	useQuery({ queryKey: ["ia"], queryFn: () => api<EtatIa>("/ia") });

function Donnees({ d }: { d: DonneesIa }) {
	const liste = (lignes: DonneesIa["profil"]) => (
		<ul className="list-disc pl-5">
			{lignes.map((l) => (
				<li key={l.libelle}>
					<span className={discret}>{l.libelle} :</span>{" "}
					<span className="whitespace-pre-line">
						{l.valeur.length > 300 ? `${l.valeur.slice(0, 300)}…` : l.valeur}
					</span>
				</li>
			))}
		</ul>
	);
	return (
		<div className="flex flex-col gap-2 text-sm">
			<p>
				<strong>Service qui reçoit les données :</strong> {d.service}.
			</p>
			<p>
				<strong>Votre profil</strong> (seulement les champs que vous avez
				autorisés au partage, modifiables dans votre{" "}
				<Link
					to="/profil"
					className="font-medium text-accent-700 underline decoration-accent-300 hover:decoration-current dark:text-accent-300 dark:decoration-accent-700"
				>
					profil
				</Link>
				) :
			</p>
			{d.profil.length ? (
				liste(d.profil)
			) : (
				<p className={discret}>Aucun champ autorisé.</p>
			)}
			<p>
				<strong>Cette candidature :</strong>
			</p>
			{liste(d.candidature)}
			<p className={discret}>
				Votre CV n'est jamais envoyé, et l'IA ne rédige jamais de CV.
			</p>
		</div>
	);
}

// Brouillons de lettre, d'e-mails et de réponses, à partir des seules données affichées.
export function BrouillonsIa({
	candidatureId,
	poste,
	spontanee,
	envoyee,
	onUtiliserLettre,
}: {
	candidatureId: string;
	poste: string;
	spontanee: boolean;
	envoyee: boolean;
	onUtiliserLettre: (texte: string) => Promise<unknown>;
}) {
	const id = useId();
	const qc = useQueryClient();
	const etat = useEtatIa();
	const donnees = useQuery({
		queryKey: ["ia", "donnees", candidatureId],
		queryFn: () => api<DonneesIa>(`/ia/donnees/${candidatureId}`),
	});
	const [questions, setQuestions] = useState("");
	const [resultat, setResultat] = useState<{
		type: TypeBrouillon;
		texte: string;
	}>();
	const [enCours, setEnCours] = useState(false);
	const [message, setMessage] = useState("");
	const [erreur, setErreur] = useState("");

	const types: TypeBrouillon[] = [
		"lettre",
		...(spontanee ? (["spontanee"] as const) : []),
		...(envoyee ? (["relance"] as const) : []),
		"reponses",
	];

	async function agir(f: () => Promise<unknown>, succes = "") {
		setEnCours(true);
		setErreur("");
		setMessage("");
		try {
			await f();
			setMessage(succes);
		} catch (e) {
			setErreur((e as Error).message);
		} finally {
			setEnCours(false);
		}
	}

	const generer = (type: TypeBrouillon) =>
		agir(async () => {
			const r = await api<{ texte: string }>(
				"/ia/brouillon",
				json("POST", { type, candidatureId, questions }),
			);
			setResultat({ type, texte: r.texte });
			await qc.invalidateQueries({ queryKey: ["ia"], exact: true });
		});

	const enregistrer = (type: "lettre" | "reponse", texte: string) =>
		agir(async () => {
			await api(
				"/documents",
				json("POST", {
					type,
					nom: `${resultat ? typesBrouillon[resultat.type] : "Brouillon"} – ${poste}`.slice(
						0,
						120,
					),
					contenu: texte,
				}),
			);
			await qc.invalidateQueries({ queryKey: ["/documents"] });
		}, "Enregistré dans vos documents.");

	return (
		<details className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
			<summary className="text-lg font-semibold">Brouillons avec l'IA</summary>
			<div className="mt-3 flex flex-col gap-3">
				{!etat.data || !donnees.data ? (
					etat.isError || donnees.isError ? (
						<p className={alerte}>Impossible de charger l'IA.</p>
					) : (
						<p>Chargement…</p>
					)
				) : !etat.data.accord ? (
					<>
						<p>
							L'IA peut rédiger un brouillon de lettre, d'e-mail ou de réponses
							que vous relisez et modifiez. Avant tout envoi, voici exactement
							ce qu'elle recevra :
						</p>
						<Donnees d={donnees.data} />
						<p className="text-sm">
							Votre accord vaut pour toutes vos candidatures. Vous pouvez le
							retirer à tout moment dans les{" "}
							<Link
								to="/parametres"
								className="font-medium text-accent-700 underline decoration-accent-300 hover:decoration-current dark:text-accent-300 dark:decoration-accent-700"
							>
								paramètres
							</Link>
							.
						</p>
						<button
							type="button"
							className={bouton}
							disabled={enCours}
							onClick={() =>
								agir(async () => {
									await api("/ia/accord", json("PUT", { accord: true }));
									await qc.invalidateQueries({ queryKey: ["ia"] });
								})
							}
						>
							J'accepte d'envoyer ces données
						</button>
					</>
				) : (
					<>
						<p className={`text-sm ${discret}`}>
							{etat.data.restant} brouillon{etat.data.restant > 1 ? "s" : ""}{" "}
							restant{etat.data.restant > 1 ? "s" : ""} aujourd'hui sur{" "}
							{etat.data.quota}.
						</p>
						<details className="text-sm">
							<summary className="cursor-pointer">Données envoyées</summary>
							<div className="mt-2">
								<Donnees d={donnees.data} />
							</div>
						</details>
						<label htmlFor={`${id}-questions`} className="font-medium">
							Questions du formulaire (pour « Réponses aux questions »)
						</label>
						<textarea
							id={`${id}-questions`}
							rows={3}
							maxLength={3000}
							className={champ}
							value={questions}
							onChange={(e) => setQuestions(e.target.value)}
						/>
						<div className="flex flex-wrap gap-2">
							{types.map((t) => (
								<button
									key={t}
									type="button"
									className={boutonSecondaire}
									disabled={
										enCours ||
										etat.data.restant <= 0 ||
										(t === "reponses" && !questions.trim())
									}
									onClick={() => generer(t)}
								>
									{typesBrouillon[t]}
								</button>
							))}
						</div>
						{enCours && !resultat && <p>Rédaction en cours…</p>}
					</>
				)}

				{erreur && (
					<p role="alert" className={alerte}>
						{erreur}
					</p>
				)}
				{resultat && (
					<section className="flex flex-col gap-2" aria-live="polite">
						<label htmlFor={`${id}-brouillon`} className="font-semibold">
							Brouillon : {typesBrouillon[resultat.type]} (à relire et modifier)
						</label>
						{resultat.texte.includes("[à compléter]") && (
							<p className="text-sm">
								Remplacez chaque « [à compléter] » : l'IA n'avait pas
								l'information.
							</p>
						)}
						<textarea
							id={`${id}-brouillon`}
							rows={14}
							maxLength={20000}
							className={champ}
							value={resultat.texte}
							onChange={(e) =>
								setResultat({ ...resultat, texte: e.target.value })
							}
						/>
						<div className="flex flex-wrap gap-2">
							{resultat.type === "lettre" && (
								<button
									type="button"
									className={boutonSecondaire}
									disabled={enCours}
									onClick={() =>
										agir(
											() => onUtiliserLettre(resultat.texte),
											"Lettre enregistrée dans cette candidature.",
										)
									}
								>
									Utiliser comme lettre de cette candidature
								</button>
							)}
							{(resultat.type === "lettre" || resultat.type === "reponses") && (
								<button
									type="button"
									className={boutonSecondaire}
									disabled={enCours}
									onClick={() =>
										enregistrer(
											resultat.type === "lettre" ? "lettre" : "reponse",
											resultat.texte,
										)
									}
								>
									Enregistrer dans mes documents
								</button>
							)}
							<button
								type="button"
								className={boutonSecondaire}
								onClick={() =>
									agir(
										() => navigator.clipboard.writeText(resultat.texte),
										"Texte copié.",
									)
								}
							>
								Copier
							</button>
						</div>
					</section>
				)}
				{message && <p className="text-sm">{message}</p>}
			</div>
		</details>
	);
}

// Réglage de l'accord : on peut le retirer ici ; on le donne depuis une candidature, après avoir vu les données.
export function AccordIa() {
	const qc = useQueryClient();
	const etat = useEtatIa();
	const [erreur, setErreur] = useState("");
	if (!etat.data) return null;
	return (
		<section className="flex flex-col gap-2">
			<h2 className="text-xl font-semibold">Brouillons avec l'IA</h2>
			{etat.data.accord ? (
				<>
					<p>
						Vous avez accepté que les champs autorisés de votre profil et la
						candidature concernée soient envoyés à Cloudflare Workers AI pour
						rédiger des brouillons.
					</p>
					<button
						type="button"
						className={`${boutonSecondaire} self-start`}
						onClick={() =>
							api("/ia/accord", json("PUT", { accord: false }))
								.then(() => qc.invalidateQueries({ queryKey: ["ia"] }))
								.catch((e) => setErreur((e as Error).message))
						}
					>
						Retirer mon accord
					</button>
				</>
			) : (
				<p className={discret}>
					Aucun accord donné : rien n'est envoyé à un service d'IA. Vous pouvez
					le donner depuis une candidature, après avoir vu les données envoyées.
				</p>
			)}
			{erreur && (
				<p role="alert" className={alerte}>
					{erreur}
				</p>
			)}
		</section>
	);
}
