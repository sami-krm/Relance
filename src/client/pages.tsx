import { type FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { authClient } from "./auth";
import { alerte, bouton, champ, discret, Page } from "./ui";

export function Connexion() {
	const [params] = useSearchParams();
	const [email, setEmail] = useState("");
	const [etat, setEtat] = useState<"saisie" | "envoi" | "envoye">("saisie");
	const [erreur, setErreur] = useState(
		params.has("erreur")
			? "Ce lien est invalide ou a expiré. Demandez-en un nouveau."
			: "",
	);

	async function envoyer(e: FormEvent) {
		e.preventDefault();
		setEtat("envoi");
		setErreur("");
		const { error } = await authClient.signIn.magicLink({ email });
		if (!error) return setEtat("envoye");
		setEtat("saisie");
		setErreur(
			error.status === 429
				? "Trop de demandes. Réessayez dans une minute."
				: "L'envoi a échoué. Vérifiez l'adresse et réessayez.",
		);
	}

	if (etat === "envoye") {
		return (
			<Page>
				<h1 className="text-2xl font-semibold tracking-tight">
					Vérifiez vos e-mails
				</h1>
				<p role="status">
					Un lien de connexion a été envoyé à {email}. Il expire dans 15 minutes
					et ne sert qu'une fois.
				</p>
			</Page>
		);
	}

	return (
		<Page>
			<h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
			<p>
				Saisissez votre adresse e-mail : vous recevrez un lien pour vous
				connecter, sans mot de passe.
			</p>
			<form onSubmit={envoyer} className="flex flex-col gap-3">
				<label htmlFor="email" className="font-medium">
					Adresse e-mail
				</label>
				<input
					id="email"
					type="email"
					required
					autoComplete="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className={champ}
				/>
				<button type="submit" disabled={etat === "envoi"} className={bouton}>
					{etat === "envoi" ? "Envoi…" : "Recevoir le lien"}
				</button>
			</form>
			{erreur && (
				<p role="alert" className={alerte}>
					{erreur}
				</p>
			)}
			<p className={`text-sm ${discret}`}>
				Votre adresse sert uniquement à vous connecter. Elle est stockée dans
				l'Union européenne ; Brevo (France) la reçoit seulement pour envoyer le
				lien.
			</p>
		</Page>
	);
}

export function LienConnexion() {
	const [params] = useSearchParams();
	const token = params.get("token");

	if (!token) {
		return (
			<Page>
				<h1 className="text-2xl font-semibold tracking-tight">
					Lien incomplet
				</h1>
				<Link
					to="/connexion"
					className="font-medium text-accent-700 underline decoration-accent-300 hover:decoration-current dark:text-accent-300 dark:decoration-accent-700"
				>
					Demander un nouveau lien
				</Link>
			</Page>
		);
	}

	function seConnecter() {
		const url = new URL("/api/auth/magic-link/verify", window.location.origin);
		url.searchParams.set("token", token as string);
		url.searchParams.set("callbackURL", "/");
		url.searchParams.set("errorCallbackURL", "/connexion?erreur=lien");
		window.location.assign(url);
	}

	return (
		<Page>
			<h1 className="text-2xl font-semibold tracking-tight">
				Connexion à Relance
			</h1>
			<p>Ce lien ne sert qu'une fois.</p>
			<button type="button" className={bouton} onClick={seConnecter}>
				Me connecter
			</button>
		</Page>
	);
}

export function PageIntrouvable() {
	return (
		<Page>
			<h1 className="text-2xl font-semibold tracking-tight">
				Page introuvable
			</h1>
			<Link
				to="/"
				className="font-medium text-accent-700 underline decoration-accent-300 hover:decoration-current dark:text-accent-300 dark:decoration-accent-700"
			>
				Retour à l'accueil
			</Link>
		</Page>
	);
}
