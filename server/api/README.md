# server/api/ — fondation de l'API SaaS (Sprint 13)

Squelette de structure uniquement — **aucune route fonctionnelle, aucun serveur
HTTP démarré ici**. Ce dossier n'est chargé par rien tant que le Sprint 15
(premier module pilote) n'y ajoute pas de code réel.

## Pourquoi ce dossier existe déjà, avant tout code

Fixer la structure avant d'écrire la première route évite de la refaire
pendant que le pattern IPC → API se répète module par module (Sprints 15-16).

## Sous-dossiers

- `routes/` — une route HTTP par domaine métier, en réutilisant directement
  `core/services/*` (inchangés) — voir `routes/README.md`.
- `middleware/` — authentification (vérification du token), résolution du
  tenant context (`organisationId` dérivé du token, jamais du client), RBAC —
  voir `middleware/README.md`.
- `auth/` — émission/vérification des tokens (JWT access + refresh), séparé
  de `auth/AuthService.js` (racine du projet, hachage de mot de passe,
  réutilisé tel quel) — voir `auth/README.md`.

## Ce que ce dossier NE remplace PAS

`main.js` et ses 100 handlers IPC restent la seule voie d'accès pour le
client Desktop existant jusqu'à ce que chaque module soit migré et validé
individuellement (Sprint 16). Les deux chemins (IPC et API) coexistent
pendant toute la transition, sans duplication du code métier : ils
appelleront les mêmes fichiers `core/services/*` et `dao/*`, inchangés.

## Dépendance technique posée par ce sprint

`db/pool.js` résout désormais sa configuration soit via `config/paths.js`
(contexte Electron, comportement Desktop inchangé), soit via les variables
d'environnement documentées dans `.env.example` (contexte API, hors
Electron). C'est la seule adaptation apportée à la couche métier existante —
aucun DAO ni service n'a été modifié.
