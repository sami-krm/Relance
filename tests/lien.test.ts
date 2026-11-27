import { afterEach, expect, it, vi } from "vitest";
import { adressePublique, analyserPage } from "../src/server/lien";
import { type Offre, type OffreLue, SOURCE_LIEN } from "../src/shared/schemas";
import { api, connecter } from "./outils";

afterEach(() => vi.restoreAllMocks());

const pageJsonLd = `<!doctype html><html><head><title>Offre</title>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
 {"@type":"Organization","name":"Autre"},
 {"@type":"JobPosting","title":"D&eacute;veloppeur web &amp; mobile (H/F)",
  "hiringOrganization":{"@type":"Organization","name":"Atelier invent&eacute;"},
  "jobLocation":[{"@type":"Place","address":{"addressLocality":"Lyon","postalCode":"69001"}}],
  "datePosted":"2026-11-20T08:00:00+01:00","validThrough":"2027-01-31",
  "description":"<p>Missions :</p><ul><li>React</li><li>API</li></ul>"}
]}</script></head><body></body></html>`;

it("lit les données structurées d'une offre", () => {
	expect(analyserPage(pageJsonLd)).toEqual({
		intitule: "Développeur web & mobile (H/F)",
		entreprise: "Atelier inventé",
		lieu: "Lyon 69001",
		datePublication: "2026-11-20",
		dateLimite: "2027-01-31",
		description: "Missions :\nReact\nAPI",
	});
});

it("se rabat sur le titre et la description de la page", () => {
	const page = `<head><meta property="og:title" content="Alternance comptable &#8211; Exemple">
<meta name="description" content="Une offre d&#39;alternance"><meta property="og:site_name" content="Exemple"></head>`;
	expect(analyserPage(page)).toMatchObject({
		intitule: "Alternance comptable – Exemple",
		entreprise: "Exemple",
		description: "Une offre d'alternance",
	});
	expect(analyserPage("<p>rien</p>").intitule).toBe("");
});

it("refuse les adresses locales ou privées", () => {
	for (const u of [
		"http://localhost/x",
		"http://127.0.0.1/x",
		"http://[::1]/x",
		"http://intranet/x",
		"http://serveur.local/x",
		"https://exemple.fr:8080/x",
		"ftp://exemple.fr/x",
	])
		expect(adressePublique(new URL(u)), u).toBe(false);
	expect(adressePublique(new URL("https://www.exemple.fr/offre/1"))).toBe(true);
});

it("préremplit depuis un lien puis ajoute l'offre une seule fois", async () => {
	const cookie = await connecter("lien@exemple.test");
	const lien = "https://www.exemple.fr/offre/1";
	const espion = vi
		.spyOn(globalThis, "fetch")
		.mockImplementation(
			async () =>
				new Response(pageJsonLd, { headers: { "content-type": "text/html" } }),
		);
	const lire = (url: string) =>
		api(cookie, "/recherche/lien", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ url }),
		}).then((r) => r.json<{ offre: OffreLue | null; message?: string }>());

	const r = await lire(lien);
	expect(r.offre?.intitule).toBe("Développeur web & mobile (H/F)");
	expect(r.message).toBeUndefined();

	// Adresse locale : aucune requête, saisie manuelle.
	espion.mockClear();
	const local = await lire("http://localhost:8787/admin");
	expect(local).toMatchObject({ offre: null });
	expect(local.message).toContain("à la main");
	expect(espion).not.toHaveBeenCalled();

	const ajouter = () =>
		api(cookie, "/recherche/offres", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				...r.offre,
				source: SOURCE_LIEN,
				idSource: lien,
				lien,
			}),
		});
	expect((await ajouter()).status).toBe(201);
	expect((await ajouter()).status).toBe(409);
	const [offre] = await (await api(cookie, "/offres")).json<Offre[]>();
	expect(offre).toMatchObject({
		source: SOURCE_LIEN,
		lien,
		contrat: "",
		dateLimite: "2027-01-31",
	});
});
