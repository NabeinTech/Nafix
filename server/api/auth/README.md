# auth/ (server/api/auth — à ne pas confondre avec auth/AuthService.js à la racine)

Prévu (Sprint 14) :

- Émission d'un **access token** JWT courte durée (~15 min), jamais persisté
  sur disque côté client — gardé en mémoire uniquement.
- Émission d'un **refresh token** opaque, stocké hashé côté serveur,
  révocable, avec rotation à chaque utilisation — côté Electron, persisté via
  `safeStorage` (chiffrement OS), jamais en clair.
- Réutilise `auth/AuthService.js` (racine du projet) tel quel pour la
  vérification du mot de passe (bcrypt) — aucune duplication de cette
  logique.
- Type de token distinct et non interchangeable pour un futur Platform Admin
  (cf. audit Sprint 13 §G) — jamais émis ni accepté par le même chemin que
  les tokens utilisateur d'organisation.

Vide pour l'instant — aucun code avant le Sprint 14.
