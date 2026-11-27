import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type Profil, sectionsProfil } from "../shared/schemas";
import { api, json } from "./api";
import { authClient } from "./auth";
import { alerte, bouton, Chargement, champ, discret, EnTete } from "./ui";

const typesInput: Record<string, string> = {
	tel: "tel",
	url: "url",
	date: "date",
};

export function PageProfil() {
	const profil = useQuery({
		queryKey: ["profil"],
		queryFn: () => api<Profil>("/profil"),
	});
	const session = authClient.useSession();
	if (profil.isError)
		return (
			<p role="alert" className={alerte}>
				Impossible de charger le profil.
			</p>
		);
	if (!profil.data) return <Chargement />;
	return (
		<FormulaireProfil
			initial={profil.data}
			email={session.data?.user.email ?? ""}
		/>
	);
}

function CasePartage({
	libelle,
	coche,
	basculer,
}: {
	libelle: string;
	coche: boolean;
	basculer: () => void;
}) {
	return (
		<label className={`flex items-center gap-2 text-sm ${discret}`}>
			<input type="checkbox" checked={coche} onChange={basculer} />
			Utilisable dans mes candidatures
			<span className="sr-only"> ({libelle})</span>
		</label>
	);
}

function FormulaireProfil({
	initial,
	email,
}: {
	initial: Profil;
	email: string;
}) {
	const qc = useQueryClient();
	const [valeurs, setValeurs] = useState(initial.valeurs);
	const [partages, setPartages] = useState(new Set(initial.partages));
	const enregistrer = useMutation({
		mutationFn: () =>
			api<Profil>("/profil", json("PUT", { valeurs, partages: [...partages] })),
		onSuccess: (p) => qc.setQueryData(["profil"], p),
	});
	const invalides = new Set(
		(enregistrer.error as { champs?: string[] } | null)?.champs ?? [],
	);
	const basculer = (cle: string) =>
		setPartages((avant) => {
			const apres = new Set(avant);
			if (!apres.delete(cle)) apres.add(cle);
			return apres;
		});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				enregistrer.mutate();
			}}
			className="flex flex-col gap-6"
		>
			<EnTete
				titre="Profil"
				description="Tous les champs sont facultatifs. Seules les informations cochées « Utilisable dans mes candidatures » sont reprises : dans l'aperçu d'envoi, et dans les brouillons de l'IA si vous l'avez accepté."
			/>

			{sectionsProfil.map((section, i) => (
				<fieldset
					key={section.titre}
					className="flex flex-col gap-5 rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
				>
					<legend className="px-1 font-semibold">{section.titre}</legend>
					{i === 0 && (
						<div className="flex flex-col gap-1">
							<p className="font-medium">Adresse e-mail</p>
							<p>{email}</p>
							<CasePartage
								libelle="Adresse e-mail"
								coche={partages.has("email")}
								basculer={() => basculer("email")}
							/>
						</div>
					)}
					{section.champs.map((c) => {
						const commun = {
							id: `champ-${c.cle}`,
							value: valeurs[c.cle] ?? "",
							"aria-invalid": invalides.has(c.cle) || undefined,
							className: champ,
							onChange: (
								e: React.ChangeEvent<
									HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
								>,
							) => setValeurs({ ...valeurs, [c.cle]: e.target.value }),
						};
						return (
							<div key={c.cle} className="flex flex-col gap-1">
								<label htmlFor={commun.id} className="font-medium">
									{c.libelle}
								</label>
								{c.type === "long" ? (
									<textarea rows={5} maxLength={5000} {...commun} />
								) : c.type === "choix" ? (
									<select {...commun}>
										<option value="">—</option>
										{c.options?.map((o) => (
											<option key={o}>{o}</option>
										))}
									</select>
								) : c.type === "nombre" ? (
									<input inputMode="numeric" pattern="\d{0,4}" {...commun} />
								) : (
									<input
										type={typesInput[c.type ?? ""] ?? "text"}
										maxLength={c.type === "url" ? 300 : 200}
										{...commun}
									/>
								)}
								<CasePartage
									libelle={c.libelle}
									coche={partages.has(c.cle)}
									basculer={() => basculer(c.cle)}
								/>
							</div>
						);
					})}
				</fieldset>
			))}

			<button type="submit" className={bouton} disabled={enregistrer.isPending}>
				{enregistrer.isPending ? "Enregistrement…" : "Enregistrer le profil"}
			</button>
			{enregistrer.isSuccess && <p role="status">Profil enregistré.</p>}
			{enregistrer.isError && (
				<p role="alert" className={alerte}>
					{enregistrer.error.message}{" "}
					{sectionsProfil
						.flatMap((s) => s.champs)
						.filter((c) => invalides.has(c.cle))
						.map((c) => c.libelle)
						.join(", ")}
				</p>
			)}
		</form>
	);
}
