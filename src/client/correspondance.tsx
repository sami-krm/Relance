import { useQuery } from "@tanstack/react-query";
import { correspondance } from "../shared/correspondance";
import type { Profil } from "../shared/schemas";
import { api } from "./api";
import { discret } from "./ui";

const signes = { plus: "＋", moins: "－", neutre: "·" } as const;
const lus = {
	plus: "augmente",
	moins: "diminue",
	neutre: "sans effet",
} as const;

// Aide au tri entre le profil et une offre ; rien ne s'affiche tant que le profil est vide.
export function EstimationCorrespondance({
	offre,
}: {
	offre: {
		intitule: string;
		description: string;
		lieu: string;
		contrat?: string;
		dateDebut?: string;
	};
}) {
	const profil = useQuery({
		queryKey: ["profil"],
		queryFn: () => api<Profil>("/profil"),
	});
	if (!profil.data) return null;
	const r = correspondance(profil.data.valeurs, offre);
	if (!r.criteres.length) return null;
	return (
		<details className="text-sm">
			<summary className="cursor-pointer">
				Correspondance estimée avec votre profil : {r.score} %
			</summary>
			<ul className="mt-2 flex flex-col gap-1">
				{r.criteres.map((c) => (
					<li key={c.nom}>
						<span aria-hidden="true">{signes[c.effet]} </span>
						<strong>{c.nom}</strong>
						<span className="sr-only"> ({lus[c.effet]})</span> : {c.explication}
					</li>
				))}
			</ul>
			<p className={`mt-1 ${discret}`}>
				Estimation pour vous aider à trier, jamais une garantie.
			</p>
		</details>
	);
}
