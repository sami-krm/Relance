import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
	type Contact,
	type Entreprise,
	type Offre,
	typesContrat,
} from "../shared/schemas";
import { api, json } from "./api";
import { CandidaturesEntreprise } from "./candidatures";
import { EstimationCorrespondance } from "./correspondance";
import {
	alerte,
	bouton,
	boutonSecondaire,
	Chargement,
	champ,
	discret,
	EnTete,
	EtatVide,
} from "./ui";

type Valeurs = Record<string, string>;
type ChampForm = {
	cle: string;
	libelle: string;
	type?: "long" | "url" | "email" | "tel" | "date" | "choix";
	requis?: boolean;
	options?: { valeur: string; libelle: string }[];
	suggestions?: string[];
};

const carte =
	"flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900";
const lienExterne = "underline break-all";
const dateFr = (iso: string) =>
	iso ? new Date(`${iso}T00:00`).toLocaleDateString("fr-FR") : "";

const champsEntreprise: ChampForm[] = [
	{ cle: "nom", libelle: "Nom", requis: true },
	{ cle: "ville", libelle: "Ville" },
	{ cle: "site", libelle: "Site web", type: "url" },
	{ cle: "secteur", libelle: "Secteur" },
	{ cle: "notes", libelle: "Notes", type: "long" },
];
const champsContact: ChampForm[] = [
	{ cle: "nom", libelle: "Nom", requis: true },
	{ cle: "role", libelle: "Rôle" },
	{ cle: "email", libelle: "E-mail", type: "email" },
	{ cle: "telephone", libelle: "Téléphone", type: "tel" },
	{ cle: "linkedin", libelle: "LinkedIn", type: "url" },
	{ cle: "notes", libelle: "Notes", type: "long" },
];
const champsOffre = (entreprises: Entreprise[]): ChampForm[] => [
	{
		cle: "entrepriseId",
		libelle: "Entreprise",
		type: "choix",
		requis: true,
		options: entreprises.map((e) => ({ valeur: e.id, libelle: e.nom })),
	},
	{ cle: "intitule", libelle: "Intitulé du poste", requis: true },
	{ cle: "lieu", libelle: "Lieu" },
	{
		cle: "contrat",
		libelle: "Type de contrat",
		type: "choix",
		options: typesContrat.map((t) => ({ valeur: t, libelle: t })),
	},
	{
		cle: "source",
		libelle: "Source",
		suggestions: [
			"Site d'offres",
			"Salon",
			"École",
			"Bouche-à-oreille",
			"LinkedIn",
			"Site de l'entreprise",
		],
	},
	{ cle: "lien", libelle: "Lien de l'offre", type: "url" },
	{ cle: "datePublication", libelle: "Date de publication", type: "date" },
	{ cle: "dateLimite", libelle: "Date limite de candidature", type: "date" },
	{ cle: "description", libelle: "Description", type: "long" },
];

// Un formulaire pour créer ou modifier une entreprise, un contact ou une offre.
function Formulaire({
	champs,
	initial = {},
	onValider,
	libelleBouton,
	onAnnuler,
}: {
	champs: ChampForm[];
	initial?: Valeurs;
	onValider: (v: Valeurs) => Promise<unknown>;
	libelleBouton: string;
	onAnnuler?: () => void;
}) {
	const id = useId();
	const depart = () =>
		Object.fromEntries(champs.map((c) => [c.cle, initial[c.cle] ?? ""]));
	const [valeurs, setValeurs] = useState<Valeurs>(depart);
	const [erreur, setErreur] = useState<{ message: string; champs: string[] }>();
	const [enCours, setEnCours] = useState(false);

	async function envoyer(e: FormEvent) {
		e.preventDefault();
		setEnCours(true);
		setErreur(undefined);
		try {
			await onValider(valeurs);
			setValeurs(depart());
		} catch (err) {
			const { message, champs = [] } = err as Error & { champs?: string[] };
			setErreur({ message, champs });
		} finally {
			setEnCours(false);
		}
	}

	return (
		<form onSubmit={envoyer} className="flex flex-col gap-3">
			{champs.map((c) => {
				const commun = {
					id: `${id}-${c.cle}`,
					value: valeurs[c.cle],
					required: c.requis,
					"aria-invalid": erreur?.champs.includes(c.cle) || undefined,
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
							{c.requis && " (obligatoire)"}
						</label>
						{c.type === "long" ? (
							<textarea rows={4} {...commun} />
						) : c.type === "choix" ? (
							<select {...commun}>
								<option value="">—</option>
								{c.options?.map((o) => (
									<option key={o.valeur} value={o.valeur}>
										{o.libelle}
									</option>
								))}
							</select>
						) : (
							<input
								type={c.type ?? "text"}
								list={c.suggestions && `${commun.id}-liste`}
								{...commun}
							/>
						)}
						{c.suggestions && (
							<datalist id={`${commun.id}-liste`}>
								{c.suggestions.map((s) => (
									<option key={s} value={s} />
								))}
							</datalist>
						)}
					</div>
				);
			})}
			<span className="flex gap-2">
				<button type="submit" className={bouton} disabled={enCours}>
					{libelleBouton}
				</button>
				{onAnnuler && (
					<button
						type="button"
						className={boutonSecondaire}
						onClick={onAnnuler}
					>
						Annuler
					</button>
				)}
			</span>
			{erreur && (
				<p role="alert" className={alerte}>
					{erreur.message}{" "}
					{champs
						.filter((c) => erreur.champs.includes(c.cle))
						.map((c) => c.libelle)
						.join(", ")}
				</p>
			)}
		</form>
	);
}

export function useRessource<T>(chemin: string) {
	const qc = useQueryClient();
	const liste = useQuery({
		queryKey: [chemin],
		queryFn: () => api<T[]>(chemin),
	});
	// Supprimer une entreprise retire aussi ses contacts et offres : on recharge tout.
	const rafraichir = () => qc.invalidateQueries();
	return {
		liste,
		creer: (v: unknown) => api(chemin, json("POST", v)).then(rafraichir),
		modifier: (id: string, v: unknown) =>
			api(`${chemin}/${id}`, json("PATCH", v)).then(rafraichir),
		supprimer: (id: string) =>
			api(`${chemin}/${id}`, { method: "DELETE" }).then(rafraichir),
	};
}

function Ajout({
	titre,
	children,
}: {
	titre: string;
	children: React.ReactNode;
}) {
	return (
		<details className="rounded-xl border border-dashed border-zinc-300 bg-white/60 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
			<summary className="cursor-pointer font-semibold">{titre}</summary>
			<div className="mt-4">{children}</div>
		</details>
	);
}

const confirmer = (texte: string) => window.confirm(texte);

export function PageEntreprises() {
	const entreprises = useRessource<Entreprise>("/entreprises");
	const contacts = useRessource<Contact>("/contacts").liste.data ?? [];
	const offres = useRessource<Offre>("/offres").liste.data ?? [];
	if (entreprises.liste.isError)
		return <p className={alerte}>Impossible de charger les entreprises.</p>;
	if (!entreprises.liste.data) return <Chargement />;
	const compte = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

	return (
		<>
			<EnTete
				titre="Entreprises"
				description="Les entreprises qui vous intéressent, avec leurs contacts, leurs offres et vos candidatures."
			/>
			<Ajout titre="Ajouter une entreprise">
				<Formulaire
					champs={champsEntreprise}
					onValider={entreprises.creer}
					libelleBouton="Ajouter"
				/>
			</Ajout>
			{entreprises.liste.data.length === 0 ? (
				<EtatVide titre="Aucune entreprise pour l'instant">
					Ajoutez-en une ci-dessus. Elle est aussi créée automatiquement quand
					vous ajoutez une offre trouvée par la recherche.
				</EtatVide>
			) : (
				<ul className="flex flex-col gap-2">
					{entreprises.liste.data.map((e) => (
						<li key={e.id} className={carte}>
							<Link
								to={`/entreprises/${e.id}`}
								className="font-medium underline"
							>
								{e.nom}
							</Link>
							<span className={`text-sm ${discret}`}>
								{[
									e.ville,
									e.secteur,
									compte(
										contacts.filter((c) => c.entrepriseId === e.id).length,
										"contact",
									),
									compte(
										offres.filter((o) => o.entrepriseId === e.id).length,
										"offre",
									),
								]
									.filter(Boolean)
									.join(" · ")}
							</span>
						</li>
					))}
				</ul>
			)}
		</>
	);
}

export function PageEntreprise() {
	const { id = "" } = useParams();
	const navigate = useNavigate();
	const entreprises = useRessource<Entreprise>("/entreprises");
	const contacts = useRessource<Contact>("/contacts");
	const offres = useRessource<Offre>("/offres");
	const [edition, setEdition] = useState(false);
	const [contactEdite, setContactEdite] = useState("");
	const [erreur, setErreur] = useState("");
	if (!entreprises.liste.data) return <p>Chargement…</p>;
	const e = entreprises.liste.data.find((x) => x.id === id);
	if (!e)
		return (
			<>
				<h1 className="text-2xl font-semibold tracking-tight">
					Entreprise introuvable
				</h1>
				<Link
					to="/entreprises"
					className="font-medium text-accent-700 underline decoration-accent-300 hover:decoration-current dark:text-accent-300 dark:decoration-accent-700"
				>
					Retour aux entreprises
				</Link>
			</>
		);
	const sesContacts = (contacts.liste.data ?? []).filter(
		(c) => c.entrepriseId === id,
	);
	const sesOffres = (offres.liste.data ?? []).filter(
		(o) => o.entrepriseId === id,
	);

	const supprimer = () => {
		if (
			confirmer(
				`Supprimer « ${e.nom} » ? Ses contacts et ses offres seront supprimés aussi. Cette action est définitive.`,
			)
		)
			entreprises
				.supprimer(id)
				.then(() => navigate("/entreprises"))
				.catch((err) => setErreur(err.message));
	};

	return (
		<>
			<Link to="/entreprises" className="text-sm underline">
				← Entreprises
			</Link>
			{edition ? (
				<section className="flex flex-col gap-3">
					<h1 className="text-2xl font-semibold tracking-tight">
						Modifier « {e.nom} »
					</h1>
					<Formulaire
						champs={champsEntreprise}
						initial={e}
						onValider={(v) =>
							entreprises.modifier(id, v).then(() => setEdition(false))
						}
						libelleBouton="Enregistrer"
						onAnnuler={() => setEdition(false)}
					/>
				</section>
			) : (
				<section className="flex flex-col gap-2">
					<h1 className="text-2xl font-semibold tracking-tight">{e.nom}</h1>
					<p className={discret}>
						{[e.ville, e.secteur].filter(Boolean).join(" · ") ||
							"Ville et secteur non renseignés"}
					</p>
					{e.site && (
						<a
							href={e.site}
							target="_blank"
							rel="noreferrer"
							className={lienExterne}
						>
							{e.site}
						</a>
					)}
					{e.notes && <p className="whitespace-pre-line">{e.notes}</p>}
					<span className="flex gap-2">
						<button
							type="button"
							className={boutonSecondaire}
							onClick={() => setEdition(true)}
						>
							Modifier
						</button>
						<button
							type="button"
							className={boutonSecondaire}
							onClick={supprimer}
						>
							Supprimer l'entreprise
						</button>
					</span>
				</section>
			)}
			{erreur && (
				<p role="alert" className={alerte}>
					{erreur}
				</p>
			)}

			<section aria-labelledby="titre-contacts" className="flex flex-col gap-3">
				<h2 id="titre-contacts" className="text-xl font-semibold">
					Contacts
				</h2>
				{sesContacts.length === 0 && <p className={discret}>Aucun contact.</p>}
				<ul className="flex flex-col gap-2">
					{sesContacts.map((c) =>
						contactEdite === c.id ? (
							<li key={c.id} className={carte}>
								<Formulaire
									champs={champsContact}
									initial={c}
									onValider={(v) =>
										contacts.modifier(c.id, v).then(() => setContactEdite(""))
									}
									libelleBouton="Enregistrer"
									onAnnuler={() => setContactEdite("")}
								/>
							</li>
						) : (
							<li key={c.id} className={carte}>
								<span className="font-medium">
									{c.nom}
									{c.role && <span className={discret}> · {c.role}</span>}
								</span>
								{c.email && (
									<a href={`mailto:${c.email}`} className={lienExterne}>
										{c.email}
									</a>
								)}
								{c.telephone && <span>{c.telephone}</span>}
								{c.linkedin && (
									<a
										href={c.linkedin}
										target="_blank"
										rel="noreferrer"
										className={lienExterne}
									>
										Profil LinkedIn
									</a>
								)}
								{c.notes && <p className="whitespace-pre-line">{c.notes}</p>}
								<span className="flex gap-2">
									<button
										type="button"
										className={boutonSecondaire}
										onClick={() => setContactEdite(c.id)}
									>
										Modifier<span className="sr-only"> {c.nom}</span>
									</button>
									<button
										type="button"
										className={boutonSecondaire}
										onClick={() =>
											confirmer(`Supprimer le contact « ${c.nom} » ?`) &&
											contacts
												.supprimer(c.id)
												.catch((err) => setErreur(err.message))
										}
									>
										Supprimer<span className="sr-only"> {c.nom}</span>
									</button>
								</span>
							</li>
						),
					)}
				</ul>
				<Ajout titre="Ajouter un contact">
					<Formulaire
						champs={champsContact}
						onValider={(v) => contacts.creer({ ...v, entrepriseId: id })}
						libelleBouton="Ajouter le contact"
					/>
				</Ajout>
			</section>

			<section aria-labelledby="titre-offres" className="flex flex-col gap-3">
				<h2 id="titre-offres" className="text-xl font-semibold">
					Offres
				</h2>
				<ListeOffres offres={sesOffres} entreprises={entreprises.liste.data} />
				<Ajout titre="Ajouter une offre">
					<Formulaire
						champs={champsOffre(entreprises.liste.data).slice(1)}
						onValider={(v) => offres.creer({ ...v, entrepriseId: id })}
						libelleBouton="Ajouter l'offre"
					/>
				</Ajout>
			</section>

			<CandidaturesEntreprise entrepriseId={id} />
		</>
	);
}

function ListeOffres({
	offres: liste,
	entreprises,
}: {
	offres: Offre[];
	entreprises: Entreprise[];
}) {
	const offres = useRessource<Offre>("/offres");
	const [editee, setEditee] = useState("");
	const [erreur, setErreur] = useState("");
	const agir = (p: Promise<unknown>) =>
		p.catch((err) => setErreur(err.message));
	if (liste.length === 0)
		return (
			<EtatVide titre="Aucune offre enregistrée">
				Ajoutez une offre à la main ci-dessus, ou trouvez-en avec la recherche
				d'offres.
			</EtatVide>
		);

	return (
		<>
			{erreur && (
				<p role="alert" className={alerte}>
					{erreur}
				</p>
			)}
			<ul className="flex flex-col gap-2">
				{liste.map((o) => {
					const entreprise = entreprises.find((e) => e.id === o.entrepriseId);
					if (editee === o.id)
						return (
							<li key={o.id} className={carte}>
								<Formulaire
									champs={champsOffre(entreprises)}
									initial={o as unknown as Valeurs}
									onValider={(v) =>
										offres.modifier(o.id, v).then(() => setEditee(""))
									}
									libelleBouton="Enregistrer"
									onAnnuler={() => setEditee("")}
								/>
							</li>
						);
					return (
						<li
							key={o.id}
							className={`${carte} ${o.expiree ? "opacity-70" : ""}`}
						>
							<span className="font-medium">
								{o.intitule}
								{o.expiree && (
									<span className="ml-2 rounded bg-zinc-200 px-2 text-sm dark:bg-zinc-700">
										Expirée
									</span>
								)}
							</span>
							<span className={`text-sm ${discret}`}>
								{[
									entreprise?.nom,
									o.lieu,
									o.contrat,
									o.source && `source : ${o.source}`,
									o.datePublication &&
										`publiée le ${dateFr(o.datePublication)}`,
									o.dateLimite && `date limite ${dateFr(o.dateLimite)}`,
								]
									.filter(Boolean)
									.join(" · ")}
							</span>
							{o.lien && (
								<a
									href={o.lien}
									target="_blank"
									rel="noreferrer"
									className={lienExterne}
								>
									Voir l'offre
								</a>
							)}
							<EstimationCorrespondance offre={o} />
							{o.description && (
								<details>
									<summary className="cursor-pointer text-sm">
										Description
									</summary>
									<p className="mt-2 whitespace-pre-line">{o.description}</p>
								</details>
							)}
							<span className="flex flex-wrap gap-2">
								<Link
									to={`/candidatures/nouvelle?offre=${o.id}`}
									className={boutonSecondaire}
								>
									Candidater<span className="sr-only"> : {o.intitule}</span>
								</Link>
								<button
									type="button"
									className={boutonSecondaire}
									onClick={() => setEditee(o.id)}
								>
									Modifier<span className="sr-only"> {o.intitule}</span>
								</button>
								<button
									type="button"
									className={boutonSecondaire}
									onClick={() =>
										agir(offres.modifier(o.id, { expiree: !o.expiree }))
									}
								>
									{o.expiree ? "Remettre en cours" : "Marquer expirée"}
									<span className="sr-only"> : {o.intitule}</span>
								</button>
								<button
									type="button"
									className={boutonSecondaire}
									onClick={() =>
										confirmer(`Supprimer l'offre « ${o.intitule} » ?`) &&
										agir(offres.supprimer(o.id))
									}
								>
									Supprimer<span className="sr-only"> {o.intitule}</span>
								</button>
							</span>
						</li>
					);
				})}
			</ul>
		</>
	);
}

export function PageOffres() {
	const entreprises = useRessource<Entreprise>("/entreprises").liste.data;
	const offres = useRessource<Offre>("/offres");
	const [avecExpirees, setAvecExpirees] = useState(true);
	if (!entreprises || !offres.liste.data) return <Chargement />;
	const visibles = offres.liste.data.filter((o) => avecExpirees || !o.expiree);

	return (
		<>
			<EnTete
				titre="Mes offres"
				description="Les offres que vous avez enregistrées, avant d'y candidater."
				actions={
					<Link to="/recherche" className={bouton}>
						Rechercher des offres
					</Link>
				}
			/>
			<p className={`text-sm ${discret}`}>
				Vous avez le lien d'une offre ? Ajoutez-la depuis la page{" "}
				<Link
					to="/recherche"
					className="font-medium text-accent-700 underline decoration-accent-300 hover:decoration-current dark:text-accent-300 dark:decoration-accent-700"
				>
					Recherche
				</Link>
				, qui lit la page pour préremplir les champs.
			</p>
			<Ajout titre="Ajouter une offre">
				{entreprises.length === 0 ? (
					<p>
						Ajoutez d'abord l'entreprise sur la page{" "}
						<Link
							to="/entreprises"
							className="font-medium text-accent-700 underline decoration-accent-300 hover:decoration-current dark:text-accent-300 dark:decoration-accent-700"
						>
							Entreprises
						</Link>
						.
					</p>
				) : (
					<Formulaire
						champs={champsOffre(entreprises)}
						onValider={offres.creer}
						libelleBouton="Ajouter l'offre"
					/>
				)}
			</Ajout>
			<label className="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={avecExpirees}
					onChange={(e) => setAvecExpirees(e.target.checked)}
				/>
				Afficher les offres expirées
			</label>
			<ListeOffres offres={visibles} entreprises={entreprises} />
		</>
	);
}
