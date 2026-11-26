# Relance — architecture technique (proposition)

Complète `cahier-des-charges-relance-v2.md`.

**Objectif :** une architecture simple, gratuite au départ, et qui montre en entretien de vraies compétences : une API, une base de données, l'authentification, des tests et un déploiement automatique.

## Vue d'ensemble

```
Navigateur ou PWA (React)
        │  HTTPS, relance.skrim.dev
        ▼
Un seul Worker Cloudflare
 ├── fichiers du front (React compilé)
 ├── /api/*   API REST (Hono)  ──► D1 (base SQL, hébergée en UE)
 │                             ──► R2 (fichiers PDF, privés, en UE)
 │                             ──► Workers AI (V2, brouillons de texte)
 └── tâche planifiée chaque matin ──► Brevo (e-mails de rappel)
```

Tout tient dans **un seul projet, un seul déploiement et un seul compte**, celui de Cloudflare qui héberge déjà skrim.dev.

## Choix techniques

| Rôle | Choix | Pourquoi |
|---|---|---|
| Langage | **TypeScript** partout | Les types sont partagés entre le front et l'API, et c'est très demandé en alternance |
| Front | **React + Vite**, React Router, TanStack Query | React est le framework le plus demandé. TanStack Query gère le cache et les chargements |
| Style et composants | Tailwind et composants accessibles (shadcn/ui, Radix) | Rapide à écrire et accessible au clavier |
| Kanban | dnd-kit | Glisser-déposer accessible au clavier |
| PWA | vite-plugin-pwa | Installation sur le téléphone |
| API | **Hono** dans un Worker Cloudflare | Léger, conçu pour les Workers, API REST claire |
| Validation | **Zod**, mêmes schémas côté front et API | Une seule définition des règles et aucune donnée non vérifiée en base |
| Base de données | **Cloudflare D1** (SQLite), juridiction UE | Gratuit, SQL classique, données en Europe (choix définitif à la création) |
| Accès à la base | **Drizzle ORM** et ses migrations | Requêtes typées, schéma versionné, reste proche du SQL |
| Fichiers | **Cloudflare R2**, juridiction UE, privé | Les CV ne sont jamais publics : l'API vérifie le propriétaire avant de servir un fichier |
| Comptes | **Better Auth** | Bibliothèque open source pour les sessions, la sécurité et la limitation des tentatives |
| E-mails | **Brevo**, 300 e-mails par jour gratuits | Entreprise française. L'envoi d'e-mails de Cloudflare vers n'importe quelle adresse demande l'offre payante |
| Rappels | Tâche planifiée (Cron Trigger) chaque matin à 7 h, heure de Paris | Gratuit et intégré au Worker |
| IA (V2) | **Workers AI** | 10 000 Neurons gratuits par jour et aucun compte de plus |
| Tests | **Vitest** pour l'API et la logique, **Playwright** pour les parcours | Les critères de réussite du cahier deviennent des tests automatiques |
| Intégration continue | GitHub Actions | Vérifications, types et tests à chaque push, puis déploiement automatique depuis `main` |

## Connexion : lien par e-mail (décidé)

Sur l'offre gratuite des Workers, une requête n'a droit qu'à **10 ms de calcul**. Hacher un mot de passe correctement (scrypt) prend plus de temps, et des utilisateurs de Better Auth sur Workers gratuits signalent des erreurs à l'inscription et à la connexion. Affaiblir le hachage pour passer sous la limite n'est pas une option.

- **Option recommandée : connexion par lien envoyé par e-mail.** L'utilisateur saisit son e-mail et clique sur le lien reçu. Il n'y a aucun mot de passe à stocker, à hacher ou à réinitialiser. C'est sûr, gratuit, et ça supprime l'écran « mot de passe oublié ». Better Auth le gère avec son extension « magic link ».
- **Autre option : e-mail et mot de passe.** Il faut alors l'offre Workers payante (5 $ par mois), qui donne aussi accès à l'envoi d'e-mails de Cloudflare.

**Option retenue : le lien par e-mail.** Le cahier des charges est à jour.

## Modèle de données (V1)

- `user`, `session`, `verification` : tables gérées par Better Auth.
- `profile` : formation, alternance (rythme, date de début, durée), recherche, lieu, compétences et texte libre. Champs partageables cochés par l'utilisateur.
- `document` : nom, type (CV, lettre ou réponse type), clé R2 pour un PDF ou texte pour une lettre, `is_default`, `archived_at`.
- `company` : nom, ville, site, secteur, notes.
- `contact` : rattaché à `company`.
- `offer` : rattachée à `company`, avec intitulé, lieu, contrat, source, lien, dates, description et `expired`.
- `application` : `company`, `offer` (facultative pour une candidature spontanée), `contact`, canal, statut, date d'envoi, CV utilisé et texte de la lettre envoyée (copié au moment de l'envoi), notes.
- `application_event` : historique daté des statuts et des réponses reçues.
- `tag` et `application_tag` : étiquettes libres.
- `reminder` : type, date, `application` facultative, statut (à faire, fait ou reporté), e-mail envoyé ou non.

Toutes les tables portent `user_id`, et **chaque requête est filtrée par l'utilisateur connecté**.

**Règle pour les CV :** un CV importé n'est jamais modifié. S'il est supprimé alors qu'une candidature l'utilise, il est seulement masqué. Il n'est effacé qu'avec le compte.

## Sécurité et données personnelles

- Sessions dans un cookie `HttpOnly`, `Secure` et `SameSite=Lax`, et protection CSRF par Better Auth.
- Limitation des demandes de lien de connexion, avec la limitation de débit de Cloudflare. Better Auth ne voit pas l'adresse IP réelle par défaut sur Workers.
- Fichiers acceptés : PDF vérifiés par leur contenu, pas seulement par leur extension, avec 5 Mo maximum.
- En-têtes de sécurité, dont une politique de sécurité du contenu (CSP).
- Suppression du compte : effacement des lignes en base (en cascade) et de tous les fichiers R2 de l'utilisateur.
- Base et fichiers en juridiction UE, et e-mails envoyés par Brevo, une entreprise française.
- Pages de confidentialité et mentions légales, sans aucun traceur. Cloudflare Web Analytics peut être ajouté plus tard, car il ne dépose pas de cookie.

## Coûts

Le coût est de 0 €.

Limites gratuites à surveiller :
- Workers : 100 000 requêtes par jour et 10 ms de calcul par requête.
- D1 : 5 Go.
- R2 : 10 Go.
- Brevo : 300 e-mails par jour.
- Workers AI : 10 000 Neurons par jour.

À vérifier à l'installation : l'activation de R2 peut demander d'ajouter un moyen de paiement, même pour rester dans l'offre gratuite.

## Organisation du dépôt

```
relance/
├── src/
│   ├── client/        # React : pages, composants, PWA
│   ├── server/        # Hono : routes /api, auth, cron, e-mails
│   ├── shared/        # schémas Zod et types communs
│   └── db/            # schéma Drizzle
├── migrations/        # migrations SQL générées
├── tests/             # Vitest et Playwright
├── wrangler.jsonc     # Worker, D1, R2, cron, variables
└── .github/workflows/ # CI et déploiement
```

- Dépôt GitHub `sami-krm/relance`, en local dans `~/Desktop/Portfolio/Relance`.
- Domaine `relance.skrim.dev`, branché sur le Worker.
- Les e-mails partent de `relance@skrim.dev`. Les enregistrements DNS de Brevo (DKIM, SPF) s'ajoutent à skrim.dev, avec un seul enregistrement SPF partagé avec Email Routing.

## Étapes de la V1

1. **Squelette :** projet Vite + React + Hono, D1 et R2 en UE, déploiement sur relance.skrim.dev, CI. Vérifier dès le départ le temps de calcul de chaque requête.
2. **Comptes :** connexion par lien e-mail via Brevo, sessions, déconnexion.
3. **Profil et documents :** profil complet, import et aperçu des PDF, lettres et réponses types.
4. **Entreprises, contacts et offres.**
5. **Candidatures :** création depuis une offre ou spontanée, statuts, historique, étiquettes, vues Kanban et liste.
6. **Rappels :** relance proposée à J+7, rappels, tâche planifiée du matin et e-mails.
7. **Tableau de bord, export CSV, suppression du compte, pages légales et PWA.**
8. **Tests des critères de réussite avec Playwright**, puis bêta avec toi et quelques camarades.
