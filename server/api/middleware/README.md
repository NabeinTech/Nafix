# middleware/

**`tenantContext.js` implémenté (Sprint 14)** — `extraireTenantContext(payload)`.
Pas encore branché comme middleware Express (Sprint 15) : fonction pure
appelable indépendamment.

Contenu :

- **Authentification** : vérifie la signature et l'expiration de l'access
  token (JWT), rejette sinon.
- **Résolution du tenant context** : dérive `organisationId` depuis
  `userId` (extrait du token) en interrogeant la base — jamais depuis le
  corps, les query params ou un header fourni par le client. Reproduit
  exactement la garantie déjà en place côté Desktop avec
  `getOrganisationIdActive()` (main.js), sur une source différente (token
  vérifié au lieu de variable mémoire du process).
- **Vérification active** : utilisateur et organisation doivent être actifs
  au moment de la requête — pas seulement au moment de l'émission du token.
- **RBAC** : équivalent de `verifierPermission()` (core/services/permissionsService.js),
  réutilisable tel quel côté logique, adapté uniquement dans son point
  d'appel (middleware Express/route plutôt qu'en tête de handler IPC).

Vide pour l'instant — aucun code avant le Sprint 14.
