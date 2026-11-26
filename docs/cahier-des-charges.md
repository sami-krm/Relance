# Relance — cahier des charges fonctionnel (v2)

## Objectif

**Relance** est une application web qui aide les étudiants à suivre leurs candidatures d'alternance et à ne jamais oublier une relance. Elle reste utilisable pour un stage ou un emploi, mais elle est pensée d'abord pour l'alternance.

L'interface est en français, adaptée au mobile et à l'ordinateur, claire et facile à utiliser. Elle peut s'installer sur le téléphone comme une application (PWA).

Le produit est construit en trois versions : **V1** pour le suivi des candidatures, **V1.5** pour la recherche d'offres et **V2** pour la candidature assistée et l'IA. Chaque version doit être utilisable seule avant de passer à la suivante.

## Principes à respecter

- L'utilisateur garde le contrôle de ses candidatures et de ses données.
- **Le CV n'est jamais généré ni modifié par Relance.** L'utilisateur importe son propre fichier, qui est conservé tel quel.
- Relance n'invente jamais d'expérience, de diplôme, de compétence ou de réponse.
- L'IA ne produit que des brouillons de texte, toujours modifiables, à partir des seules informations fournies par l'utilisateur, et seulement s'il l'a autorisé.
- Aucune candidature n'est transmise sans un écran d'aperçu complet suivi d'une confirmation explicite.
- Relance affiche les sources d'offres et les modes d'envoi qu'elle prend réellement en charge. Elle ne prétend pas fonctionner sur un site sans intégration.
- Les intégrations passent uniquement par les API ou méthodes autorisées par chaque service. Pas de contournement de captcha ni des protections d'un site.
- Pas de données de démonstration présentées comme réelles, pas de faux boutons, pas d'intégration fictive. Une fonction qui n'est pas encore disponible est indiquée comme telle.

---

## V1 — Suivi des candidatures

### 1. Compte et profil

- Inscription et connexion par **lien envoyé par e-mail** : l'utilisateur saisit son adresse et clique sur le lien reçu. Aucun mot de passe. Le lien ne sert qu'une fois et expire après 15 minutes.
- Le profil contient :
  - Nom et coordonnées (e-mail, téléphone, ville, lien LinkedIn ou portfolio facultatifs).
  - Formation, école, diplôme préparé et année d'étude.
  - Pour l'alternance : rythme (par exemple 3 semaines en entreprise et 1 semaine à l'école), date de début souhaitée et durée du contrat.
  - Type de recherche : alternance, stage, emploi, job étudiant ou autre.
  - Métiers, secteurs et mots-clés recherchés.
  - Localisation, distance maximale et préférence de télétravail.
  - Rémunération souhaitée (facultatif).
  - Compétences, expériences et projets, en texte simple.
- Le profil est modifiable à tout moment. Pour chaque champ, l'utilisateur choisit s'il peut servir dans ses candidatures.

### 2. CV et documents

- Importer plusieurs CV au format PDF (5 Mo maximum par fichier), les nommer (par exemple « CV alternance développement web »), les prévisualiser et les supprimer.
- Choisir un CV par défaut.
- Écrire et enregistrer des lettres de motivation et des réponses types en texte.
- Relance conserve la version du CV et de la lettre utilisée pour chaque candidature, même si l'utilisateur les modifie ou les supprime ensuite.

### 3. Entreprises et contacts

- Fiche entreprise : nom, ville, site web, secteur et notes.
- Contacts rattachés à une entreprise : nom, rôle, e-mail, téléphone, lien LinkedIn et notes.
- La fiche entreprise affiche toutes les candidatures et tous les contacts liés.

### 4. Offres (saisie manuelle)

- Enregistrer une offre : entreprise, intitulé, lieu, type de contrat, source, lien, date de publication, date limite et description.
- Indiquer la source de chaque offre (site, salon, école, bouche-à-oreille…).
- Marquer une offre comme expirée.

### 5. Candidatures

- Créer une candidature à partir d'une offre, ou **spontanée** à partir d'une entreprise seulement.
- Statuts :
  - Brouillon.
  - Envoyée.
  - Réponse reçue.
  - Entretien.
  - Offre reçue.
  - Refusée.
  - Abandonnée.
- Des étiquettes libres complètent les statuts, par exemple « test technique » ou « accusé de réception ».
- Pour chaque candidature, conserver :
  - L'entreprise, le poste et le contact.
  - Le canal utilisé : site de l'offre, e-mail, LinkedIn, sur place ou salon.
  - La date d'envoi, la source et le lien de l'offre.
  - Le CV et la lettre utilisés.
  - Les notes de l'utilisateur.
  - Les réponses reçues, collées en texte et datées.
  - L'historique daté des changements de statut, enregistré automatiquement.
- En V1, Relance n'envoie rien. L'utilisateur postule lui-même puis marque la candidature comme envoyée.
- Deux vues :
  - Tableau Kanban avec glisser-déposer. Un menu « Changer de statut » est aussi disponible au clavier et au lecteur d'écran.
  - Liste triable et filtrable par statut, entreprise et date.

### 6. Relances et rappels

- Quand une candidature passe à « Envoyée », Relance propose une date de relance 7 jours plus tard. L'utilisateur peut régler ce délai, changer la date ou la retirer.
- Créer des rappels pour une relance, un entretien, une date limite ou une tâche libre.
- Afficher les rappels à venir et en retard sur le tableau de bord.
- Envoyer un e-mail de rappel le jour prévu. L'utilisateur peut désactiver ces e-mails.
- Marquer un rappel comme fait, le reporter (+3 jours, +1 semaine ou une date au choix) ou le supprimer.
- Signaler les candidatures restées sans réponse depuis 3 semaines (délai réglable) et proposer une relance ou l'abandon. L'utilisateur décide.

### 7. Tableau de bord

- Candidatures en cours.
- Candidatures envoyées cette semaine et ce mois-ci.
- Entretiens à venir.
- Relances du jour et en retard.
- Réponses reçues et taux de réponse.
- Répartition par statut.

Les chiffres sont calculés uniquement à partir des candidatures de l'utilisateur. Un nouveau compte voit un écran vide qui explique comment commencer.

### 8. Données et sécurité

- Exporter ses candidatures en CSV.
- Supprimer son compte depuis les paramètres. Les données et les fichiers sont alors effacés définitivement.
- Aucun mot de passe n'est stocké. Les demandes de lien de connexion sont limitées pour éviter les abus.
- Les documents ne sont accessibles qu'à leur propriétaire.
- Les données sont hébergées en Europe quand c'est possible.
- Une politique de confidentialité et des mentions légales sont publiées.
- Aucun traceur publicitaire.
- L'autorisation de l'utilisateur est demandée avant toute connexion à un service externe.

### Écrans de la V1

1. Inscription et connexion.
2. Configuration du profil.
3. Tableau de bord.
4. Candidatures (Kanban et liste).
5. Détail d'une candidature.
6. Entreprises et contacts.
7. Offres.
8. Rappels.
9. Documents.
10. Paramètres (compte, rappels, export, suppression).

### Critères de réussite de la V1

- Un utilisateur peut créer son compte, remplir son profil et importer au moins un CV en PDF.
- Il peut créer une entreprise, un contact et une offre, puis les retrouver.
- Il peut créer une candidature depuis une offre ou en candidature spontanée.
- Une candidature marquée « Envoyée » apparaît dans le suivi avec sa date, son entreprise, son poste, son statut et le CV utilisé.
- Il peut changer un statut, ajouter une réponse reçue et voir l'historique.
- Une relance est proposée après l'envoi et un e-mail de rappel arrive le jour prévu.
- Il peut exporter ses candidatures en CSV et supprimer son compte et toutes ses données.

---

## V1.5 — Recherche d'offres

- Rechercher des offres via les API officielles de **France Travail** et de **La bonne alternance**.
- Filtrer selon les critères du profil : métier, mots-clés, lieu, distance, type de contrat et date de début.
- Enregistrer des recherches et leurs filtres.
- Ajouter une offre trouvée à « Mes offres » en un clic, avec sa source affichée.
- Repérer les doublons (même identifiant à la source, ou même entreprise, même intitulé et même ville).
- Signaler les offres expirées quand la source le permet.
- Afficher la liste des sources réellement prises en charge.
- Ajouter une offre depuis son URL : préremplir les champs si la page fournit des informations lisibles, sinon passer en saisie manuelle.

## V2 — Candidature assistée et IA

### 1. Brouillons de texte par IA

- L'IA peut rédiger les brouillons suivants :
  - Une lettre de motivation.
  - Des réponses aux questions d'un formulaire.
  - Un e-mail de relance.
  - Un e-mail de candidature spontanée.
- **Jamais de CV.**
- Avant la première utilisation, Relance affiche les données envoyées et le service qui les reçoit. L'utilisateur doit donner son accord, qu'il peut retirer dans les paramètres.
- Seuls les champs du profil autorisés et l'offre concernée sont envoyés.
- Le modèle a pour consigne d'utiliser uniquement ces informations. Quand il en manque une, il écrit « [à compléter] » au lieu de deviner.
- Le texte produit est toujours modifiable et marqué « brouillon » tant que l'utilisateur ne l'a pas relu et validé.
- Le service d'IA est une **API gratuite**. Choix retenu : **Cloudflare Workers AI**, qui offre 10 000 « Neurons » par jour, partagés entre tous les utilisateurs.
- Une limite par utilisateur est fixée, par exemple 10 générations par jour.
- Quand le quota est atteint, Relance l'affiche clairement et l'utilisateur écrit son texte lui-même. Aucun passage automatique à un service payant.

### 2. Candidature assistée

- Depuis une offre :
  - Choisir le CV et la lettre.
  - Préparer les réponses.
  - Voir les informations manquantes.
  - Enregistrer en brouillon.
- Modes d'envoi, affichés honnêtement pour chaque offre :
  - **Envoi via l'API La bonne alternance**, pour les offres qui l'acceptent.
  - **E-mail préparé** que l'utilisateur ouvre et envoie depuis sa propre messagerie. Relance n'envoie rien elle-même.
  - **Candidature sur le site de l'offre** : lien et aide guidée, l'utilisateur postule lui-même.
- Écran d'aperçu obligatoire avant tout envoi, qui affiche :
  - L'entreprise et l'intitulé du poste.
  - Le site destinataire et le lien de l'offre.
  - Le CV, la lettre et les autres pièces jointes.
  - Les réponses transmises.
  - Les coordonnées et autres données personnelles partagées.
  - Trois boutons : « Modifier », « Annuler » et « Confirmer l'envoi ».
- Après l'envoi, la candidature passe à « Envoyée » avec sa date, et les documents et réponses transmis sont conservés.

### 3. Correspondance entre le profil et une offre

- Une estimation basée sur des critères compréhensibles :
  - Métier et mots-clés.
  - Compétences.
  - Formation et niveau.
  - Lieu et mode de travail.
  - Type de contrat et dates.
- L'estimation explique ce qui augmente ou diminue la correspondance.
- Elle est présentée comme une aide au tri, jamais comme une garantie.

### 4. Autres ajouts de la V2

- Vue calendrier et export des rappels en .ics.
- Import de CV au format DOCX (le fichier reste celui de l'utilisateur).

## Idées pour plus tard

- Extension de navigateur pour aider à remplir un formulaire sur un site non intégré.
- Récupération facultative des e-mails de réponse. L'utilisateur valide avant que Relance associe un message à une candidature.
- Synchronisation avec un agenda externe, si l'utilisateur l'active.
- Notifications web, réglables.
- Analyse de la recherche : postes, sources et étapes où les candidatures avancent.
- Préparation aux entretiens : questions possibles, notes et informations sur l'entreprise.
- Import de candidatures depuis un fichier CSV ou un autre outil.

## Choix techniques

Voir `architecture-relance.md`.

- **Décidé :**
  - Connexion par lien e-mail.
  - E-mails de connexion et de rappel envoyés par Brevo.
  - Base et fichiers hébergés en UE (Cloudflare D1 et R2).
- **Reste à choisir pour la V2 :** le modèle de Workers AI, qui doit bien écrire en français et consommer peu du quota quotidien.

## Consignes de réalisation

Avant de coder, examiner le projet existant et garder sa structure et ses choix techniques s'ils sont déjà établis. S'il n'y a pas encore de projet, proposer une architecture simple et expliquer les choix avant de commencer.

Construire chaque version par étapes, en vérifiant ses critères de réussite avant de passer à la suivante.
