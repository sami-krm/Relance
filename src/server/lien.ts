import type { OffreLue } from "../shared/schemas";

const TAILLE_MAX = 1024 * 1024;

// Refuse les adresses locales ou privées : le serveur ne doit pas servir à sonder un réseau interne.
export function adressePublique(url: URL) {
	const h = url.hostname.toLowerCase();
	if (url.protocol !== "https:" && url.protocol !== "http:") return false;
	if (url.port || url.username || url.password) return false;
	if (h === "localhost" || h.endsWith(".localhost") || !h.includes("."))
		return false;
	if (/\.(local|internal|lan|home|test)$/.test(h)) return false;
	// Adresses IP écrites en clair (IPv4 ou IPv6) : on n'accepte que des noms de domaine.
	if (/^[\d.]+$/.test(h) || h.startsWith("[")) return false;
	return true;
}

async function lireTexte(res: Response) {
	const lecteur = res.body?.getReader();
	if (!lecteur) return "";
	const morceaux: Uint8Array[] = [];
	let taille = 0;
	while (taille < TAILLE_MAX) {
		const { done, value } = await lecteur.read();
		if (done) break;
		morceaux.push(value);
		taille += value.length;
	}
	await lecteur.cancel().catch(() => {});
	const tout = new Uint8Array(Math.min(taille, TAILLE_MAX));
	let position = 0;
	for (const m of morceaux) {
		const part = m.subarray(0, tout.length - position);
		tout.set(part, position);
		position += part.length;
		if (position >= tout.length) break;
	}
	return new TextDecoder().decode(tout);
}

const entites: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	rsquo: "’",
	lsquo: "‘",
	laquo: "«",
	raquo: "»",
	hellip: "…",
	ndash: "–",
	mdash: "—",
	euro: "€",
	oelig: "œ",
	ccedil: "ç",
};
// Lettres accentuées du français : &eacute; → é, &Agrave; → À…
const accents: Record<string, string> = {
	acute: "́",
	grave: "̀",
	circ: "̂",
	uml: "̈",
};
const nommee = (e: string) => {
	if (entites[e]) return entites[e];
	const m = e.match(/^([aeiouyAEIOUY])(acute|grave|circ|uml)$/);
	return m ? (m[1] + accents[m[2]]).normalize("NFC") : undefined;
};
const decoder = (s: string) =>
	s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (tout, e: string) => {
		if (e[0] !== "#") return nommee(e) ?? tout;
		const code =
			e[1] === "x" || e[1] === "X"
				? Number.parseInt(e.slice(2), 16)
				: Number(e.slice(1));
		return Number.isFinite(code) ? String.fromCodePoint(code) : tout;
	});

// Description souvent en HTML : on garde les retours à la ligne et le texte.
const texteBrut = (html: string) =>
	decoder(
		html
			.replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, "\n")
			.replace(/<[^>]+>/g, ""),
	)
		.replace(/[ \t]+/g, " ")
		.replace(/\n\s*\n+/g, "\n\n")
		.trim();

const date = (v: unknown) =>
	typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : "";
const chaine = (v: unknown) => (typeof v === "string" ? v : "");
const premier = (v: unknown) => (Array.isArray(v) ? v[0] : v);

type Objet = Record<string, unknown>;

function trouverJobPosting(v: unknown): Objet | undefined {
	if (Array.isArray(v)) {
		for (const x of v) {
			const j = trouverJobPosting(x);
			if (j) return j;
		}
		return undefined;
	}
	if (!v || typeof v !== "object") return undefined;
	const o = v as Objet;
	const type = o["@type"];
	if (
		type === "JobPosting" ||
		(Array.isArray(type) && type.includes("JobPosting"))
	)
		return o;
	return trouverJobPosting(o["@graph"]);
}

// Données structurées schema.org publiées par la plupart des sites d'offres pour les moteurs de recherche.
function depuisJsonLd(html: string): OffreLue | undefined {
	const re =
		/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
	for (const [, contenu] of html.matchAll(re)) {
		let donnees: unknown;
		try {
			donnees = JSON.parse(contenu);
		} catch {
			continue;
		}
		const j = trouverJobPosting(donnees);
		if (!j) continue;
		const organisation = premier(j.hiringOrganization);
		const lieu = premier(j.jobLocation) as Objet | undefined;
		const adresse = (lieu?.address ?? {}) as Objet;
		return {
			intitule: decoder(chaine(j.title)).trim(),
			entreprise: decoder(
				typeof organisation === "string"
					? organisation
					: chaine((organisation as Objet | undefined)?.name),
			).trim(),
			lieu: decoder(
				[chaine(adresse.addressLocality), chaine(adresse.postalCode)]
					.filter(Boolean)
					.join(" "),
			).trim(),
			datePublication: date(j.datePosted),
			dateLimite: date(j.validThrough),
			description: texteBrut(chaine(j.description)),
		};
	}
	return undefined;
}

function meta(html: string, nom: string) {
	for (const balise of html.match(/<meta\b[^>]*>/gi) ?? []) {
		const cle = balise.match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1];
		if (cle?.toLowerCase() !== nom) continue;
		const valeur = balise.match(/\bcontent=["']([^"']*)["']/i)?.[1];
		if (valeur) return decoder(valeur).trim();
	}
	return "";
}

// Lit les informations d'une offre dans le HTML ; tout ce qui manque reste vide.
export function analyserPage(html: string): OffreLue {
	const structurees = depuisJsonLd(html);
	if (structurees?.intitule) return structurees;
	const titre =
		meta(html, "og:title") ||
		decoder(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
	return {
		intitule: titre.slice(0, 200),
		entreprise: meta(html, "og:site_name").slice(0, 200),
		lieu: "",
		datePublication: "",
		dateLimite: "",
		description: meta(html, "og:description") || meta(html, "description"),
	};
}

export async function lireOffre(adresse: string): Promise<OffreLue | null> {
	const url = new URL(adresse);
	if (!adressePublique(url)) return null;
	const res = await fetch(url, {
		headers: {
			accept: "text/html",
			"user-agent": "Relance (https://relance.skrim.dev)",
		},
		redirect: "follow",
		signal: AbortSignal.timeout(8000),
	});
	if (
		!res.ok ||
		!res.headers.get("content-type")?.includes("html") ||
		// Une redirection ne doit pas mener vers une adresse refusée au départ.
		!adressePublique(new URL(res.url || url))
	)
		return null;
	return analyserPage(await lireTexte(res));
}
