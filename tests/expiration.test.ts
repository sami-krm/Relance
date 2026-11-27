import { env } from "cloudflare:workers";
import { afterEach, expect, it, vi } from "vitest";
import { verifierExpirations } from "../src/server/expiration";
import type { Offre } from "../src/shared/schemas";
import { api, connecter } from "./outils";

afterEach(() => vi.restoreAllMocks());

const hex = (c: string) => c.repeat(24);

it("signale les offres pourvues, annulées, retirées ou expirées, et seulement elles", async () => {
	const cookie = await connecter("expiration@exemple.test");
	const ids = {
		active: hex("a"),
		pourvue: hex("b"),
		retiree: hex("c"),
		datePassee: hex("d"),
		panne: hex("e"),
		franceTravail: "216VKWK",
	};
	for (const [intitule, idSource] of Object.entries(ids))
		expect(
			(
				await api(cookie, "/recherche/offres", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						source: "La bonne alternance",
						idSource,
						intitule,
						entreprise: "Atelier inventé",
					}),
				})
			).status,
		).toBe(201);

	const appels: string[] = [];
	vi.spyOn(globalThis, "fetch").mockImplementation(async (entree) => {
		const id = String(entree).split("/").pop() ?? "";
		appels.push(id);
		const offre = (status: string, expiration: string | null) =>
			Response.json({ offer: { status, publication: { expiration } } });
		if (id === ids.active) return offre("Active", "2027-05-14T00:00:00Z");
		if (id === ids.pourvue) return offre("Filled", null);
		if (id === ids.retiree) return new Response(null, { status: 404 });
		if (id === ids.datePassee) return offre("Active", "2026-11-20T00:00:00Z");
		return new Response("panne", { status: 500 });
	});
	await verifierExpirations(env, "2026-11-27");

	// Les offres France Travail relayées n'ont pas d'identifiant chez La bonne alternance.
	expect(appels).not.toContain(ids.franceTravail);
	const offres = await (await api(cookie, "/offres")).json<Offre[]>();
	const expiree = Object.fromEntries(
		offres.map((o) => [o.intitule, o.expiree]),
	);
	// Toutes les offres vérifiées passent en fin de file, même celle restée sans réponse.
	expect(
		new Set(
			offres
				.filter((o) => o.intitule !== "franceTravail")
				.map((o) => (o as Offre & { verifieeLe: string }).verifieeLe),
		),
	).toEqual(new Set(["2026-11-27"]));
	expect(expiree).toEqual({
		active: false,
		pourvue: true,
		retiree: true,
		datePassee: true,
		panne: false,
		franceTravail: false,
	});
});
