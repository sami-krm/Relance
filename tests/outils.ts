import { exports } from "cloudflare:workers";
import { vi } from "vitest";

export const site = "https://relance.skrim.dev";

// Connecte un compte de test par le vrai lien magique ; l'appel à Brevo est intercepté.
export async function connecter(email: string) {
	let texte = "";
	const espion = vi
		.spyOn(globalThis, "fetch")
		.mockImplementation(async (_url, init) => {
			texte = JSON.parse(String(init?.body)).textContent;
			return Response.json({}, { status: 201 });
		});
	await exports.default.fetch(`${site}/api/auth/sign-in/magic-link`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: site,
			"cf-connecting-ip": crypto.randomUUID(),
		},
		body: JSON.stringify({ email }),
	});
	espion.mockRestore();
	const jeton = texte.match(/token=(\w+)/)?.[1];
	const res = await exports.default.fetch(
		`${site}/api/auth/magic-link/verify?token=${jeton}`,
	);
	return res.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ");
}

export function api(cookie: string, chemin: string, init: RequestInit = {}) {
	return exports.default.fetch(`${site}/api${chemin}`, {
		...init,
		headers: { cookie, ...init.headers },
	});
}

export const json = (corps: unknown) => ({
	headers: { "content-type": "application/json" },
	body: JSON.stringify(corps),
});
