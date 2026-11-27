import { useState } from "react";
import { ajouterJours, type Rappel, typesRappel } from "../shared/schemas";
import { boutonSecondaire, discret } from "./ui";

const jours = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const joursLongs = [
	"lundi",
	"mardi",
	"mercredi",
	"jeudi",
	"vendredi",
	"samedi",
	"dimanche",
];
const nomMois = (annee: number, mois: number) =>
	new Date(Date.UTC(annee, mois, 1)).toLocaleDateString("fr-FR", {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});

// Vue mensuelle des rappels à faire, semaines commençant le lundi.
export function Calendrier({
	rappels,
	aujourdhui,
}: {
	rappels: Rappel[];
	aujourdhui: string;
}) {
	const [annee0, mois0] = aujourdhui.split("-").map(Number);
	const [vue, setVue] = useState({ annee: annee0, mois: mois0 - 1 });
	const premier = `${vue.annee}-${String(vue.mois + 1).padStart(2, "0")}-01`;
	// Décalage du 1er du mois par rapport au lundi (0 à 6).
	const decalage = (new Date(`${premier}T00:00:00Z`).getUTCDay() + 6) % 7;
	const debut = ajouterJours(premier, -decalage);
	const semaines = Array.from({ length: 6 }, (_, s) =>
		Array.from({ length: 7 }, (_, j) => ajouterJours(debut, s * 7 + j)),
	).filter((semaine) => semaine.some((d) => d.startsWith(premier.slice(0, 7))));
	const parJour = Map.groupBy(
		rappels.filter((r) => r.statut === "a_faire"),
		(r) => r.date,
	);
	const changer = (delta: number) =>
		setVue(({ annee, mois }) => {
			const m = mois + delta;
			return { annee: annee + Math.floor(m / 12), mois: (m + 12) % 12 };
		});

	return (
		<section className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2">
				<button
					type="button"
					className={boutonSecondaire}
					onClick={() => changer(-1)}
				>
					← <span className="sr-only">Mois précédent</span>
				</button>
				<h2 className="text-xl font-semibold first-letter:uppercase">
					{nomMois(vue.annee, vue.mois)}
				</h2>
				<button
					type="button"
					className={boutonSecondaire}
					onClick={() => changer(1)}
				>
					→ <span className="sr-only">Mois suivant</span>
				</button>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full table-fixed border-collapse text-xs sm:text-sm">
					<caption className="sr-only">
						Rappels à faire, {nomMois(vue.annee, vue.mois)}
					</caption>
					<thead>
						<tr>
							{jours.map((j, i) => (
								<th key={j} scope="col" className={`py-1 ${discret}`}>
									<abbr title={joursLongs[i]} className="no-underline">
										{j}
									</abbr>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{semaines.map((semaine) => (
							<tr key={semaine[0]}>
								{semaine.map((d) => {
									const dehors = !d.startsWith(premier.slice(0, 7));
									const liste = parJour.get(d) ?? [];
									return (
										<td
											key={d}
											className={`h-16 border border-zinc-300 p-1 align-top dark:border-zinc-700 ${dehors ? "opacity-40" : ""} ${d === aujourdhui ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
										>
											<span
												className="font-medium"
												aria-current={d === aujourdhui ? "date" : undefined}
											>
												{Number(d.slice(8))}
											</span>
											<ul>
												{liste.map((r) => (
													<li key={r.id} className="truncate" title={r.titre}>
														<span className="sr-only">
															{typesRappel[r.type]} :{" "}
														</span>
														{r.titre}
													</li>
												))}
											</ul>
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}
