# Fondation multi-tenant NAFIX — Sprints 0 à 4

**Statut : gelé et validé.** Ce document décrit l'état de l'architecture au moment où elle a été figée, avant le démarrage du Sprint 5 (couche de gestion des organisations). Il sert de point de départ propre et de référence pour tout travail futur sur ce projet — humain ou agent IA.

**Ne pas modifier ce fichier rétroactivement** pour refléter des changements ultérieurs : chaque nouveau sprint doit produire son propre document de suivi (ou une mise à jour explicitement datée), afin que celui-ci reste une photographie fiable de cette fondation.

---

## 1. Contexte et objectif

NAFIX est une application de gestion commerciale (Electron + React + PostgreSQL) pour des commerces sénégalais (quincaillerie, alimentaire, restauration, BTP, textile, informatique). Le projet possédait une base métier mono-poste/mono-organisation fonctionnelle. À partir d'un plan d'architecture validé ("Nafix Platform"), le projet évolue **progressivement et sans réécriture** vers une architecture multi-tenant compatible avec une future offre SaaS.

**Règle absolue respectée à chaque sprint** : aucune réécriture globale, aucune modification massive, migrations additives et réversibles, classification systématique de chaque changement (RÉUTILISER / REFACTORISER / AJOUTER / REMPLACER — le remplacement restant exceptionnel), présentation du plan avant toute modification, tests avant de passer à l'étape suivante.

## 2. Architecture générale (inchangée dans ses grandes lignes)

```
Renderer (React, src/) → preload.js (whitelist IPC) → main.js (ipcMain.handle)
                                                             ↓
                                              core/services/*.js (Service Layer)
                                                             ↓
                                                  dao/*.js (accès PostgreSQL)
```

- **Frontière stricte CommonJS / ES Modules** : `main.js`, `dao/`, `core/`, `server/`, `config/`, `auth/`, `db/` sont en CommonJS (`require`/`module.exports`). `src/` (React) est en ES Modules (`import`/`export`, transpilé par webpack). Aucun fichier ES Module n'est `require()`-able directement depuis `main.js`.
- **Aucune logique métier dans le renderer** : chaque écran appelle un canal IPC whitelisté dans `preload.js` (`INVOKE_CHANNELS`/`EVENT_CHANNELS`), jamais d'accès direct à la base.
- **Un seul processus principal, une seule fenêtre** : pas de multi-fenêtre, pas de session multi-utilisateur concurrente au sein d'un même processus Electron.

## 3. Modèle multi-tenant

### 3.1 Table `organisations` (créée au Sprint 1)

```sql
CREATE TABLE organisations (
  id          SERIAL PRIMARY KEY,
  nom         TEXT NOT NULL,
  code        TEXT UNIQUE,       -- slug stable, ex. 'legacy'
  statut      TEXT DEFAULT 'active',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

Volontairement minimale : pas de champs billing/plan/quota. Une organisation **`legacy`** est créée/retrouvée automatiquement à la première migration, et reprend le nom de `parametres.nom_entreprise` si disponible. Toute installation Desktop existante s'y retrouve rattachée intégralement — comportement inchangé pour l'utilisateur final.

### 3.2 Tables rattachées à une organisation (`organisation_id`, FK nullable)

Colonne ajoutée, dans cet ordre, une table/module à la fois, à chaque sprint :

| Sprint | Tables |
|---|---|
| 1 | `produits` |
| 2 | `clients`, `ventes`, `devis` |
| 3 | `achats`, `fournisseurs`, `tresorerie`, `clotures_journalieres`, `retours`, `commandes_clients`, `avoirs_clients`, `transactions_avoir` |
| 4 | `utilisateurs` |

**Non rattachées à ce jour** (hors périmètre, à traiter sprint par sprint dans le futur) : `parametres`, `domaine` (singletons de configuration — un jour scopés par organisation), `factures`/`lignes_facture` (tables **mortes** : jamais peuplées ni lues en dehors de `db:reinitialiser` — un ancien modèle de facturation superseded par `ventes`, il ne s'agit pas d'un module à migrer mais de code mort).

`organisation_id` reste **nullable** partout, volontairement — jamais de `NOT NULL` posé. Chaque colonne est individuellement réversible par un simple `DROP COLUMN`.

### 3.3 Deux corrections de contraintes UNIQUE globales → composites

Découvertes en testant l'isolation réelle, corrigées dans `db/migrate.js` :
- `produits.reference` (Sprint 1) : `UNIQUE` global → `idx_produits_org_reference` sur `(organisation_id, reference)`.
- `clotures_journalieres.date_cloture` (Sprint 3) : `UNIQUE` global → `idx_clotures_org_date` sur `(organisation_id, date_cloture)`.

`utilisateurs.username` reste **volontairement unique globalement** (Sprint 4) — c'est la clé de connexion, l'organisation n'étant pas encore connue au moment du login.

## 4. Pattern architectural (identique pour chaque module migré)

Pour chaque module métier, dans cet ordre :
1. **Migration** (`db/migrate.js`) : `ALTER TABLE ... ADD COLUMN IF NOT EXISTS organisation_id ...` + backfill `UPDATE ... WHERE organisation_id IS NULL` vers `legacy`. Idempotent, rejouable à chaque démarrage.
2. **DAO** (`dao/*.js`) : chaque méthode reçoit `organisationId` en paramètre explicite, filtre chaque `SELECT`/`UPDATE`/`DELETE` par `organisation_id = $N`, inclut `organisation_id` dans chaque `INSERT`.
3. **Service** (`core/services/*.js`) : relais pur vers le DAO, **aucune logique propre**, `organisationId` toujours reçu explicitement — jamais lu d'un état global caché.
4. **Handler IPC** (`main.js`) : résout `organisationId` via `getOrganisationIdActive()` et le transmet au service.

14 fichiers service existent à ce jour : `produitsService`, `clientsService`, `ventesService`, `devisService`, `achatsService`, `fournisseursService`, `tresorerieService`, `retoursService`, `commandesService`, `avoirsService`, `dashboardService`, `statistiquesService`, `organisationsService`, `permissionsService`.

## 5. Authentification, session, résolution de l'organisation (Sprint 0 → Sprint 4)

- `main.js` conserve une unique variable de module `utilisateurConnecte`, positionnée par `auth:login`, vidée par `auth:logout` — c'est la seule notion de session, volontaire et documentée dès le Sprint 0 (pas de variable globale cachée additionnelle).
- `auth:login` : `UtilisateursDAO.findByUsername(username)` (recherche **globale**, volontaire — voir §3.3) → `AuthService.verifyPassword` → `utilisateurConnecte = { ...ligne DB sans le mot de passe }`. Cette ligne inclut désormais `organisation_id` automatiquement (`SELECT *`), sans qu'aucun code n'ait eu besoin de changer au Sprint 4.
- **`getOrganisationIdActive()`** (dans `main.js`, ~65 points d'appel, tous à l'intérieur de callbacks `ipcMain.handle`) : **corrigée au Sprint 4**. Lisait auparavant "la première organisation active trouvée en base" (`organisationsService.getOrganisationActive()`) — correct tant qu'une seule organisation existait, mais un vrai risque de fuite dès qu'une base en contiendrait plusieurs. Lit désormais `utilisateurConnecte.organisation_id`, lève une erreur explicite si aucune session ou si le compte n'a pas d'organisation. Correction centralisée dans le corps d'une seule fonction — aucun des points d'appel n'a été modifié.
- `core/services/organisationsService.js` (`getOrganisationActive()`) reste disponible mais n'est plus dans le chemin de résolution de session — conservé pour un futur assistant de configuration.

## 6. RBAC (Sprint 0, inchangé depuis)

`core/services/permissionsService.js` — `verifierPermission(canal, utilisateurConnecte)`, table `CANAUX_RESTREINTS` codée en dur, 8 canaux protégés (`db:reinitialiser`, les 5 `utilisateurs:*` de gestion, `parametres:save`, `parametres:exporterSauvegarde`). Vérifie uniquement `role`, **complètement indépendant** du multi-tenant — les deux contrôles restent distincts et se cumulent :

```
Authentification → Identité utilisateur → Organisation (isolation des données)
                                        → RBAC (permission d'agir)
```

**Gap connu, non corrigé (hors périmètre à chaque fois)** : `utilisateurs:getAll` n'a jamais été soumis à `verifierPermission` — n'importe quel rôle authentifié peut lister les comptes de sa propre organisation. Existait déjà avant le multi-tenant, non aggravé par lui.

## 7. Méthodologie de test

**Aucun framework de test formel** n'est installé (pas de Jest/Mocha côté Node — `react-scripts test` cible uniquement les composants React en jsdom, inadapté aux DAO Postgres). Chaque sprint a été validé par des **scripts Node ad-hoc**, exécutés via `electron script.js` (nécessaire pour charger l'API `app` d'Electron, notamment `app.isPackaged` requis par `config/paths.js`), directement contre la vraie base PostgreSQL de développement, avec nettoyage systématique des données de test.

Schéma type d'un scénario d'isolation : créer une organisation « B » de test, exécuter les opérations CRUD via les services avec l'organisation « legacy » puis avec « B », vérifier qu'aucune fuite de lecture/écriture/suppression ne traverse la frontière, dans les deux sens.

**Total cumulé** : 142 assertions automatisées réussies à la fin du Sprint 4 (détail par sprint dans l'historique de conversation), rejouées intégralement à chaque nouveau sprint pour la non-régression.

**Limite assumée** : les handlers `ipcMain.handle(...)` ne sont pas invocables directement hors d'un vrai aller-retour IPC depuis un renderer, et aucune fenêtre Electron réelle n'a pu être pilotée dans l'environnement d'exécution utilisé (absence d'affichage). Les tests reproduisent donc fidèlement la logique de session/RBAC (quelques lignes, citées et vérifiées) plutôt que de l'exécuter via un vrai renderer.

## 8. Bugs découverts et corrigés en cours de route

| Sprint | Bug | Correction |
|---|---|---|
| 1 | `produits.reference UNIQUE` global bloquait deux organisations sur la même référence | Index composite `(organisation_id, reference)` |
| 2 | `DevisDAO.convertir` ne vérifiait pas l'existence du devis avant conversion — une organisation B aurait pu convertir un devis de A | Vérification d'existence scopée ajoutée |
| 3 | `clotures_journalieres.date_cloture UNIQUE` global — même famille que le bug Sprint 1 | Index composite `(organisation_id, date_cloture)` |

Aucun bug trouvé au Sprint 4 (26/26 tests réussis dès la première exécution).

## 9. Risques résiduels connus

- Historique Git : **inexistant avant ce commit**. Tout rollback antérieur à ce point reste manuel (colonnes additives, réversibles individuellement par `DROP COLUMN`).
- `utilisateurs:getAll` sans vérification RBAC (§6).
- `parametres`/`domaine` (config d'organisation) et les tables `factures`/`lignes_facture` (mortes) non traitées.
- Path absolu codé en dur dans les scripts `package.json` (`C:\Users\HP\Desktop\Nafix5\Nafix`) — projet non portable sans édition manuelle si déplacé.
- 235 Mo de binaires vendorisés (`resources/postgres`, `resources/vcredist`, `resources/vosk`) volontairement exclus de Git — à reprovisionner séparément sur un nouveau poste (mécanisme de provisioning existant : `server/pgManager.js`).

## 10. Périmètre recommandé pour le Sprint 5

D'après l'échange qui a précédé le gel de cette fondation : **couche de gestion des organisations**, à savoir concrètement :
- Créer une organisation (au-delà du bootstrap automatique de `legacy`).
- Gérer les utilisateurs d'une organisation (déjà scopé côté DAO depuis le Sprint 4 — reste l'exposition IPC/UI).
- Permettre à un administrateur d'administrer *sa* organisation.
- Préparer (sans l'implémenter) l'évolution vers une gestion SaaS complète.

**Explicitement hors périmètre** (à ne pas anticiper) : API SaaS publique, billing, quotas, synchronisation cloud, multi-organisation par utilisateur, invitations complexes.

---

*Document généré à la clôture du Sprint 4, avant le premier commit Git du projet.*
