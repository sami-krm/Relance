import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const site = "https://relance.skrim.dev";
let emails: { to: string; expediteur: string; texte: string; html?: string }[] =
	[];

beforeEach(() => {
	emails = [];
	// Le Worker tourne dans le même isolat que les tests : on intercepte ses appels à Brevo.
	vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
		const url = input instanceof Request ? input.url : String(input);
		if (!url.startsWith("https://api.brevo.com/"))
			throw new Error(`Appel réseau inattendu : ${url}`);
		const corps = JSON.parse(String(init?.body));
		emails.push({
			to: corps.to[0].email,
			expediteur: corps.sender.email,
			texte: corps.textContent,
			html: corps.htmlContent,
		});
		return Response.json({ messageId: "test" }, { status: 201 });
	});
});
afterEach(() => vi.restoreAllMocks());

function demanderLien(email: string, ip = "203.0.113.1") {
	return exports.default.fetch(`${site}/api/auth/sign-in/magic-link`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: site,
			"cf-connecting-ip": ip,
		},
		body: JSON.stringify({ email }),
	});
}

function jetonDuDernierEmail() {
	const lien = emails
		.at(-1)
		?.texte.match(
			/https:\/\/relance\.skrim\.dev\/connexion\/lien\?token=(\w+)/,
		);
	if (!lien) throw new Error("Aucun lien dans l'e-mail");
	return lien[1];
}

async function session(cookie: string) {
	const res = await exports.default.fetch(`${site}/api/auth/get-session`, {
		headers: { cookie },
	});
	return res.json<{ user: { email: string } } | null>();
}

it("envoie par Brevo un lien valable 15 minutes, dont le jeton est stocké haché", async () => {
	const res = await demanderLien("alice@example.com");
	expect(res.status).toBe(200);
	expect(emails).toHaveLength(1);
	expect(emails[0]).toMatchObject({
		to: "alice@example.com",
		expediteur: "relance@skrim.dev",
		html: undefined,
	});

	const jeton = jetonDuDernierEmail();
	const ligne = await env.DB.prepare(
		"select identifier, expires_at from verification",
	).first<{ identifier: string; expires_at: number }>();
	expect(ligne?.identifier).not.toContain(jeton);
	const resteMs = (ligne?.expires_at ?? 0) - Date.now();
	expect(resteMs).toBeGreaterThan(14 * 60_000);
	expect(resteMs).toBeLessThanOrEqual(15 * 60_000);
});

it("le lien connecte une seule fois, puis la déconnexion ferme la session", async () => {
	await demanderLien("bob@example.com");
	const verifier = new URL(`${site}/api/auth/magic-link/verify`);
	verifier.searchParams.set("token", jetonDuDernierEmail());
	verifier.searchParams.set("callbackURL", "/");
	verifier.searchParams.set("errorCallbackURL", "/connexion?erreur=lien");

	const premier = await exports.default.fetch(verifier, { redirect: "manual" });
	expect(premier.status).toBe(302);
	expect(premier.headers.get("location")).toBe(`${site}/`);
	const cookies = premier.headers.getSetCookie();
	const cookieSession = cookies.find((c) => c.includes("session_token="));
	expect(cookieSession).toMatch(/HttpOnly/i);
	expect(cookieSession).toMatch(/Secure/i);
	expect(cookieSession).toMatch(/SameSite=Lax/i);
	const cookie = cookies.map((c) => c.split(";")[0]).join("; ");
	expect((await session(cookie))?.user.email).toBe("bob@example.com");

	const second = await exports.default.fetch(verifier, { redirect: "manual" });
	expect(second.headers.get("location")).toContain("/connexion?erreur=lien");

	const sortie = await exports.default.fetch(`${site}/api/auth/sign-out`, {
		method: "POST",
		headers: { cookie, origin: site },
	});
	expect(sortie.status).toBe(200);
	expect(await session(cookie)).toBeNull();
});

it("refuse plus de 5 demandes par minute depuis une même IP", async () => {
	const statuts: number[] = [];
	for (let i = 0; i < 6; i++)
		statuts.push(
			(await demanderLien(`ip${i}@example.com`, "203.0.113.9")).status,
		);
	expect(statuts).toEqual([200, 200, 200, 200, 200, 429]);
});

it("refuse plus de 5 demandes par minute pour une même adresse", async () => {
	const statuts: number[] = [];
	for (let i = 0; i < 6; i++)
		statuts.push(
			(await demanderLien("cible@example.com", `198.51.100.${i}`)).status,
		);
	expect(statuts).toEqual([200, 200, 200, 200, 200, 429]);
	expect(emails).toHaveLength(5);
});
