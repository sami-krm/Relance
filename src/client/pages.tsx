import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { authClient } from "./auth";
import { alerte, bouton, discret, Page } from "./ui";

export function Accueil() {
	const session = authClient.useSession();
	const [params] = useSearchParams();
	const health = useQuery({
		queryKey: ["health"],
		queryFn: async () => {
			const res = await fetch("/api/health");
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.json();
		},
	});
	if (session.data) return <Navigate to="/tableau" replace />;
	const status = health.isPending
		? "vérification…"
		: health.isSuccess
			? "opérationnel"
			: "indisponible";

	return (
		<Page>
			{params.has("compte") && (
				<p role="status" className="rounded-md border border-zinc-400 p-3">
					Votre compte et toutes vos données ont été supprimés.
				</p>
			)}
			<h1 className="text-4xl font-bold">Relance</h1>
			<p className="text-lg">
				Suivre ses candidatures d'alternance et ne jamais oublier une relance.
			</p>
			<ul className={`flex list-disc flex-col gap-1 pl-5 ${discret}`}>
				<li>Vos offres, candidatures et entreprises au même endroit.</li>
				<li>
					Une relance proposée une semaine après chaque envoi, et un e-mail de
					rappel le jour venu.
				</li>
				<li>
					Gratuit, sans mot de passe, données hébergées dans l'Union européenne.
				</li>
			</ul>
			{!session.isPending && (
				<Link to="/connexion" className={bouton}>
					Se connecter
				</Link>
			)}
			<p role="status" className={`text-sm ${discret}`}>
				État du service : {status}
			</p>
		</Page>
	);
}

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
				<h1 className="text-2xl font-bold">Vérifiez vos e-mails</h1>
				<p role="status">
					Un lien de connexion a été envoyé à {email}. Il expire dans 15 minutes
					et ne sert qu'une fois.
				</p>
			</Page>
		);
	}

	return (
		<Page>
			<h1 className="text-2xl font-bold">Connexion</h1>
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
					className="rounded-md border border-zinc-400 bg-transparent px-3 py-2"
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
				<h1 className="text-2xl font-bold">Lien incomplet</h1>
				<Link to="/connexion" className="underline">
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
			<h1 className="text-2xl font-bold">Connexion à Relance</h1>
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
			<h1 className="text-2xl font-bold">Page introuvable</h1>
			<Link to="/" className="underline">
				Retour à l'accueil
			</Link>
		</Page>
	);
}
