import {
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	type KeyboardCoordinateGetter,
	KeyboardSensor,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
	type Candidature,
	type Contact,
	canaux,
	type Document,
	type Entreprise,
	type Evenement,
	libellesStatut,
	type Offre,
	type Statut,
	statuts,
} from "../shared/schemas";
import { api, json } from "./api";
import { PreparerEnvoi } from "./envoi";
import { BrouillonsIa } from "./ia";
import { RappelsCandidature } from "./rappels";
import { useRessource } from "./repertoire";
import { alerte, bouton, boutonSecondaire, champ, discret } from "./ui";

const carte =
	"flex flex-col gap-2 rounded-md border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900";
const dateFr = (iso: string) =>
	iso ? new Date(`${iso}T00:00`).toLocaleDateString("fr-FR") : "";
const aujourdhui = () => new Date().toLocaleDateString("sv-SE");

function useDonnees() {
	const candidatures = useRessource<Candidature>("/candidatures");
	const entreprises = useRessource<Entreprise>("/entreprises").liste.data;
	const nomEntreprise = (id: string) =>
		entreprises?.find((e) => e.id === id)?.nom ?? "";
	return { candidatures, entreprises, nomEntreprise };
}

function ChoixStatut({
	c,
	changer,
}: {
	c: Candidature;
	changer: (id: string, statut: Statut) => void;
}) {
	const id = useId();
	return (
		<span className="flex flex-col gap-1">
			<label htmlFor={id} className="text-sm">
				Changer de statut<span className="sr-only"> : {c.poste}</span>
			</label>
			<select
				id={id}
				value={c.statut}
				onChange={(e) => changer(c.id, e.target.value as Statut)}
				className={`${champ} py-1 text-sm`}
			>
				{statuts.map((s) => (
					<option key={s} value={s}>
						{libellesStatut[s]}
					</option>
				))}
			</select>
		</span>
	);
}

function Etiquettes({ liste }: { liste: string[] }) {
	if (!liste.length) return null;
	return (
		<span className="flex flex-wrap gap-1">
			{liste.map((e) => (
				<span
					key={e}
					className="rounded bg-zinc-200 px-2 text-xs dark:bg-zinc-700"
				>
					{e}
				</span>
			))}
		</span>
	);
}

export function PageCandidatures() {
	const { candidatures, entreprises, nomEntreprise } = useDonnees();
	const [params, setParams] = useSearchParams();
	const [erreur, setErreur] = useState("");
	const vue = params.get("vue") === "liste" ? "liste" : "tableau";
	if (candidatures.liste.isError)
		return <p className={alerte}>Impossible de charger les candidatures.</p>;
	if (!candidatures.liste.data || !entreprises) return <p>Chargement…</p>;
	const changer = (id: string, statut: Statut) =>
		candidatures.modifier(id, { statut }).catch((e) => setErreur(e.message));

	return (
		<>
			<div className="flex flex-wrap items-center gap-3">
				<h1 className="mr-auto text-2xl font-bold">Candidatures</h1>
				<Link to="/candidatures/nouvelle" className={bouton}>
					Nouvelle candidature
				</Link>
			</div>
			<fieldset className="flex gap-2">
				<legend className="sr-only">Affichage</legend>
				{(["tableau", "liste"] as const).map((v) => (
					<button
						key={v}
						type="button"
						aria-pressed={vue === v}
						className={`${boutonSecondaire} ${vue === v ? "font-semibold underline" : ""}`}
						onClick={() => setParams(v === "liste" ? { vue: "liste" } : {})}
					>
						{v === "tableau" ? "Tableau" : "Liste"}
					</button>
				))}
			</fieldset>
			{erreur && (
				<p role="alert" className={alerte}>
					{erreur}
				</p>
			)}
			{candidatures.liste.data.length === 0 ? (
				<p className={discret}>
					Aucune candidature pour l'instant. Créez-en une depuis une offre ou en
					candidature spontanée.
				</p>
			) : vue === "tableau" ? (
				<Kanban
					candidatures={candidatures.liste.data}
					nomEntreprise={nomEntreprise}
					changer={changer}
				/>
			) : (
				<Liste
					candidatures={candidatures.liste.data}
					entreprises={entreprises}
					nomEntreprise={nomEntreprise}
				/>
			)}
		</>
	);
}

// Au clavier, une flèche gauche ou droite saute directement à la colonne voisine.
const sautDeColonne: KeyboardCoordinateGetter = (
	event,
	{ context: { collisionRect, droppableRects } },
) => {
	const sens = { ArrowRight: 1, ArrowLeft: -1 }[event.code];
	if (!sens || !collisionRect) return undefined;
	const colonnes = statuts
		.map((s) => droppableRects.get(s))
		.filter((r) => r !== undefined);
	const cible =
		sens > 0
			? colonnes.find((r) => r.left > collisionRect.left + 10)
			: colonnes.findLast((r) => r.left < collisionRect.left - 10);
	if (!cible) return undefined;
	event.preventDefault();
	return { x: cible.left + 8, y: cible.top + 40 };
};

function Kanban({
	candidatures,
	nomEntreprise,
	changer,
}: {
	candidatures: Candidature[];
	nomEntreprise: (id: string) => string;
	changer: (id: string, statut: Statut) => void;
}) {
	const capteurs = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sautDeColonne }),
	);
	const [active, setActive] = useState<Candidature>();
	const poste = (id: string | number) =>
		candidatures.find((c) => c.id === id)?.poste ?? "";
	const colonne = (id?: string | number) =>
		id ? libellesStatut[id as Statut] : "";

	const debut = ({ active: a }: DragStartEvent) =>
		setActive(candidatures.find((c) => c.id === a.id));
	const fin = ({ active: a, over }: DragEndEvent) => {
		setActive(undefined);
		const c = candidatures.find((x) => x.id === a.id);
		if (c && over && over.id !== c.statut) changer(c.id, over.id as Statut);
	};

	return (
		<DndContext
			sensors={capteurs}
			onDragStart={debut}
			onDragEnd={fin}
			onDragCancel={() => setActive(undefined)}
			accessibility={{
				screenReaderInstructions: {
					draggable:
						"Pour déplacer cette candidature, appuyez sur Espace ou Entrée, changez de colonne avec les flèches gauche et droite, puis appuyez de nouveau sur Espace ou Entrée. Échap annule. Le menu « Changer de statut » fait la même chose.",
				},
				announcements: {
					onDragStart: ({ active: a }) =>
						`Candidature « ${poste(a.id)} » saisie.`,
					onDragOver: ({ active: a, over }) =>
						over
							? `« ${poste(a.id)} » au-dessus de la colonne ${colonne(over.id)}.`
							: `« ${poste(a.id)} » hors des colonnes.`,
					onDragEnd: ({ active: a, over }) =>
						over
							? `« ${poste(a.id)} » déposée dans ${colonne(over.id)}.`
							: `« ${poste(a.id)} » reposée à sa place.`,
					onDragCancel: ({ active: a }) =>
						`Déplacement de « ${poste(a.id)} » annulé.`,
				},
			}}
		>
			<div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
				{statuts.map((s) => (
					<Colonne
						key={s}
						statut={s}
						cartes={candidatures.filter((c) => c.statut === s)}
						nomEntreprise={nomEntreprise}
						changer={changer}
					/>
				))}
			</div>
			<DragOverlay>
				{active && (
					<div className={`${carte} w-60 shadow-lg`}>
						<span className="font-medium">{active.poste}</span>
						<span className={`text-sm ${discret}`}>
							{nomEntreprise(active.entrepriseId)}
						</span>
					</div>
				)}
			</DragOverlay>
		</DndContext>
	);
}

function Colonne({
	statut,
	cartes,
	nomEntreprise,
	changer,
}: {
	statut: Statut;
	cartes: Candidature[];
	nomEntreprise: (id: string) => string;
	changer: (id: string, statut: Statut) => void;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: statut });
	return (
		<section
			ref={setNodeRef}
			aria-label={`${libellesStatut[statut]} (${cartes.length})`}
			className={`flex w-64 shrink-0 flex-col gap-2 rounded-md bg-zinc-100 p-2 dark:bg-zinc-800 ${isOver ? "ring-2 ring-zinc-500" : ""}`}
		>
			<h2 className="px-1 font-semibold">
				{libellesStatut[statut]}{" "}
				<span className={`text-sm font-normal ${discret}`}>
					{cartes.length}
				</span>
			</h2>
			<ul className="flex min-h-16 flex-col gap-2">
				{cartes.map((c) => (
					<Carte
						key={c.id}
						c={c}
						nomEntreprise={nomEntreprise}
						changer={changer}
					/>
				))}
			</ul>
		</section>
	);
}

function Carte({
	c,
	nomEntreprise,
	changer,
}: {
	c: Candidature;
	nomEntreprise: (id: string) => string;
	changer: (id: string, statut: Statut) => void;
}) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: c.id,
	});
	return (
		<li
			ref={setNodeRef}
			className={`${carte} ${isDragging ? "opacity-40" : ""}`}
		>
			<div className="flex items-start gap-2">
				<button
					type="button"
					{...listeners}
					{...attributes}
					aria-label={`Déplacer « ${c.poste} »`}
					className="cursor-grab touch-none rounded px-1 text-lg leading-none hover:bg-zinc-200 dark:hover:bg-zinc-700"
				>
					⠿
				</button>
				<span className="flex flex-col">
					<Link to={`/candidatures/${c.id}`} className="font-medium underline">
						{c.poste}
					</Link>
					<span className={`text-sm ${discret}`}>
						{nomEntreprise(c.entrepriseId)}
						{c.dateEnvoi && ` · envoyée le ${dateFr(c.dateEnvoi)}`}
					</span>
				</span>
			</div>
			<Etiquettes liste={c.etiquettes} />
			<ChoixStatut c={c} changer={changer} />
		</li>
	);
}

type CleTri = "poste" | "entreprise" | "statut" | "dateEnvoi";

function Liste({
	candidatures,
	entreprises,
	nomEntreprise,
}: {
	candidatures: Candidature[];
	entreprises: Entreprise[];
	nomEntreprise: (id: string) => string;
}) {
	const [filtre, setFiltre] = useState({
		statut: "",
		entreprise: "",
		du: "",
		au: "",
	});
	const [tri, setTri] = useState<{ cle: CleTri; sens: 1 | -1 }>({
		cle: "dateEnvoi",
		sens: -1,
	});
	const valeur = (c: Candidature, cle: CleTri) =>
		cle === "entreprise"
			? nomEntreprise(c.entrepriseId)
			: cle === "statut"
				? String(statuts.indexOf(c.statut)).padStart(2, "0")
				: c[cle];
	const lignes = candidatures
		.filter(
			(c) =>
				(!filtre.statut || c.statut === filtre.statut) &&
				(!filtre.entreprise || c.entrepriseId === filtre.entreprise) &&
				(!filtre.du || (c.dateEnvoi && c.dateEnvoi >= filtre.du)) &&
				(!filtre.au || (c.dateEnvoi && c.dateEnvoi <= filtre.au)),
		)
		.sort(
			(a, b) =>
				valeur(a, tri.cle).localeCompare(valeur(b, tri.cle), "fr") * tri.sens,
		);
	const colonnes: [CleTri, string][] = [
		["poste", "Poste"],
		["entreprise", "Entreprise"],
		["statut", "Statut"],
		["dateEnvoi", "Date d'envoi"],
	];
	const maj =
		(cle: keyof typeof filtre) => (e: { target: { value: string } }) =>
			setFiltre({ ...filtre, [cle]: e.target.value });

	return (
		<>
			<fieldset className="flex flex-wrap gap-3">
				<legend className="sr-only">Filtres</legend>
				<label className="flex flex-col gap-1 text-sm">
					Statut
					<select
						value={filtre.statut}
						onChange={maj("statut")}
						className={champ}
					>
						<option value="">Tous</option>
						{statuts.map((s) => (
							<option key={s} value={s}>
								{libellesStatut[s]}
							</option>
						))}
					</select>
				</label>
				<label className="flex flex-col gap-1 text-sm">
					Entreprise
					<select
						value={filtre.entreprise}
						onChange={maj("entreprise")}
						className={champ}
					>
						<option value="">Toutes</option>
						{entreprises.map((e) => (
							<option key={e.id} value={e.id}>
								{e.nom}
							</option>
						))}
					</select>
				</label>
				<label className="flex flex-col gap-1 text-sm">
					Envoyée du
					<input
						type="date"
						value={filtre.du}
						onChange={maj("du")}
						className={champ}
					/>
				</label>
				<label className="flex flex-col gap-1 text-sm">
					au
					<input
						type="date"
						value={filtre.au}
						onChange={maj("au")}
						className={champ}
					/>
				</label>
			</fieldset>
			<p className={`text-sm ${discret}`} aria-live="polite">
				{lignes.length} candidature{lignes.length > 1 ? "s" : ""}
			</p>
			<div className="overflow-x-auto">
				<table className="w-full text-left text-sm">
					<thead>
						<tr className="border-b border-zinc-300 dark:border-zinc-700">
							{colonnes.map(([cle, libelle]) => (
								<th
									key={cle}
									className="py-2 pr-3"
									aria-sort={
										tri.cle === cle
											? tri.sens === 1
												? "ascending"
												: "descending"
											: "none"
									}
								>
									<button
										type="button"
										className="font-semibold hover:underline"
										onClick={() =>
											setTri({
												cle,
												sens: tri.cle === cle ? (-tri.sens as 1 | -1) : 1,
											})
										}
									>
										{libelle}
										{tri.cle === cle && (tri.sens === 1 ? " ▲" : " ▼")}
									</button>
								</th>
							))}
							<th className="py-2">Étiquettes</th>
						</tr>
					</thead>
					<tbody>
						{lignes.map((c) => (
							<tr
								key={c.id}
								className="border-b border-zinc-200 dark:border-zinc-800"
							>
								<td className="py-2 pr-3">
									<Link to={`/candidatures/${c.id}`} className="underline">
										{c.poste}
									</Link>
								</td>
								<td className="py-2 pr-3">{nomEntreprise(c.entrepriseId)}</td>
								<td className="py-2 pr-3">{libellesStatut[c.statut]}</td>
								<td className="py-2 pr-3">{dateFr(c.dateEnvoi)}</td>
								<td className="py-2">
									<Etiquettes liste={c.etiquettes} />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}

type Brouillon = {
	mode: "offre" | "spontanee";
	entrepriseId: string;
	offreId: string;
	contactId: string;
	cvId: string;
	poste: string;
	canal: string;
	statut: Statut;
	dateEnvoi: string;
	lettre: string;
	notes: string;
	etiquettes: string;
};

function FormulaireCandidature({
	initial,
	onValider,
	libelleBouton,
	onAnnuler,
}: {
	initial: Brouillon;
	onValider: (corps: unknown) => Promise<unknown>;
	libelleBouton: string;
	onAnnuler?: () => void;
}) {
	const id = useId();
	const entreprises = useRessource<Entreprise>("/entreprises").liste.data ?? [];
	const offres = useRessource<Offre>("/offres").liste.data ?? [];
	const contacts = useRessource<Contact>("/contacts").liste.data ?? [];
	const docs = useRessource<Document>("/documents").liste.data ?? [];
	const [b, setB] = useState(initial);
	const [erreur, setErreur] = useState("");
	const [enCours, setEnCours] = useState(false);
	const maj = (champs: Partial<Brouillon>) => setB({ ...b, ...champs });
	const entrepriseChoisie =
		b.mode === "offre"
			? offres.find((o) => o.id === b.offreId)?.entrepriseId
			: b.entrepriseId;
	const cvs = docs.filter((d) => d.type === "cv");
	const lettres = docs.filter((d) => d.type === "lettre");

	async function envoyer(e: FormEvent) {
		e.preventDefault();
		setEnCours(true);
		setErreur("");
		const { mode, etiquettes, ...reste } = b;
		try {
			await onValider({
				...reste,
				entrepriseId: mode === "offre" ? "" : b.entrepriseId,
				offreId: mode === "offre" ? b.offreId : "",
				etiquettes: etiquettes
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean),
			});
		} catch (err) {
			setErreur((err as Error).message);
			setEnCours(false);
		}
	}

	const ligne = (cle: string, libelle: string, controle: React.ReactNode) => (
		<div className="flex flex-col gap-1">
			<label htmlFor={`${id}-${cle}`} className="font-medium">
				{libelle}
			</label>
			{controle}
		</div>
	);

	return (
		<form onSubmit={envoyer} className="flex flex-col gap-4">
			<fieldset className="flex flex-wrap gap-4">
				<legend className="mb-1 font-medium">Type de candidature</legend>
				{(["offre", "spontanee"] as const).map((m) => (
					<label key={m} className="flex items-center gap-2">
						<input
							type="radio"
							name={`${id}-mode`}
							checked={b.mode === m}
							onChange={() => maj({ mode: m, contactId: "" })}
						/>
						{m === "offre" ? "Depuis une offre" : "Spontanée"}
					</label>
				))}
			</fieldset>

			{b.mode === "offre"
				? ligne(
						"offre",
						"Offre (obligatoire)",
						<select
							id={`${id}-offre`}
							required
							value={b.offreId}
							onChange={(e) => {
								const o = offres.find((x) => x.id === e.target.value);
								maj({
									offreId: e.target.value,
									poste: o?.intitule ?? b.poste,
									contactId: "",
								});
							}}
							className={champ}
						>
							<option value="">—</option>
							{offres.map((o) => (
								<option key={o.id} value={o.id}>
									{o.intitule} ·{" "}
									{entreprises.find((x) => x.id === o.entrepriseId)?.nom}
									{o.expiree ? " (expirée)" : ""}
								</option>
							))}
						</select>,
					)
				: ligne(
						"entreprise",
						"Entreprise (obligatoire)",
						<select
							id={`${id}-entreprise`}
							required
							value={b.entrepriseId}
							onChange={(e) =>
								maj({ entrepriseId: e.target.value, contactId: "" })
							}
							className={champ}
						>
							<option value="">—</option>
							{entreprises.map((x) => (
								<option key={x.id} value={x.id}>
									{x.nom}
								</option>
							))}
						</select>,
					)}
			{b.mode === "offre" && offres.length === 0 && (
				<p className={`text-sm ${discret}`}>
					Aucune offre enregistrée : ajoutez-en une sur la page{" "}
					<Link to="/offres" className="underline">
						Offres
					</Link>
					, ou choisissez « Spontanée ».
				</p>
			)}

			{ligne(
				"poste",
				"Poste (obligatoire)",
				<input
					id={`${id}-poste`}
					required
					maxLength={200}
					value={b.poste}
					onChange={(e) => maj({ poste: e.target.value })}
					className={champ}
				/>,
			)}
			{ligne(
				"contact",
				"Contact",
				<select
					id={`${id}-contact`}
					value={b.contactId}
					onChange={(e) => maj({ contactId: e.target.value })}
					className={champ}
				>
					<option value="">Aucun</option>
					{contacts
						.filter((ct) => ct.entrepriseId === entrepriseChoisie)
						.map((ct) => (
							<option key={ct.id} value={ct.id}>
								{ct.nom}
								{ct.role && ` (${ct.role})`}
							</option>
						))}
				</select>,
			)}
			{ligne(
				"canal",
				"Canal",
				<select
					id={`${id}-canal`}
					value={b.canal}
					onChange={(e) => maj({ canal: e.target.value })}
					className={champ}
				>
					<option value="">—</option>
					{canaux.map((c) => (
						<option key={c}>{c}</option>
					))}
				</select>,
			)}
			{ligne(
				"statut",
				"Statut",
				<select
					id={`${id}-statut`}
					value={b.statut}
					onChange={(e) => maj({ statut: e.target.value as Statut })}
					className={champ}
				>
					{statuts.map((s) => (
						<option key={s} value={s}>
							{libellesStatut[s]}
						</option>
					))}
				</select>,
			)}
			{ligne(
				"date",
				"Date d'envoi (mise à aujourd'hui si vide quand la candidature passe à « Envoyée »)",
				<input
					id={`${id}-date`}
					type="date"
					value={b.dateEnvoi}
					onChange={(e) => maj({ dateEnvoi: e.target.value })}
					className={champ}
				/>,
			)}
			{ligne(
				"cv",
				"CV utilisé",
				<select
					id={`${id}-cv`}
					value={b.cvId}
					onChange={(e) => maj({ cvId: e.target.value })}
					className={champ}
				>
					<option value="">Aucun</option>
					{cvs.map((cv) => (
						<option key={cv.id} value={cv.id}>
							{cv.nom}
							{cv.parDefaut ? " (par défaut)" : ""}
						</option>
					))}
					{b.cvId && !cvs.some((cv) => cv.id === b.cvId) && (
						<option value={b.cvId}>CV masqué de vos documents</option>
					)}
				</select>,
			)}
			{lettres.length > 0 &&
				ligne(
					"modele",
					"Reprendre une lettre enregistrée (son texte est copié ci-dessous)",
					<select
						id={`${id}-modele`}
						value=""
						onChange={(e) =>
							maj({
								lettre:
									lettres.find((l) => l.id === e.target.value)?.contenu ??
									b.lettre,
							})
						}
						className={champ}
					>
						<option value="">—</option>
						{lettres.map((l) => (
							<option key={l.id} value={l.id}>
								{l.nom}
							</option>
						))}
					</select>,
				)}
			{ligne(
				"lettre",
				"Lettre envoyée",
				<textarea
					id={`${id}-lettre`}
					rows={6}
					maxLength={20000}
					value={b.lettre}
					onChange={(e) => maj({ lettre: e.target.value })}
					className={champ}
				/>,
			)}
			{ligne(
				"notes",
				"Notes",
				<textarea
					id={`${id}-notes`}
					rows={3}
					maxLength={5000}
					value={b.notes}
					onChange={(e) => maj({ notes: e.target.value })}
					className={champ}
				/>,
			)}
			{ligne(
				"etiquettes",
				"Étiquettes, séparées par des virgules (par exemple : test technique, accusé de réception)",
				<input
					id={`${id}-etiquettes`}
					value={b.etiquettes}
					onChange={(e) => maj({ etiquettes: e.target.value })}
					className={champ}
				/>,
			)}
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
					{erreur}
				</p>
			)}
		</form>
	);
}

export function PageNouvelleCandidature() {
	const [params] = useSearchParams();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const docs = useRessource<Document>("/documents").liste.data;
	const offres = useRessource<Offre>("/offres").liste.data;
	if (!docs || !offres) return <p>Chargement…</p>;
	const offreId = params.get("offre") ?? "";
	const initial: Brouillon = {
		mode: params.has("entreprise") ? "spontanee" : "offre",
		entrepriseId: params.get("entreprise") ?? "",
		offreId,
		contactId: "",
		cvId: docs.find((d) => d.type === "cv" && d.parDefaut)?.id ?? "",
		poste: offres.find((o) => o.id === offreId)?.intitule ?? "",
		canal: "",
		statut: "brouillon",
		dateEnvoi: "",
		lettre: "",
		notes: "",
		etiquettes: "",
	};
	return (
		<>
			<Link to="/candidatures" className="text-sm underline">
				← Candidatures
			</Link>
			<h1 className="text-2xl font-bold">Nouvelle candidature</h1>
			<p className={discret}>
				Relance n'envoie rien : postulez de votre côté, puis passez la
				candidature à « Envoyée ».
			</p>
			<FormulaireCandidature
				initial={initial}
				libelleBouton="Créer la candidature"
				onValider={async (corps) => {
					const { id } = await api<{ id: string }>(
						"/candidatures",
						json("POST", corps),
					);
					await qc.invalidateQueries();
					navigate(`/candidatures/${id}`);
				}}
			/>
		</>
	);
}

export function PageCandidature() {
	const { id = "" } = useParams();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const { candidatures, nomEntreprise } = useDonnees();
	const contacts = useRessource<Contact>("/contacts").liste.data ?? [];
	const docs = useRessource<Document>("/documents").liste.data ?? [];
	const historique = useQuery({
		queryKey: ["/candidatures", id, "historique"],
		queryFn: () => api<Evenement[]>(`/candidatures/${id}/historique`),
	});
	const [edition, setEdition] = useState(false);
	const [erreur, setErreur] = useState("");
	const [reponse, setReponse] = useState({ texte: "", date: aujourdhui() });
	const idForm = useId();

	if (!candidatures.liste.data) return <p>Chargement…</p>;
	const c = candidatures.liste.data.find((x) => x.id === id);
	if (!c)
		return (
			<>
				<h1 className="text-2xl font-bold">Candidature introuvable</h1>
				<Link to="/candidatures" className="underline">
					Retour aux candidatures
				</Link>
			</>
		);
	const contactLie = contacts.find((ct) => ct.id === c.contactId);
	const cv = docs.find((d) => d.id === c.cvId);
	const agir = (p: Promise<unknown>) => p.catch((e) => setErreur(e.message));
	const changer = (_: string, statut: Statut) =>
		agir(candidatures.modifier(c.id, { statut }));

	async function ajouterReponse(e: FormEvent) {
		e.preventDefault();
		setErreur("");
		await agir(
			api(`/candidatures/${id}/reponses`, json("POST", reponse)).then(() => {
				setReponse({ texte: "", date: aujourdhui() });
				return qc.invalidateQueries();
			}),
		);
	}

	if (edition)
		return (
			<>
				<h1 className="text-2xl font-bold">Modifier « {c.poste} »</h1>
				<FormulaireCandidature
					initial={{
						...c,
						mode: c.offreId ? "offre" : "spontanee",
						offreId: c.offreId ?? "",
						contactId: c.contactId ?? "",
						cvId: c.cvId ?? "",
						etiquettes: c.etiquettes.join(", "),
					}}
					libelleBouton="Enregistrer"
					onAnnuler={() => setEdition(false)}
					onValider={(corps) =>
						candidatures.modifier(c.id, corps).then(() => setEdition(false))
					}
				/>
			</>
		);

	const infos: [string, React.ReactNode][] = [
		[
			"Entreprise",
			<Link key="e" to={`/entreprises/${c.entrepriseId}`} className="underline">
				{nomEntreprise(c.entrepriseId)}
			</Link>,
		],
		["Type", c.offreId ? "Depuis une offre" : "Spontanée"],
		[
			"Contact",
			contactLie &&
				`${contactLie.nom}${contactLie.role ? ` (${contactLie.role})` : ""}`,
		],
		["Canal", c.canal],
		["Date d'envoi", dateFr(c.dateEnvoi)],
		["Source", c.source],
		[
			"Lien de l'offre",
			c.lien && (
				<a
					key="l"
					href={c.lien}
					target="_blank"
					rel="noreferrer"
					className="break-all underline"
				>
					{c.lien}
				</a>
			),
		],
		[
			"CV utilisé",
			c.cvId && (
				<a
					key="cv"
					href={`/api/documents/${c.cvId}/fichier`}
					target="_blank"
					rel="noreferrer"
					className="underline"
				>
					{cv?.nom ?? "CV masqué de vos documents"} (aperçu)
				</a>
			),
		],
	];

	return (
		<>
			<Link to="/candidatures" className="text-sm underline">
				← Candidatures
			</Link>
			<h1 className="text-2xl font-bold">{c.poste}</h1>
			<div className="flex flex-wrap items-end gap-3">
				<ChoixStatut c={c} changer={changer} />
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
					onClick={() =>
						window.confirm(
							`Supprimer la candidature « ${c.poste} » et son historique ? Cette action est définitive.`,
						) &&
						agir(
							candidatures
								.supprimer(c.id)
								.then(() => navigate("/candidatures")),
						)
					}
				>
					Supprimer
				</button>
			</div>
			{erreur && (
				<p role="alert" className={alerte}>
					{erreur}
				</p>
			)}
			<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
				{infos
					.filter(([, v]) => v)
					.map(([k, v]) => (
						<div key={k} className="contents">
							<dt className={discret}>{k}</dt>
							<dd>{v}</dd>
						</div>
					))}
			</dl>
			<Etiquettes liste={c.etiquettes} />
			{c.notes && (
				<section>
					<h2 className="font-semibold">Notes</h2>
					<p className="whitespace-pre-line">{c.notes}</p>
				</section>
			)}
			{c.lettre && (
				<details>
					<summary className="cursor-pointer font-semibold">
						Lettre envoyée
					</summary>
					<p className="mt-2 whitespace-pre-line">{c.lettre}</p>
				</details>
			)}

			<PreparerEnvoi c={c} />

			<BrouillonsIa
				candidatureId={c.id}
				poste={c.poste}
				spontanee={!c.offreId}
				envoyee={c.statut !== "brouillon"}
				onUtiliserLettre={(lettre) => candidatures.modifier(c.id, { lettre })}
			/>

			<RappelsCandidature candidatureId={c.id} poste={c.poste} />

			<section
				aria-labelledby={`${idForm}-rep`}
				className="flex flex-col gap-3"
			>
				<h2 id={`${idForm}-rep`} className="text-xl font-semibold">
					Ajouter une réponse reçue
				</h2>
				<form onSubmit={ajouterReponse} className="flex flex-col gap-3">
					<label htmlFor={`${idForm}-texte`} className="font-medium">
						Texte de la réponse (collez le message reçu)
					</label>
					<textarea
						id={`${idForm}-texte`}
						required
						rows={4}
						maxLength={20000}
						value={reponse.texte}
						onChange={(e) => setReponse({ ...reponse, texte: e.target.value })}
						className={champ}
					/>
					<label htmlFor={`${idForm}-date`} className="font-medium">
						Reçue le
					</label>
					<input
						id={`${idForm}-date`}
						type="date"
						required
						value={reponse.date}
						onChange={(e) => setReponse({ ...reponse, date: e.target.value })}
						className={champ}
					/>
					<button type="submit" className={bouton}>
						Ajouter la réponse
					</button>
				</form>
			</section>

			<section
				aria-labelledby={`${idForm}-hist`}
				className="flex flex-col gap-2"
			>
				<h2 id={`${idForm}-hist`} className="text-xl font-semibold">
					Historique
				</h2>
				<ol className="flex flex-col gap-2">
					{historique.data?.map((ev) => (
						<li key={ev.id} className="border-l-2 border-zinc-400 pl-3">
							<span className={`text-sm ${discret}`}>{dateFr(ev.date)}</span>{" "}
							{ev.type === "statut" ? (
								<>Statut : {libellesStatut[ev.statut ?? "brouillon"]}</>
							) : (
								<>
									Réponse reçue
									<p className="whitespace-pre-line">{ev.texte}</p>
								</>
							)}
						</li>
					))}
				</ol>
			</section>
		</>
	);
}

export function CandidaturesEntreprise({
	entrepriseId,
}: {
	entrepriseId: string;
}) {
	const liste = useRessource<Candidature>("/candidatures").liste.data ?? [];
	const siennes = liste.filter((c) => c.entrepriseId === entrepriseId);
	return (
		<section
			aria-labelledby="titre-candidatures"
			className="flex flex-col gap-3"
		>
			<h2 id="titre-candidatures" className="text-xl font-semibold">
				Candidatures
			</h2>
			{siennes.length === 0 ? (
				<p className={discret}>Aucune candidature.</p>
			) : (
				<ul className="flex flex-col gap-1">
					{siennes.map((c) => (
						<li key={c.id}>
							<Link to={`/candidatures/${c.id}`} className="underline">
								{c.poste}
							</Link>{" "}
							<span className={discret}>· {libellesStatut[c.statut]}</span>
						</li>
					))}
				</ul>
			)}
			<Link
				to={`/candidatures/nouvelle?entreprise=${entrepriseId}`}
				className={`${boutonSecondaire} self-start`}
			>
				Candidature spontanée
			</Link>
		</section>
	);
}
