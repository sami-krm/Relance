import type { ReactNode } from "react";
import { Link } from "react-router";
import { discret, Pied } from "./ui";

function PageTexte({
	titre,
	children,
}: {
	titre: string;
	children: ReactNode;
}) {
	return (
		<>
			<main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-6">
				<Link to="/" className="text-sm underline">
					← Relance
				</Link>
				<h1 className="text-3xl font-bold">{titre}</h1>
				<p className={`text-sm ${discret}`}>Version du 26 novembre 2026.</p>
				{children}
			</main>
			<Pied />
		</>
	);
}

const contact = (
	<a
		href="mailto:hello@skrim.dev"
		className="font-medium text-teal-700 underline decoration-teal-300 hover:decoration-current dark:text-teal-300 dark:decoration-teal-700"
	>
		hello@skrim.dev
	</a>
);

export function MentionsLegales() {
	return (
		<PageTexte titre="Mentions légales">
			<h2>Éditeur</h2>
			<p>
				Relance est un projet personnel et non commercial de Sami Krim,
				étudiant. Contact : {contact}.
			</p>
			<p>Directeur de la publication : Sami Krim.</p>
			<h2>Hébergement</h2>
			<p>
				Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107,
				États-Unis. La base de données et les fichiers sont stockés dans l'Union
				européenne (juridiction UE de Cloudflare D1 et R2).
			</p>
			<h2>Données personnelles</h2>
			<p>
				Voir la{" "}
				<Link
					to="/confidentialite"
					className="font-medium text-teal-700 underline decoration-teal-300 hover:decoration-current dark:text-teal-300 dark:decoration-teal-700"
				>
					politique de confidentialité
				</Link>
				.
			</p>
		</PageTexte>
	);
}

export function Confidentialite() {
	return (
		<PageTexte titre="Politique de confidentialité">
			<p>
				Relance sert à suivre vos candidatures. Vos données ne sont ni vendues
				ni utilisées pour de la publicité, et ne servent qu'à faire fonctionner
				le service.
			</p>
			<h2>Responsable du traitement</h2>
			<p>Sami Krim, joignable à {contact}.</p>
			<h2>Données traitées</h2>
			<ul>
				<li>
					Votre adresse e-mail, pour créer votre compte et vous connecter.
				</li>
				<li>
					Ce que vous saisissez : profil, CV et lettres, entreprises, contacts,
					offres, candidatures, réponses reçues, rappels. Les coordonnées de
					contacts sont celles que vous choisissez d'enregistrer.
				</li>
				<li>
					Pour la sécurité de votre session : le navigateur utilisé (pas votre
					adresse IP).
				</li>
			</ul>
			<p>
				Base légale : l'exécution du service que vous demandez en créant un
				compte (article 6.1.b du RGPD).
			</p>
			<h2>Où vont vos données</h2>
			<ul>
				<li>
					Cloudflare héberge l'application. La base de données et les fichiers
					restent dans l'Union européenne. Cloudflare traite votre adresse IP
					pour acheminer les pages et limiter les abus.
				</li>
				<li>
					Brevo (France) envoie les e-mails de connexion et de rappel : il
					reçoit votre adresse e-mail et le contenu de l'e-mail. Brevo compte
					les ouvertures d'e-mails de façon anonyme, sans les rattacher à vous.
				</li>
				<li>
					Quand vous recherchez des offres : ROMEO (France Travail) reçoit les
					mots-clés saisis pour reconnaître les métiers correspondants, à l'aide
					d'une intelligence artificielle ; geo.api.gouv.fr (État) reçoit la
					ville saisie ; La bonne alternance (État) reçoit les codes métier, la
					position de la ville et la distance. Aucun de ces services ne reçoit
					votre nom, votre adresse e-mail ou votre CV.
				</li>
				<li>
					Seulement si vous avez donné votre accord pour les brouillons par IA :
					Cloudflare Workers AI (modèle Mistral Small 3.1) reçoit les champs de
					votre profil que vous avez autorisés au partage et la candidature
					concernée, pour rédiger le brouillon demandé. Ce calcul peut avoir
					lieu hors de l'Union européenne. Votre CV n'est jamais envoyé. Base
					légale : votre consentement (article 6.1.a du RGPD), que vous pouvez
					retirer à tout moment dans les paramètres.
				</li>
				<li>Aucun autre service.</li>
			</ul>
			<h2>Durée de conservation</h2>
			<ul>
				<li>Vos données : jusqu'à la suppression de votre compte.</li>
				<li>Les liens de connexion : 15 minutes, et un seul usage.</li>
				<li>Les sessions : 7 jours sans activité.</li>
			</ul>
			<h2>Cookies</h2>
			<p>
				Un seul cookie, nécessaire à la connexion. Aucun traceur publicitaire,
				aucune mesure d'audience.
			</p>
			<h2>Vos droits</h2>
			<ul>
				<li>Modifier vos données : directement dans l'application.</li>
				<li>
					Récupérer vos candidatures : Paramètres, « Exporter mes candidatures
					(CSV) ».
				</li>
				<li>
					Tout effacer : Paramètres, « Supprimer mon compte ». Données et
					fichiers sont effacés définitivement.
				</li>
				<li>Pour toute autre demande : {contact}.</li>
			</ul>
			<p>
				Vous pouvez aussi adresser une réclamation à la CNIL (
				<a
					href="https://www.cnil.fr"
					className="font-medium text-teal-700 underline decoration-teal-300 hover:decoration-current dark:text-teal-300 dark:decoration-teal-700"
				>
					cnil.fr
				</a>
				).
			</p>
		</PageTexte>
	);
}
