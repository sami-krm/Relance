import { env } from "cloudflare:workers";

const expediteur = { name: "Relance", email: "relance@skrim.dev" };

export async function sendEmail(mail: {
	to: string;
	subject: string;
	text: string;
}) {
	// shortcut: en local sans clé Brevo, l'e-mail s'affiche dans le terminal ; mettre BREVO_API_KEY dans .dev.vars pour un vrai envoi.
	if (
		!env.BREVO_API_KEY &&
		env.BETTER_AUTH_URL.startsWith("http://localhost")
	) {
		console.info(`[dev] E-mail pour ${mail.to} :\n${mail.text}`);
		return;
	}
	const res = await fetch("https://api.brevo.com/v3/smtp/email", {
		method: "POST",
		headers: {
			"api-key": env.BREVO_API_KEY,
			"content-type": "application/json",
			accept: "application/json",
		},
		body: JSON.stringify({
			sender: expediteur,
			to: [{ email: mail.to }],
			subject: mail.subject,
			// Texte seul : sans HTML, Brevo n'ajoute ni pixel d'ouverture ni lien de suivi des clics.
			textContent: mail.text,
		}),
	});
	if (!res.ok) {
		console.error("Brevo a refusé l'envoi", res.status, await res.text());
		throw new Error("Envoi de l'e-mail impossible");
	}
}
