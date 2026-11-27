import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import {
	type ApercuEnvoi,
	type Candidature,
	type Envoi,
	type ModeEnvoi,
	modesEnvoi,
} from "../shared/schemas";
import { api, json } from "./api";
import { alerte, bouton, boutonSecondaire, champ, discret } from "./ui";

const dateFr = (iso: string) =>
	iso ? new Date(`${iso}T00:00`).toLocaleDateString("fr-FR") : "";

// Le contenu d'un envoi, identique dans l'aperçu et dans ce qui est conservé.
function Detail({ e }: { e: Envoi }) {
	const lignes: [string, React.ReactNode][] = [
		["Entreprise", e.entreprise],
		["Poste", e.poste],
		["Mode d'envoi", modesEnvoi[e.mode]],
		[e.mode === "email" ? "Destinataire" : "Site destinataire", e.destinataire],
		[
			"Lien de l'offre",
			e.lien && (
				<a
					key="lien"
					href={e.lien}
					target="_blank"
					rel="noreferrer"
					className="break-all underline"
				>
					{e.lien}
				</a>
			),
		],
		[
			"CV",
			e.cv
				? `${e.cv}${e.mode === "email" ? " (à joindre vous-même à l'e-mail)" : " (à déposer vous-même sur le site)"}`
				: "Aucun",
		],
		[
			"Lettre",
			e.lettre ? (
				<p key="l" className="whitespace-pre-line">
					{e.lettre}
				</p>
			) : (
				"Aucune"
			),
		],
		[
			"Réponses",
			e.reponses ? (
				<p key="r" className="whitespace-pre-line">
					{e.reponses}
				</p>
			) : (
				"Aucune"
			),
		],
		[
			"Coordonnées partagées",
			e.coordonnees.length ? (
				<ul key="c" className="list-disc pl-5">
					{e.coordonnees.map((c) => (
						<li key={c.libelle}>
							{c.libelle} : {c.valeur}
						</li>
					))}
				</ul>
			) : (
				"Aucune"
			),
		],
	];
	return (
		<dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
			{lignes.map(([k, v]) => (
				<div key={k} className="contents">
					<dt className={`${discret} sm:pt-0 pt-2`}>{k}</dt>
					<dd>{v || "—"}</dd>
				</div>
			))}
		</dl>
	);
}

// Candidature assistée : Relance prépare, montre un aperçu complet, puis l'utilisateur envoie lui-même.
export function PreparerEnvoi({ c }: { c: Candidature }) {
	const id = useId();
	const qc = useQueryClient();
	const [mode, setMode] = useState<ModeEnvoi>(c.lien ? "site" : "email");
	const [reponses, setReponses] = useState(c.reponsesFormulaire);
	const [apercu, setApercu] = useState<ApercuEnvoi>();
	const [enCours, setEnCours] = useState(false);
	const [erreur, setErreur] = useState("");
	const [ouvert, setOuvert] = useState(false);

	if (c.statut !== "brouillon")
		return c.envoi ? (
			<details className="rounded-md border border-zinc-300 p-4 dark:border-zinc-700">
				<summary className="cursor-pointer text-xl font-semibold">
					Ce qui a été transmis le {dateFr(c.envoi.date)}
				</summary>
				<div className="mt-3">
					<Detail e={c.envoi} />
				</div>
			</details>
		) : null;

	async function agir(f: () => Promise<unknown>) {
		setEnCours(true);
		setErreur("");
		try {
			await f();
		} catch (e) {
			setErreur((e as Error).message);
		} finally {
			setEnCours(false);
		}
	}

	const voirApercu = () =>
		agir(async () => {
			if (reponses !== c.reponsesFormulaire) {
				await api(
					`/candidatures/${c.id}`,
					json("PATCH", { reponsesFormulaire: reponses }),
				);
				await qc.invalidateQueries({ queryKey: ["/candidatures"] });
			}
			setApercu(
				await api<ApercuEnvoi>(`/candidatures/${c.id}/envoi?mode=${mode}`),
			);
		});

	function confirmer() {
		if (!apercu) return;
		// Ouvert tout de suite, dans le geste de l'utilisateur, sinon le navigateur bloque la fenêtre.
		if (apercu.mode === "email") {
			const corps = [apercu.lettre, apercu.reponses]
				.filter(Boolean)
				.join("\n\n");
			window.location.href = `mailto:${encodeURIComponent(apercu.destinataire)}?subject=${encodeURIComponent(
				`Candidature : ${apercu.poste}`,
			)}&body=${encodeURIComponent(corps)}`;
		} else window.open(apercu.lien, "_blank", "noopener");
		agir(async () => {
			await api(`/candidatures/${c.id}/envoi`, json("POST", { mode }));
			setApercu(undefined);
			await qc.invalidateQueries();
		});
	}

	return (
		<details
			open={ouvert}
			onToggle={(e) => setOuvert(e.currentTarget.open)}
			className="rounded-md border border-zinc-300 p-4 dark:border-zinc-700"
		>
			<summary className="cursor-pointer text-xl font-semibold">
				Préparer l'envoi
			</summary>
			<div className="mt-3 flex flex-col gap-3">
				{!apercu ? (
					<>
						<fieldset className="flex flex-col gap-2">
							<legend className="font-medium">Mode d'envoi</legend>
							{(Object.keys(modesEnvoi) as ModeEnvoi[]).map((m) => (
								<label key={m} className="flex items-start gap-2">
									<input
										type="radio"
										name={`${id}-mode`}
										checked={mode === m}
										onChange={() => setMode(m)}
										className="mt-1"
									/>
									<span>
										{modesEnvoi[m]}
										<span className={`block text-sm ${discret}`}>
											{m === "email"
												? "Relance ouvre votre messagerie avec la lettre ; vous joignez le CV et envoyez vous-même."
												: "Relance ouvre le site de l'offre ; vous y postulez vous-même."}
										</span>
									</span>
								</label>
							))}
						</fieldset>
						<label htmlFor={`${id}-reponses`} className="font-medium">
							Réponses au formulaire (facultatif)
						</label>
						<textarea
							id={`${id}-reponses`}
							rows={4}
							maxLength={20000}
							className={champ}
							value={reponses}
							onChange={(e) => setReponses(e.target.value)}
						/>
						<p className={`text-sm ${discret}`}>
							Le CV et la lettre se choisissent avec « Modifier » ; l'IA peut
							rédiger un brouillon de lettre ou de réponses plus bas.
						</p>
						<button
							type="button"
							className={bouton}
							onClick={voirApercu}
							disabled={enCours}
						>
							Voir l'aperçu avant envoi
						</button>
					</>
				) : (
					<section
						aria-labelledby={`${id}-apercu`}
						className="flex flex-col gap-3"
					>
						<h3 id={`${id}-apercu`} className="text-lg font-semibold">
							Aperçu avant envoi
						</h3>
						<Detail e={apercu} />
						{apercu.manquants.length > 0 && (
							<p>
								<strong>Informations manquantes :</strong>{" "}
								{apercu.manquants.join(", ")}.
							</p>
						)}
						{apercu.bloquant && (
							<p role="alert" className={alerte}>
								{apercu.bloquant}
							</p>
						)}
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								className={boutonSecondaire}
								onClick={() => setApercu(undefined)}
							>
								Modifier
							</button>
							<button
								type="button"
								className={boutonSecondaire}
								onClick={() => {
									setApercu(undefined);
									setOuvert(false);
								}}
							>
								Annuler
							</button>
							<button
								type="button"
								className={bouton}
								disabled={enCours || !!apercu.bloquant}
								onClick={confirmer}
							>
								Confirmer l'envoi
							</button>
						</div>
						<p className={`text-sm ${discret}`}>
							La confirmation passe la candidature à « Envoyée » à la date du
							jour et conserve ce qui est affiché ci-dessus.
						</p>
					</section>
				)}
				{erreur && (
					<p role="alert" className={alerte}>
						{erreur}
					</p>
				)}
			</div>
		</details>
	);
}
