import { useId, useState } from "react";
import { api, json } from "./api";
import { alerte, boutonSecondaire, champ, discret } from "./ui";

export function MesDonnees() {
	const id = useId();
	const [confirmation, setConfirmation] = useState("");
	const [erreur, setErreur] = useState("");
	const [enCours, setEnCours] = useState(false);

	async function supprimer() {
		setEnCours(true);
		setErreur("");
		try {
			await api("/compte", json("DELETE", { confirmation }));
			window.location.assign("/?compte=supprime");
		} catch (e) {
			setErreur((e as Error).message);
			setEnCours(false);
		}
	}

	return (
		<>
			<section className="flex flex-col gap-3 rounded-md border border-zinc-300 p-4 dark:border-zinc-700">
				<h2 className="font-semibold">Mes données</h2>
				<p className={discret}>
					Le fichier CSV s'ouvre dans Excel, LibreOffice ou Google Sheets.
				</p>
				<a
					href="/api/compte/export.csv"
					download
					className={`${boutonSecondaire} self-start`}
				>
					Exporter mes candidatures (CSV)
				</a>
			</section>
			<section className="flex flex-col gap-3 rounded-md border border-red-700 p-4 dark:border-red-400">
				<h2 className="font-semibold">Supprimer mon compte</h2>
				<p>
					Votre compte, votre profil, vos CV, lettres, entreprises, contacts,
					offres, candidatures et rappels sont effacés définitivement. Cette
					action ne peut pas être annulée : exportez d'abord vos candidatures si
					vous voulez les garder.
				</p>
				<label htmlFor={id} className="font-medium">
					Tapez SUPPRIMER pour confirmer
				</label>
				<input
					id={id}
					value={confirmation}
					onChange={(e) => setConfirmation(e.target.value)}
					autoComplete="off"
					className={champ}
				/>
				<button
					type="button"
					disabled={confirmation !== "SUPPRIMER" || enCours}
					onClick={supprimer}
					className="self-start rounded-md bg-red-700 px-4 py-2 font-medium text-white hover:bg-red-800 disabled:opacity-50"
				>
					{enCours ? "Suppression…" : "Supprimer définitivement mon compte"}
				</button>
				{erreur && (
					<p role="alert" className={alerte}>
						{erreur}
					</p>
				)}
			</section>
		</>
	);
}
