import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import "./index.css";
import {
	PageCandidature,
	PageCandidatures,
	PageNouvelleCandidature,
} from "./candidatures";
import { PageDocuments } from "./documents";
import { Confidentialite, MentionsLegales } from "./legal";
import { Accueil, Connexion, LienConnexion, PageIntrouvable } from "./pages";
import { PageProfil } from "./profil";
import { PageParametres, PageRappels } from "./rappels";
import { PageRecherche } from "./recherche";
import { PageEntreprise, PageEntreprises, PageOffres } from "./repertoire";
import { PageTableau } from "./tableau";
import { EspaceConnecte } from "./ui";

const router = createBrowserRouter([
	{ path: "/", element: <Accueil /> },
	{ path: "/connexion", element: <Connexion /> },
	{ path: "/connexion/lien", element: <LienConnexion /> },
	{
		element: <EspaceConnecte />,
		children: [
			{ path: "/tableau", element: <PageTableau /> },
			{ path: "/candidatures", element: <PageCandidatures /> },
			{ path: "/candidatures/nouvelle", element: <PageNouvelleCandidature /> },
			{ path: "/candidatures/:id", element: <PageCandidature /> },
			{ path: "/rappels", element: <PageRappels /> },
			{ path: "/parametres", element: <PageParametres /> },
			{ path: "/profil", element: <PageProfil /> },
			{ path: "/documents", element: <PageDocuments /> },
			{ path: "/entreprises", element: <PageEntreprises /> },
			{ path: "/entreprises/:id", element: <PageEntreprise /> },
			{ path: "/offres", element: <PageOffres /> },
			{ path: "/recherche", element: <PageRecherche /> },
		],
	},
	{ path: "/mentions-legales", element: <MentionsLegales /> },
	{ path: "/confidentialite", element: <Confidentialite /> },
	{ path: "*", element: <PageIntrouvable /> },
]);
const queryClient = new QueryClient();

// biome-ignore lint/style/noNonNullAssertion: #root est dans index.html
createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	</StrictMode>,
);
