import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useSearchParams } from "react-router";
import { authClient } from "./auth";
import { bouton, boutonSecondaire, discret, Pied, succes } from "./ui";

// Page d'accueil publique, dans l'esprit du template Projectise. Tout ce qui est dit ici existe dans l'application :
// pas de chiffres, de logos ni d'avis inventés.

const pastille =
	"inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-xs font-medium tracking-wide text-white/70 uppercase";
const titreSection =
	"text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl";

function Icone({ d }: { d: string }) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="size-5 text-accent-300"
		>
			<path d={d} />
		</svg>
	);
}

const fonctionnalites: { titre: string; texte: string; icone: string }[] = [
	{
		titre: "Toutes vos candidatures, en un coup d'œil",
		texte:
			"Un tableau Kanban, du brouillon à l'offre reçue. Glissez une carte ou changez son statut, au clavier comme à la souris.",
		icone: "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v5h-4z",
	},
	{
		titre: "Des relances qui ne s'oublient pas",
		texte:
			"Une relance est proposée une semaine après chaque envoi, et un e-mail récapitule vos rappels à 7 h le jour venu.",
		icone: "M12 8v4l2.5 2.5M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z",
	},
	{
		titre: "Des offres d'alternance à portée de main",
		texte:
			"Recherche via l'API officielle de La bonne alternance, filtres préremplis depuis votre profil, ajout en un clic.",
		icone: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4",
	},
	{
		titre: "Des brouillons rédigés avec l'IA",
		texte:
			"Lettre, e-mail de relance ou réponses à un formulaire : un brouillon à relire, seulement avec votre accord. L'IA n'invente rien.",
		icone:
			"M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
	},
	{
		titre: "Un aperçu avant chaque envoi",
		texte:
			"Destinataire, CV, lettre, réponses et coordonnées partagées : vous voyez tout, puis vous confirmez. Relance n'envoie rien à votre place.",
		icone:
			"M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
	},
	{
		titre: "Calendrier et documents réunis",
		texte:
			"Vos rappels en vue mensuelle et en export .ics, vos CV en PDF ou DOCX conservés tels quels, vos lettres types.",
		icone: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4",
	},
];

const etapes: [string, string][] = [
	[
		"Créez votre compte",
		"Une adresse e-mail suffit : vous recevez un lien de connexion, sans mot de passe.",
	],
	[
		"Ajoutez vos offres et candidatures",
		"Depuis la recherche d'offres, depuis le lien d'une annonce ou à la main.",
	],
	[
		"Suivez et relancez",
		"Le tableau de bord vous dit quoi faire aujourd'hui : relance, entretien ou candidature à envoyer.",
	],
];

const engagements = [
	"Gratuit, sans publicité ni traceur.",
	"Données et fichiers hébergés dans l'Union européenne.",
	"Votre CV n'est jamais généré ni modifié.",
	"L'IA ne reçoit que ce que vous autorisez, et seulement après votre accord.",
	"Export CSV de vos candidatures et suppression complète du compte à tout moment.",
];

const questions: [string, string][] = [
	[
		"Relance envoie-t-elle mes candidatures à ma place ?",
		"Non. Relance prépare l'envoi et vous montre un aperçu complet. Vous envoyez vous-même, depuis votre messagerie ou sur le site de l'offre, puis la candidature passe à « Envoyée ».",
	],
	[
		"D'où viennent les offres ?",
		"De l'API officielle de La bonne alternance, qui reprend notamment les offres d'alternance de France Travail. Vous pouvez aussi ajouter une offre depuis son lien ou à la main.",
	],
	[
		"Que fait l'IA de mes données ?",
		"Rien sans votre accord. Avant la première utilisation, Relance vous montre exactement ce qui sera envoyé : les champs de profil que vous avez autorisés et la candidature concernée. Vous pouvez retirer cet accord dans les paramètres.",
	],
	[
		"Faut-il un mot de passe ?",
		"Non. Vous recevez un lien par e-mail, valable 15 minutes et utilisable une seule fois.",
	],
	[
		"Combien ça coûte ?",
		"Rien. Relance est gratuite et le reste sans publicité.",
	],
];

// Illustration du produit, avec des données d'exemple clairement présentées comme telles.
function Illustration() {
	const colonnes: [string, string, string[]][] = [
		["Brouillon", "bg-zinc-400", ["Chargé·e de communication"]],
		["Envoyée", "bg-sky-400", ["Développeur·se web", "Assistant·e RH"]],
		["Entretien", "bg-amber-400", ["Chef·fe de projet digital"]],
		["Offre reçue", "bg-accent-400", ["UX designer"]],
	];
	return (
		<figure className="flex flex-col gap-3">
			<div
				aria-hidden="true"
				className="overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(80%_100%_at_2.5%_0%,#1a1919,#050505)] shadow-[0_30px_80px_-20px_rgba(148,157,255,0.25)]"
			>
				<div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
					<span className="size-2.5 rounded-full bg-white/15" />
					<span className="size-2.5 rounded-full bg-white/15" />
					<span className="size-2.5 rounded-full bg-white/15" />
					<span className="ml-3 text-xs text-white/40">
						relance.skrim.dev/candidatures
					</span>
				</div>
				<div className="grid grid-cols-[10rem_1fr] max-sm:grid-cols-1">
					<div className="flex flex-col gap-1 border-r border-white/10 p-3 text-xs max-sm:hidden">
						<span className="mb-2 rounded-full bg-white px-3 py-1.5 text-center font-medium text-black">
							Nouvelle candidature
						</span>
						{[
							"Tableau de bord",
							"Candidatures",
							"Rappels",
							"Rechercher des offres",
						].map((l, i) => (
							<span
								key={l}
								className={`rounded-lg px-2 py-1.5 ${i === 1 ? "bg-white/10 text-white" : "text-white/50"}`}
							>
								{l}
							</span>
						))}
					</div>
					<div className="flex flex-col gap-3 p-4">
						<span className="text-sm font-semibold">Candidatures</span>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
							{colonnes.map(([titre, couleur, cartes]) => (
								<div
									key={titre}
									className="flex flex-col gap-2 rounded-xl bg-white/[0.03] p-2"
								>
									<span className="flex items-center gap-1.5 text-[11px] font-medium text-white/70">
										<span className={`size-1.5 rounded-full ${couleur}`} />
										{titre}
									</span>
									{cartes.map((c) => (
										<span
											key={c}
											className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-[11px] leading-snug"
										>
											{c}
											<span className="block text-white/40">
												Entreprise d'exemple
											</span>
										</span>
									))}
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
			<figcaption className={`text-center text-xs ${discret}`}>
				Illustration avec des données d'exemple.
			</figcaption>
		</figure>
	);
}

export function Accueil() {
	const session = authClient.useSession();
	const [params] = useSearchParams();
	const sante = useQuery({
		queryKey: ["health"],
		queryFn: async () => {
			const res = await fetch("/api/health");
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		},
	});
	if (session.data) return <Navigate to="/tableau" replace />;
	const etat = sante.isPending
		? "vérification…"
		: sante.isSuccess
			? "opérationnel"
			: "indisponible";

	return (
		<div className="relative overflow-x-clip">
			{/* Faisceau de lumière du template, purement décoratif. */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute -top-40 left-1/2 h-[42rem] w-[60rem] -translate-x-1/2 rotate-[-12deg] bg-[radial-gradient(closest-side,rgba(255,255,255,0.16),transparent)] blur-2xl"
			/>
			<header className="sticky top-0 z-30 border-b border-white/5 bg-black/60 backdrop-blur-md">
				<nav
					aria-label="Navigation de la page d'accueil"
					className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 sm:px-6"
				>
					<Link
						to="/"
						className="flex items-center gap-2 font-semibold tracking-tight"
					>
						<img
							src="/icone.svg"
							alt=""
							className="size-7 rounded-lg ring-1 ring-white/20"
						/>
						Relance
					</Link>
					<ul className="mx-auto hidden gap-6 text-sm text-white/55 md:flex">
						{[
							["#fonctionnalites", "Fonctionnalités"],
							["#fonctionnement", "Fonctionnement"],
							["#engagements", "Confidentialité"],
							["#questions", "Questions"],
						].map(([vers, libelle]) => (
							<li key={vers}>
								<a href={vers} className="transition-colors hover:text-white">
									{libelle}
								</a>
							</li>
						))}
					</ul>
					<Link
						to="/connexion"
						className={`${bouton} ml-auto self-center md:ml-0`}
					>
						Se connecter
					</Link>
				</nav>
			</header>

			<main className="relative mx-auto flex max-w-6xl flex-col gap-28 px-4 pb-16 sm:px-6">
				<section className="flex flex-col items-center gap-7 pt-20 text-center sm:pt-28">
					{params.has("compte") && (
						<p role="status" className={succes}>
							Votre compte et toutes vos données ont été supprimés.
						</p>
					)}
					<span className={pastille}>Pour les étudiants en alternance</span>
					<h1 className="max-w-4xl text-5xl leading-[1.05] font-semibold tracking-[-0.04em] text-balance sm:text-7xl">
						Ne laissez plus une candidature sans réponse.
					</h1>
					<p className="max-w-2xl text-lg text-white/60">
						Relance suit vos candidatures d'alternance de l'offre à la réponse,
						vous rappelle quand relancer et vous aide à préparer chaque envoi.
					</p>
					<div className="flex flex-wrap justify-center gap-3">
						<Link to="/connexion" className={`${bouton} px-6 py-2.5 text-base`}>
							Commencer gratuitement
						</Link>
						<a
							href="#fonctionnalites"
							className={`${boutonSecondaire} px-6 py-2.5 text-base`}
						>
							Voir les fonctionnalités
						</a>
					</div>
					<p className="text-sm text-white/40">
						Gratuit · Sans mot de passe · Données hébergées dans l'UE
					</p>
				</section>

				<Illustration />

				<section
					id="fonctionnalites"
					aria-labelledby="titre-fonctionnalites"
					className="flex scroll-mt-24 flex-col items-center gap-10"
				>
					<div className="flex max-w-2xl flex-col items-center gap-4 text-center">
						<span className={pastille}>Fonctionnalités</span>
						<h2 id="titre-fonctionnalites" className={titreSection}>
							Tout ce qu'il faut pour votre recherche, rien de plus
						</h2>
						<p className="text-white/55">
							De la première offre trouvée à la réponse de l'entreprise, chaque
							étape a sa place.
						</p>
					</div>
					<ul className="grid w-full gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
						{fonctionnalites.map((f) => (
							<li key={f.titre} className="flex flex-col gap-3 bg-black p-6">
								<span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
									<Icone d={f.icone} />
								</span>
								<h3 className="font-semibold tracking-tight">{f.titre}</h3>
								<p className="text-sm text-white/55">{f.texte}</p>
							</li>
						))}
					</ul>
				</section>

				<section
					id="fonctionnement"
					aria-labelledby="titre-fonctionnement"
					className="flex scroll-mt-24 flex-col items-center gap-10"
				>
					<div className="flex max-w-2xl flex-col items-center gap-4 text-center">
						<span className={pastille}>Fonctionnement</span>
						<h2 id="titre-fonctionnement" className={titreSection}>
							Trois étapes pour reprendre la main
						</h2>
					</div>
					<ol className="grid w-full gap-4 md:grid-cols-3">
						{etapes.map(([titre, texte], i) => (
							<li
								key={titre}
								className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[radial-gradient(80%_100%_at_0%_0%,rgba(255,255,255,0.07),rgba(255,255,255,0.015))] p-6"
							>
								<span className="text-sm font-medium text-accent-300">
									Étape {i + 1}
								</span>
								<h3 className="text-lg font-semibold tracking-tight">
									{titre}
								</h3>
								<p className="text-sm text-white/55">{texte}</p>
							</li>
						))}
					</ol>
				</section>

				<section
					id="engagements"
					aria-labelledby="titre-engagements"
					className="grid scroll-mt-24 items-center gap-10 rounded-3xl border border-white/10 bg-[radial-gradient(60%_80%_at_100%_0%,rgba(148,157,255,0.14),transparent)] p-8 md:grid-cols-2 md:p-12"
				>
					<div className="flex flex-col items-start gap-4">
						<span className={pastille}>Confidentialité</span>
						<h2 id="titre-engagements" className={titreSection}>
							Vos données restent les vôtres
						</h2>
						<p className="text-white/55">
							Relance est un projet indépendant. Le détail de ce qui est
							collecté et de qui le reçoit est dans la{" "}
							<Link
								to="/confidentialite"
								className="text-white underline decoration-white/30 hover:decoration-white"
							>
								politique de confidentialité
							</Link>
							.
						</p>
					</div>
					<ul className="flex flex-col gap-3">
						{engagements.map((e) => (
							<li key={e} className="flex gap-3">
								<span
									aria-hidden="true"
									className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-400/15 text-xs text-accent-300"
								>
									✓
								</span>
								<span className="text-white/80">{e}</span>
							</li>
						))}
					</ul>
				</section>

				<section
					id="questions"
					aria-labelledby="titre-questions"
					className="mx-auto flex w-full max-w-3xl scroll-mt-24 flex-col gap-8"
				>
					<div className="flex flex-col items-center gap-4 text-center">
						<span className={pastille}>Questions</span>
						<h2 id="titre-questions" className={titreSection}>
							Les réponses avant de commencer
						</h2>
					</div>
					<div className="divide-y divide-white/10 rounded-2xl border border-white/10">
						{questions.map(([q, r]) => (
							<details key={q} className="group px-6 py-4">
								<summary className="flex list-none items-center justify-between gap-4 font-medium">
									{q}
									<span
										aria-hidden="true"
										className="text-white/40 transition-transform group-open:rotate-45"
									>
										+
									</span>
								</summary>
								<p className="mt-3 text-sm text-white/60">{r}</p>
							</details>
						))}
					</div>
				</section>

				<section className="relative flex flex-col items-center gap-6 overflow-hidden rounded-3xl border border-white/10 px-6 py-16 text-center">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-x-0 -top-32 mx-auto h-64 w-[40rem] max-w-full bg-[radial-gradient(closest-side,rgba(148,157,255,0.3),transparent)] blur-2xl"
					/>
					<h2 className={`relative ${titreSection}`}>
						Votre prochaine relance commence ici.
					</h2>
					<p className="relative max-w-xl text-white/60">
						Créez votre compte en une minute avec votre adresse e-mail.
					</p>
					<Link
						to="/connexion"
						className={`${bouton} relative self-center px-6 py-2.5 text-base`}
					>
						Commencer gratuitement
					</Link>
				</section>
			</main>

			<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 border-t border-white/10 px-4 sm:px-6">
				<Pied />
				<p role="status" className={`text-sm ${discret}`}>
					État du service : {etat}
				</p>
			</div>
		</div>
	);
}
