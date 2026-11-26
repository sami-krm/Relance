import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { type Document, TAILLE_MAX_CV } from "../shared/schemas";
import { api, json } from "./api";
import { alerte, bouton, boutonSecondaire, champ, discret } from "./ui";

const libelles = {
	cv: "CV",
	lettre: "Lettre de motivation",
	reponse: "Réponse type",
};
const date = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");

function useDocuments() {
	const qc = useQueryClient();
	const rafraichir = () => qc.invalidateQueries({ queryKey: ["documents"] });
	const modifier = useMutation({
		mutationFn: ({
			id,
			...corps
		}: {
			id: string;
			nom?: string;
			parDefaut?: true;
		}) => api(`/documents/${id}`, json("PATCH", corps)),
		onSuccess: rafraichir,
	});
	const supprimer = useMutation({
		mutationFn: (id: string) => api(`/documents/${id}`, { method: "DELETE" }),
		onSuccess: rafraichir,
	});
	return { rafraichir, modifier, supprimer };
}

export function PageDocuments() {
	const docs = useQuery({
		queryKey: ["documents"],
		queryFn: () => api<Document[]>("/documents"),
	});
	const { modifier, supprimer } = useDocuments();
	const erreur = modifier.error ?? supprimer.error;
	if (docs.isError)
		return (
			<p role="alert" className={alerte}>
				Impossible de charger les documents.
			</p>
		);
	if (!docs.data) return <p>Chargement…</p>;
	const cvs = docs.data.filter((d) => d.type === "cv");
	const textes = docs.data.filter((d) => d.type !== "cv");

	const renommer = (d: Document) => {
		const nom = window.prompt("Nouveau nom", d.nom)?.trim();
		if (nom) modifier.mutate({ id: d.id, nom });
	};
	const effacer = (d: Document) => {
		if (window.confirm(`Supprimer « ${d.nom} » ? Cette action est définitive.`))
			supprimer.mutate(d.id);
	};

	return (
		<>
			<h1 className="text-2xl font-bold">Mes documents</h1>
			{erreur && (
				<p role="alert" className={alerte}>
					{erreur.message}
				</p>
			)}

			<section aria-labelledby="titre-cv" className="flex flex-col gap-4">
				<h2 id="titre-cv" className="text-xl font-semibold">
					CV
				</h2>
				<p className={discret}>
					PDF de 5 Mo au plus. Relance conserve votre fichier tel quel et ne le
					modifie jamais.
				</p>
				<ImportCv />
				{cvs.length === 0 ? (
					<p className={discret}>Aucun CV pour l'instant.</p>
				) : (
					<ul className="flex flex-col gap-2">
						{cvs.map((cv) => (
							<li
								key={cv.id}
								className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-zinc-300 p-3 dark:border-zinc-700"
							>
								<span className="font-medium">{cv.nom}</span>
								<span className={`text-sm ${discret}`}>
									{Math.max(1, Math.round((cv.taille ?? 0) / 1024))} Ko, importé
									le {date(cv.createdAt)}
								</span>
								{cv.parDefaut && (
									<span className="rounded bg-zinc-200 px-2 text-sm dark:bg-zinc-700">
										Par défaut
									</span>
								)}
								<span className="ml-auto flex flex-wrap gap-2">
									<a
										href={`/api/documents/${cv.id}/fichier`}
										target="_blank"
										rel="noreferrer"
										className={boutonSecondaire}
									>
										Aperçu<span className="sr-only"> de {cv.nom}</span>
									</a>
									{!cv.parDefaut && (
										<button
											type="button"
											className={boutonSecondaire}
											onClick={() =>
												modifier.mutate({ id: cv.id, parDefaut: true })
											}
										>
											Choisir par défaut
											<span className="sr-only"> : {cv.nom}</span>
										</button>
									)}
									<button
										type="button"
										className={boutonSecondaire}
										onClick={() => renommer(cv)}
									>
										Renommer<span className="sr-only"> {cv.nom}</span>
									</button>
									<button
										type="button"
										className={boutonSecondaire}
										onClick={() => effacer(cv)}
									>
										Supprimer<span className="sr-only"> {cv.nom}</span>
									</button>
								</span>
							</li>
						))}
					</ul>
				)}
			</section>

			<section aria-labelledby="titre-textes" className="flex flex-col gap-4">
				<h2 id="titre-textes" className="text-xl font-semibold">
					Lettres et réponses types
				</h2>
				<Textes textes={textes} effacer={effacer} />
			</section>
		</>
	);
}

function ImportCv() {
	const { rafraichir } = useDocuments();
	const [nom, setNom] = useState("");
	const [erreur, setErreur] = useState("");
	const importer = useMutation({
		mutationFn: (fichier: File) =>
			api(`/documents/cv?nom=${encodeURIComponent(nom)}`, {
				method: "POST",
				headers: { "content-type": "application/pdf" },
				body: fichier,
			}),
		onSuccess: rafraichir,
	});

	async function envoyer(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const formulaire = e.currentTarget;
		const fichier = new FormData(formulaire).get("fichier") as File;
		setErreur("");
		if (fichier.size > TAILLE_MAX_CV)
			return setErreur("Le fichier doit faire 5 Mo au plus.");
		try {
			await importer.mutateAsync(fichier);
			formulaire.reset();
			setNom("");
		} catch (err) {
			setErreur((err as Error).message);
		}
	}

	return (
		<form
			onSubmit={envoyer}
			className="flex flex-col gap-3 rounded-md border border-dashed border-zinc-400 p-4"
		>
			<label htmlFor="nom-cv" className="font-medium">
				Nom du CV
			</label>
			<input
				id="nom-cv"
				required
				maxLength={120}
				placeholder="Par exemple : CV alternance développement web"
				value={nom}
				onChange={(e) => setNom(e.target.value)}
				className={champ}
			/>
			<label htmlFor="fichier-cv" className="font-medium">
				Fichier PDF
			</label>
			<input
				id="fichier-cv"
				name="fichier"
				type="file"
				accept="application/pdf,.pdf"
				required
			/>
			<button type="submit" className={bouton} disabled={importer.isPending}>
				{importer.isPending ? "Import…" : "Importer le CV"}
			</button>
			{erreur && (
				<p role="alert" className={alerte}>
					{erreur}
				</p>
			)}
		</form>
	);
}

type Brouillon = {
	id: string;
	type: "lettre" | "reponse";
	nom: string;
	contenu: string;
};
const vide: Brouillon = { id: "", type: "lettre", nom: "", contenu: "" };

function Textes({
	textes,
	effacer,
}: {
	textes: Document[];
	effacer: (d: Document) => void;
}) {
	const { rafraichir } = useDocuments();
	const [brouillon, setBrouillon] = useState(vide);
	const enregistrer = useMutation({
		mutationFn: ({ id, type, nom, contenu }: Brouillon) =>
			id
				? api(`/documents/${id}`, json("PATCH", { nom, contenu }))
				: api("/documents", json("POST", { type, nom, contenu })),
		onSuccess: () => {
			setBrouillon(vide);
			rafraichir();
		},
	});
	const maj = (champs: Partial<Brouillon>) =>
		setBrouillon({ ...brouillon, ...champs });

	return (
		<>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					enregistrer.mutate(brouillon);
				}}
				className="flex flex-col gap-3 rounded-md border border-dashed border-zinc-400 p-4"
			>
				<h3 className="font-semibold">
					{brouillon.id ? `Modifier « ${brouillon.nom} »` : "Nouveau texte"}
				</h3>
				{!brouillon.id && (
					<>
						<label htmlFor="type-texte" className="font-medium">
							Type
						</label>
						<select
							id="type-texte"
							value={brouillon.type}
							onChange={(e) =>
								maj({ type: e.target.value as Brouillon["type"] })
							}
							className={champ}
						>
							<option value="lettre">{libelles.lettre}</option>
							<option value="reponse">{libelles.reponse}</option>
						</select>
					</>
				)}
				<label htmlFor="nom-texte" className="font-medium">
					Nom
				</label>
				<input
					id="nom-texte"
					required
					maxLength={120}
					value={brouillon.nom}
					onChange={(e) => maj({ nom: e.target.value })}
					className={champ}
				/>
				<label htmlFor="contenu-texte" className="font-medium">
					Texte
				</label>
				<textarea
					id="contenu-texte"
					rows={10}
					maxLength={20000}
					value={brouillon.contenu}
					onChange={(e) => maj({ contenu: e.target.value })}
					className={champ}
				/>
				<span className="flex gap-2">
					<button
						type="submit"
						className={bouton}
						disabled={enregistrer.isPending}
					>
						Enregistrer
					</button>
					{brouillon.id && (
						<button
							type="button"
							className={boutonSecondaire}
							onClick={() => setBrouillon(vide)}
						>
							Annuler
						</button>
					)}
				</span>
				{enregistrer.isError && (
					<p role="alert" className={alerte}>
						{enregistrer.error.message}
					</p>
				)}
			</form>

			{textes.length === 0 ? (
				<p className={discret}>Aucune lettre ni réponse type pour l'instant.</p>
			) : (
				<ul className="flex flex-col gap-2">
					{textes.map((t) => (
						<li
							key={t.id}
							className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-zinc-300 p-3 dark:border-zinc-700"
						>
							<span className="font-medium">{t.nom}</span>
							<span className={`text-sm ${discret}`}>
								{libelles[t.type]}, créé le {date(t.createdAt)}
							</span>
							<span className="ml-auto flex gap-2">
								<button
									type="button"
									className={boutonSecondaire}
									onClick={() =>
										setBrouillon({
											id: t.id,
											type: t.type as Brouillon["type"],
											nom: t.nom,
											contenu: t.contenu ?? "",
										})
									}
								>
									Modifier<span className="sr-only"> {t.nom}</span>
								</button>
								<button
									type="button"
									className={boutonSecondaire}
									onClick={() => effacer(t)}
								>
									Supprimer<span className="sr-only"> {t.nom}</span>
								</button>
							</span>
						</li>
					))}
				</ul>
			)}
		</>
	);
}
