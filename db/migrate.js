const fs = require('fs')
const path = require('path')
const pool = require('./pool')
const AuthService = require('../auth/AuthService')
const { getCategoriesByDomaine } = require('../dao/DomaineDAO')

async function attendrePostgres(maxTentatives = 8, delai = 3000) {
  for (let i = 1; i <= maxTentatives; i++) {
    try {
      const client = await pool.connect()
      client.release()
      return
    } catch (err) {
      if (i === maxTentatives) throw err
      console.log(`⏳ PostgreSQL pas encore prêt (tentative ${i}/${maxTentatives}), nouvelle tentative dans ${delai / 1000}s...`)
      await new Promise(r => setTimeout(r, delai))
    }
  }
}

async function runMigrations() {
  await attendrePostgres()
  const client = await pool.connect()
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
    await client.query(schema)
    console.log('✅ Schéma PostgreSQL appliqué')

    // Colonne vendeur sur ventes (ajout idempotent)
    await client.query('ALTER TABLE ventes ADD COLUMN IF NOT EXISTS vendeur TEXT')

    // Montant remis par le client (pour calculer la monnaie à rendre)
    await client.query('ALTER TABLE ventes ADD COLUMN IF NOT EXISTS montant_recu REAL DEFAULT 0')

    // Colonnes activités entreprise (ajout idempotent)
    await client.query('ALTER TABLE parametres ADD COLUMN IF NOT EXISTS activites TEXT')
    await client.query('ALTER TABLE parametres ADD COLUMN IF NOT EXISTS sous_activites TEXT')

    // Colonne sous_categorie (ajout idempotent pour bases existantes)
    await client.query('ALTER TABLE produits ADD COLUMN IF NOT EXISTS sous_categorie TEXT')

    // Colonne notes sur ventes (table/commande/chantier selon domaine)
    await client.query('ALTER TABLE ventes ADD COLUMN IF NOT EXISTS notes TEXT')

    // Colonne attributs sur produits (champs spécifiques au domaine)
    await client.query('ALTER TABLE produits ADD COLUMN IF NOT EXISTS attributs TEXT')

    // Couleur du thème (personnalisation de l'interface)
    await client.query('ALTER TABLE parametres ADD COLUMN IF NOT EXISTS couleur_theme TEXT')

    // Format de facture choisi par l'utilisateur (A4, A5, ticket) — 'auto'
    // conserve le comportement historique (format déduit du domaine d'activité).
    await client.query("ALTER TABLE parametres ADD COLUMN IF NOT EXISTS format_facture TEXT DEFAULT 'auto'")

    // Commandes intelligentes — cycle de vie des achats
    await client.query("ALTER TABLE achats ADD COLUMN IF NOT EXISTS etape TEXT DEFAULT 'brouillon'")
    await client.query("ALTER TABLE achats ADD COLUMN IF NOT EXISTS priorite TEXT DEFAULT 'normale'")
    await client.query('ALTER TABLE achats ADD COLUMN IF NOT EXISTS date_livraison_prevue DATE')
    await client.query('ALTER TABLE achats ADD COLUMN IF NOT EXISTS date_livraison_reelle DATE')

    // Commandes clients — mode de paiement + lien vers la vente générée
    await client.query("ALTER TABLE commandes_clients ADD COLUMN IF NOT EXISTS mode_paiement TEXT DEFAULT 'especes'")
    await client.query('ALTER TABLE commandes_clients ADD COLUMN IF NOT EXISTS vente_id INTEGER REFERENCES ventes(id) ON DELETE SET NULL')

    // Permissions personnalisées par utilisateur
    await client.query('ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS permissions_custom JSONB DEFAULT NULL')

    // Fournisseurs enrichis — informations commerciales
    await client.query("ALTER TABLE fournisseurs ADD COLUMN IF NOT EXISTS conditions_paiement TEXT DEFAULT 'Comptant'")
    await client.query('ALTER TABLE fournisseurs ADD COLUMN IF NOT EXISTS delai_livraison_jours INTEGER DEFAULT 7')
    await client.query('ALTER TABLE fournisseurs ADD COLUMN IF NOT EXISTS ninea TEXT')
    await client.query('ALTER TABLE fournisseurs ADD COLUMN IF NOT EXISTS registre_commerce TEXT')
    await client.query('ALTER TABLE fournisseurs ADD COLUMN IF NOT EXISTS site_web TEXT')

    // Achats — priorité et livraison (colonne etape déjà existante)
    await client.query("ALTER TABLE achats ADD COLUMN IF NOT EXISTS priorite TEXT DEFAULT 'normale'")

    // ── Comptes prépayés clients ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS avoirs_clients (
        id               SERIAL PRIMARY KEY,
        client_id        INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        reference        TEXT UNIQUE,
        montant_initial  REAL NOT NULL DEFAULT 0,
        solde_restant    REAL NOT NULL DEFAULT 0,
        description      TEXT,
        seuil_alerte     REAL DEFAULT 0,
        actif            INTEGER DEFAULT 1,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions_avoir (
        id          SERIAL PRIMARY KEY,
        avoir_id    INTEGER REFERENCES avoirs_clients(id) ON DELETE CASCADE,
        client_id   INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        type        TEXT DEFAULT 'achat',
        montant     REAL NOT NULL DEFAULT 0,
        libelle     TEXT,
        panier      TEXT DEFAULT '[]',
        vente_id    INTEGER REFERENCES ventes(id) ON DELETE SET NULL,
        solde_avant REAL NOT NULL DEFAULT 0,
        solde_apres REAL NOT NULL DEFAULT 0,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query('CREATE INDEX IF NOT EXISTS idx_avoirs_client_id ON avoirs_clients(client_id)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_tx_avoir_avoir_id ON transactions_avoir(avoir_id)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_tx_avoir_client_id ON transactions_avoir(client_id)')

    // Quantités décimales — migration des colonnes INTEGER vers NUMERIC(10,3)
    await client.query('ALTER TABLE produits ALTER COLUMN stock_actuel TYPE NUMERIC(10,3) USING stock_actuel::NUMERIC')
    await client.query('ALTER TABLE produits ALTER COLUMN stock_minimum TYPE NUMERIC(10,3) USING stock_minimum::NUMERIC')
    await client.query('ALTER TABLE lignes_facture ALTER COLUMN quantite TYPE NUMERIC(10,3) USING quantite::NUMERIC')

    // Montant retourné sur vente (pour CA net)
    await client.query('ALTER TABLE ventes ADD COLUMN IF NOT EXISTS montant_retourne REAL DEFAULT 0')

    // Workflow approbation retours
    await client.query("ALTER TABLE retours ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'en_attente'")
    await client.query('ALTER TABLE retours ADD COLUMN IF NOT EXISTS approuve_par TEXT')
    await client.query('ALTER TABLE retours ADD COLUMN IF NOT EXISTS approuve_le TIMESTAMP')

    // ── Clôtures journalières (fermeture du comptoir) ──────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS clotures_journalieres (
        id            SERIAL PRIMARY KEY,
        date_cloture  DATE UNIQUE NOT NULL,
        ca_jour       REAL DEFAULT 0,
        nb_ventes     INTEGER DEFAULT 0,
        total_entrees REAL DEFAULT 0,
        total_sorties REAL DEFAULT 0,
        solde_debut   REAL DEFAULT 0,
        solde_fin     REAL DEFAULT 0,
        notes         TEXT,
        cloturee_par  TEXT,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query('ALTER TABLE tresorerie ADD COLUMN IF NOT EXISTS cloturee INTEGER DEFAULT 0')
    await client.query('ALTER TABLE tresorerie ADD COLUMN IF NOT EXISTS cloture_id INTEGER REFERENCES clotures_journalieres(id) ON DELETE SET NULL')

    // Conditionnement produits (ex: sac de 25 kg, bouteille de 1.5 L)
    await client.query('ALTER TABLE produits ADD COLUMN IF NOT EXISTS conditionnement NUMERIC(10,3)')
    await client.query('ALTER TABLE produits ADD COLUMN IF NOT EXISTS unite_conditionnement TEXT')

    // Double unité : achat en gros (tonne, carton…) → vente au détail (sac, pièce…)
    await client.query('ALTER TABLE produits ADD COLUMN IF NOT EXISTS unite_achat TEXT')
    await client.query('ALTER TABLE produits ADD COLUMN IF NOT EXISTS facteur_conversion NUMERIC(10,4)')

    // Multi-niveaux : hiérarchie complète sachet → sac → tonne (JSON)
    await client.query('ALTER TABLE produits ADD COLUMN IF NOT EXISTS unites_multiples TEXT')

    // Catégories rattachées à un domaine — pour ne montrer, lors du choix
    // d'une catégorie, que celles du domaine d'activité actif (les autres
    // domaines restent masqués/ignorés).
    await client.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS domaine TEXT')
    const { rows: catsNonTaguees } = await client.query('SELECT id, nom FROM categories WHERE domaine IS NULL')
    if (catsNonTaguees.length) {
      const { rows: domRows } = await client.query('SELECT type FROM domaine WHERE id = 1')
      const domaineParDefaut = domRows[0]?.type || 'general'
      for (const cat of catsNonTaguees) {
        let domaineTrouve = domaineParDefaut
        for (const dom of ['informatique', 'alimentaire', 'quincaillerie', 'textile', 'chaussures', 'cosmetique', 'restauration', 'btp', 'general']) {
          if (getCategoriesByDomaine(dom).some(c => c.nom === cat.nom)) { domaineTrouve = dom; break }
        }
        await client.query('UPDATE categories SET domaine = $1 WHERE id = $2', [domaineTrouve, cat.id])
      }
    }
    await client.query("ALTER TABLE categories ALTER COLUMN domaine SET DEFAULT 'general'")

    // Domaine par défaut
    const dom = await client.query('SELECT id FROM domaine WHERE id = 1')
    if (!dom.rows.length) {
      await client.query(
        "INSERT INTO domaine (id, type, nom) VALUES (1, 'informatique', 'Informatique & Électroménager')"
      )
    }

    // Administrateur par défaut avec mot de passe hashé — uniquement pour le
    // bootstrap Desktop (première installation : aucun autre moyen de se
    // connecter). Audit de clôture — les migrations tournent désormais aussi
    // au démarrage du process API (server/api/server.js) ; sur une base
    // cloud neuve provisionnée pour le SaaS, créer un compte à mot de passe
    // fixe joignable sur Internet serait dangereux. On ne le crée donc que
    // sous Electron (même convention que db/pool.js).
    if (process.versions.electron) {
      const admin = await client.query("SELECT id FROM utilisateurs WHERE username = 'admin'")
      if (!admin.rows.length) {
        const hashedPwd = await AuthService.hashPassword('admin123')
        await client.query(
          'INSERT INTO utilisateurs (nom, username, password, role) VALUES ($1, $2, $3, $4)',
          ['Administrateur', 'admin', hashedPwd, 'administrateur']
        )
        console.log('✅ Utilisateur admin créé (admin / admin123)')
      }
    }

    // ── Sprint 1 — Fondation multi-tenant (Organisations + Produits) ──────
    // Additif et réversible : organisation_id reste nullable, aucune table
    // existante n'est renommée ni retirée. Une installation Desktop actuelle
    // n'a qu'une seule organisation, "legacy", à laquelle tout l'existant
    // est rattaché.
    await client.query(`
      CREATE TABLE IF NOT EXISTS organisations (
        id          SERIAL PRIMARY KEY,
        nom         TEXT NOT NULL,
        code        TEXT UNIQUE,
        statut      TEXT DEFAULT 'active',
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    const orgLegacy = await client.query("SELECT id FROM organisations WHERE code = 'legacy'")
    let idOrganisationLegacy
    if (orgLegacy.rows.length) {
      idOrganisationLegacy = orgLegacy.rows[0].id
    } else if (process.versions.electron) {
      // Même raison que l'admin par défaut ci-dessus : le bootstrap "legacy"
      // répond à un besoin Desktop (rattacher les données existantes d'une
      // première installation), pas à un besoin SaaS — une base API neuve
      // n'a par définition aucune donnée préexistante à rattacher.
      const { rows: paramRows } = await client.query('SELECT nom_entreprise FROM parametres WHERE id = 1')
      const nomLegacy = paramRows[0]?.nom_entreprise || 'Organisation principale'
      const { rows: insereRows } = await client.query(
        "INSERT INTO organisations (nom, code, statut) VALUES ($1, 'legacy', 'active') RETURNING id",
        [nomLegacy]
      )
      idOrganisationLegacy = insereRows[0].id
      console.log(`✅ Organisation "legacy" créée (id ${idOrganisationLegacy})`)
    }

    await client.query('ALTER TABLE produits ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id)')
    await client.query('UPDATE produits SET organisation_id = $1 WHERE organisation_id IS NULL', [idOrganisationLegacy])

    // La référence produit était unique globalement (une seule organisation
    // existait) — désormais scopée par organisation : deux organisations
    // peuvent chacune avoir leur propre "RIZ-001" sans collision, mais un
    // doublon réel au sein d'une même organisation reste refusé.
    await client.query('ALTER TABLE produits DROP CONSTRAINT IF EXISTS produits_reference_key')
    await client.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_produits_org_reference ON produits(organisation_id, reference) WHERE reference IS NOT NULL'
    )

    // ── Sprint 2, module Clients — rattachement à une organisation ────────
    await client.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id)')
    await client.query('UPDATE clients SET organisation_id = $1 WHERE organisation_id IS NULL', [idOrganisationLegacy])

    // ── Sprint 2, module Ventes (couvre l'alias Factures) ─────────────────
    await client.query('ALTER TABLE ventes ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id)')
    await client.query('UPDATE ventes SET organisation_id = $1 WHERE organisation_id IS NULL', [idOrganisationLegacy])

    // ── Sprint 2, module Devis ─────────────────────────────────────────────
    await client.query('ALTER TABLE devis ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id)')
    await client.query('UPDATE devis SET organisation_id = $1 WHERE organisation_id IS NULL', [idOrganisationLegacy])

    // ── Sprint 3, module Achats ──────────────────────────────────────────
    await client.query('ALTER TABLE achats ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id)')
    await client.query('UPDATE achats SET organisation_id = $1 WHERE organisation_id IS NULL', [idOrganisationLegacy])

    // ── Sprint 3, module Fournisseurs ────────────────────────────────────
    await client.query('ALTER TABLE fournisseurs ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id)')
    await client.query('UPDATE fournisseurs SET organisation_id = $1 WHERE organisation_id IS NULL', [idOrganisationLegacy])

    // ── Sprint 3, module Trésorerie (+ clôtures journalières) ─────────────
    await client.query('ALTER TABLE tresorerie ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id)')
    await client.query('UPDATE tresorerie SET organisation_id = $1 WHERE organisation_id IS NULL', [idOrganisationLegacy])
    await client.query('ALTER TABLE clotures_journalieres ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id)')
    await client.query('UPDATE clotures_journalieres SET organisation_id = $1 WHERE organisation_id IS NULL', [idOrganisationLegacy])
    // date_cloture était unique globalement (une seule organisation existait) —
    // désormais scopée par organisation, même correction que produits.reference (Sprint 1).
    await client.query('ALTER TABLE clotures_journalieres DROP CONSTRAINT IF EXISTS clotures_journalieres_date_cloture_key')
    await client.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_clotures_org_date ON clotures_journalieres(organisation_id, date_cloture)'
    )

    // ── Sprint 3, module Retours ────────────────────────────────────────
    await client.query('ALTER TABLE retours ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id)')
    await client.query('UPDATE retours SET organisation_id = $1 WHERE organisation_id IS NULL', [idOrganisationLegacy])

    // ── Sprint 3, module Commandes clients ──────────────────────────────
    await client.query('ALTER TABLE commandes_clients ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id)')
    await client.query('UPDATE commandes_clients SET organisation_id = $1 WHERE organisation_id IS NULL', [idOrganisationLegacy])

    // ── Sprint 3, module Avoirs (comptes prépayés + transactions) ────────
    await client.query('ALTER TABLE avoirs_clients ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id)')
    await client.query('UPDATE avoirs_clients SET organisation_id = $1 WHERE organisation_id IS NULL', [idOrganisationLegacy])
    await client.query('ALTER TABLE transactions_avoir ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id)')
    await client.query('UPDATE transactions_avoir SET organisation_id = $1 WHERE organisation_id IS NULL', [idOrganisationLegacy])

    // ── Sprint 4, module Utilisateurs — rattachement à une organisation ───
    // username reste unique globalement (c'est la clé de connexion, avant
    // même de savoir à quelle organisation l'utilisateur appartient).
    await client.query('ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id)')
    await client.query('UPDATE utilisateurs SET organisation_id = $1 WHERE organisation_id IS NULL', [idOrganisationLegacy])

    // ── Sprint 6, Partie B — Paramètres et Domaine rattachés à une organisation ──
    // "id" était un littéral (DEFAULT 1, pas une séquence) : une seule ligne a
    // jamais existé. Le convertir en auto-incrémenté permet désormais une ligne
    // par organisation, sans toucher à la ligne existante (id=1 reste id=1).
    await client.query('CREATE SEQUENCE IF NOT EXISTS parametres_id_seq OWNED BY parametres.id')
    await client.query("SELECT setval('parametres_id_seq', GREATEST((SELECT COALESCE(MAX(id),0) FROM parametres), 1))")
    await client.query("ALTER TABLE parametres ALTER COLUMN id SET DEFAULT nextval('parametres_id_seq')")
    await client.query('ALTER TABLE parametres ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id)')
    await client.query('UPDATE parametres SET organisation_id = $1 WHERE organisation_id IS NULL', [idOrganisationLegacy])
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_parametres_organisation_id ON parametres(organisation_id)')

    await client.query('CREATE SEQUENCE IF NOT EXISTS domaine_id_seq OWNED BY domaine.id')
    await client.query("SELECT setval('domaine_id_seq', GREATEST((SELECT COALESCE(MAX(id),0) FROM domaine), 1))")
    await client.query("ALTER TABLE domaine ALTER COLUMN id SET DEFAULT nextval('domaine_id_seq')")
    await client.query('ALTER TABLE domaine ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id)')
    await client.query('UPDATE domaine SET organisation_id = $1 WHERE organisation_id IS NULL', [idOrganisationLegacy])
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_domaine_organisation_id ON domaine(organisation_id)')

    // ── Sprint 7, Chantier 1 — Catégories et sous-catégories ──────────────
    // categories.id/sous_categories.id sont déjà des SERIAL — pas de
    // conversion de séquence nécessaire ici (contrairement à parametres/domaine).
    await client.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id)')
    await client.query('UPDATE categories SET organisation_id = $1 WHERE organisation_id IS NULL', [idOrganisationLegacy])
    await client.query('ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_nom_key')
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_org_nom ON categories(organisation_id, nom)')

    await client.query('ALTER TABLE sous_categories ADD COLUMN IF NOT EXISTS organisation_id INTEGER REFERENCES organisations(id)')
    await client.query('UPDATE sous_categories SET organisation_id = $1 WHERE organisation_id IS NULL', [idOrganisationLegacy])

    // ── Sprint 9 — commandes_clients.numero était unique globalement alors que
    // sa génération (CommandesDAO.create) est déjà scopée par organisation —
    // deux organisations créant chacune leur première commande de l'année
    // généraient le même numéro et entraient en collision. Même correctif que
    // produits.reference (Sprint 1), clotures_journalieres.date_cloture
    // (Sprint 3) et categories.nom (Sprint 7).
    await client.query('ALTER TABLE commandes_clients DROP CONSTRAINT IF EXISTS commandes_clients_numero_key')
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_commandes_org_numero ON commandes_clients(organisation_id, numero)')

    // ── Sprint 14 — refresh tokens de la future API SaaS (fondation ajoutée
    // en Sprint 13). Pas de organisation_id ici : un refresh token est
    // toujours scopé par utilisateur_id, dont l'organisation se dérive déjà
    // (utilisateurs.organisation_id) — dupliquer la valeur créerait une
    // source de vérité redondante, potentiellement incohérente. token_hash
    // stocke un hash SHA-256 du token opaque (haute entropie générée
    // aléatoirement, pas un secret choisi par un humain — bcrypt, prévu pour
    // les mots de passe, serait un coût inutile ici). remplace_par trace la
    // chaîne de rotation : un refresh token déjà consommé puis représenté
    // est un signal de vol détectable (rejeté, cf. tokenService.js).
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id              SERIAL PRIMARY KEY,
        utilisateur_id  INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
        token_hash      TEXT NOT NULL UNIQUE,
        cree_le         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expire_le       TIMESTAMP NOT NULL,
        revoque         INTEGER DEFAULT 0,
        remplace_par    INTEGER REFERENCES refresh_tokens(id) ON DELETE SET NULL
      )
    `)
    await client.query('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_utilisateur ON refresh_tokens(utilisateur_id)')

    // ── Sprint 18 — abonnements & billing. Catalogue de plans global (comme
    // organisations.code, ce n'est pas une donnée d'organisation : c'est le
    // référentiel commercial partagé). Aucun prestataire de paiement réel
    // intégré ici (aucun compte/clé API disponible) — le modèle est conçu
    // pour qu'un vrai prestataire s'y branche plus tard sans migration de
    // schéma supplémentaire (statut, dates, quotas déjà en place).
    await client.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id                SERIAL PRIMARY KEY,
        code              TEXT UNIQUE NOT NULL,
        nom               TEXT NOT NULL,
        prix_mensuel      REAL NOT NULL DEFAULT 0,
        max_utilisateurs  INTEGER,
        actif             INTEGER DEFAULT 1,
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query(`
      INSERT INTO plans (code, nom, prix_mensuel, max_utilisateurs)
      SELECT 'essai_gratuit', 'Essai gratuit', 0, 3
      WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code = 'essai_gratuit')
    `)
    await client.query(`
      INSERT INTO plans (code, nom, prix_mensuel, max_utilisateurs)
      SELECT 'standard', 'Standard', 15000, 10
      WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code = 'standard')
    `)
    await client.query(`
      INSERT INTO plans (code, nom, prix_mensuel, max_utilisateurs)
      SELECT 'illimite', 'Illimité', 35000, NULL
      WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code = 'illimite')
    `)

    // Une seule ligne par organisation, mise à jour en place au fil des
    // changements de statut/plan (pas d'historique multi-lignes pour ce
    // MVP — suffisant tant qu'aucune vraie facturation n'est branchée).
    // Statuts : essai | actif | impaye (période de grâce, accès conservé) |
    // suspendu | annule (ces deux derniers coupent l'accès — voir
    // abonnementsService.accesAutorise).
    await client.query(`
      CREATE TABLE IF NOT EXISTS abonnements (
        id                    SERIAL PRIMARY KEY,
        organisation_id       INTEGER NOT NULL UNIQUE REFERENCES organisations(id) ON DELETE CASCADE,
        plan_id               INTEGER NOT NULL REFERENCES plans(id),
        statut                TEXT NOT NULL DEFAULT 'essai',
        debut_le              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fin_essai_le          TIMESTAMP,
        prochain_paiement_le  TIMESTAMP,
        created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Backfill : toute organisation déjà existante avant ce sprint (legacy
    // comprise) n'a par définition jamais souscrit via le nouveau flux —
    // elle est "grand-pérée" en statut actif permanent (fin_essai_le NULL),
    // jamais en essai à durée limitée. Les organisations créées APRÈS ce
    // sprint reçoivent leur ligne directement dans OrganisationsDAO.creerAvecAdmin
    // (statut 'essai'), donc ce backfill ne les concernera jamais (la
    // condition NOT EXISTS ne matche que les organisations sans ligne du tout).
    await client.query(`
      INSERT INTO abonnements (organisation_id, plan_id, statut, fin_essai_le)
      SELECT o.id, (SELECT id FROM plans WHERE code = 'essai_gratuit'), 'actif', NULL
      FROM organisations o
      WHERE NOT EXISTS (SELECT 1 FROM abonnements a WHERE a.organisation_id = o.id)
    `)

    // ── Sprint 19 — Platform Admin. Séparation structurelle stricte, jamais
    // dans "utilisateurs" : un administrateur d'organisation ne doit jamais
    // pouvoir devenir Platform Admin par un simple changement de rôle — le
    // cloisonnement se fait au niveau table, pas au niveau d'un flag.
    // Aucune route HTTP ne crée de ligne ici (voir server/api/scripts/
    // creerAdminPlateforme.js — script manuel, hors réseau, par design).
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins_plateforme (
        id          SERIAL PRIMARY KEY,
        nom         TEXT NOT NULL,
        email       TEXT UNIQUE NOT NULL,
        password    TEXT NOT NULL,
        actif       INTEGER DEFAULT 1,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Refresh tokens dédiés — jamais la même table que refresh_tokens
    // (Sprint 14, FK vers utilisateurs) : mélanger les deux domaines de
    // confiance dans une table polymorphe romprait précisément la séparation
    // recherchée.
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens_plateforme (
        id                    SERIAL PRIMARY KEY,
        admin_plateforme_id   INTEGER NOT NULL REFERENCES admins_plateforme(id) ON DELETE CASCADE,
        token_hash            TEXT NOT NULL UNIQUE,
        cree_le               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expire_le             TIMESTAMP NOT NULL,
        revoque               INTEGER DEFAULT 0,
        remplace_par          INTEGER REFERENCES refresh_tokens_plateforme(id) ON DELETE SET NULL
      )
    `)
    await client.query('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_plateforme_admin ON refresh_tokens_plateforme(admin_plateforme_id)')

    // organisation_id nullable : certaines actions (ex. creation d'un
    // Platform Admin, hors HTTP) ne concernent aucune organisation precise.
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs_plateforme (
        id                    SERIAL PRIMARY KEY,
        admin_plateforme_id   INTEGER REFERENCES admins_plateforme(id) ON DELETE SET NULL,
        action                TEXT NOT NULL,
        organisation_id       INTEGER REFERENCES organisations(id) ON DELETE SET NULL,
        details               JSONB,
        created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_plateforme_org ON audit_logs_plateforme(organisation_id)')

    // Chantier PayDunya — trace de chaque facture creee (historique de
    // facturation) et garde-fou d'idempotence pour le webhook : un
    // invoice_token deja "complete" ne se retraite jamais, meme si PayDunya
    // rejoue la notification (retentatives documentees en cas de non-reponse).
    await client.query(`
      CREATE TABLE IF NOT EXISTS paiements (
        id              SERIAL PRIMARY KEY,
        organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        plan_id         INTEGER NOT NULL REFERENCES plans(id),
        montant         REAL NOT NULL,
        invoice_token   TEXT UNIQUE NOT NULL,
        statut          TEXT NOT NULL DEFAULT 'en_attente',
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        complete_le     TIMESTAMP
      )
    `)
    await client.query('CREATE INDEX IF NOT EXISTS idx_paiements_org ON paiements(organisation_id)')

    // Chantier mot de passe oublie — email optionnel (comptes existants sans
    // email : plusieurs NULL autorises par Postgres sur une colonne UNIQUE,
    // aucun conflit).
    await client.query('ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS email TEXT UNIQUE')

    await client.query(`
      CREATE TABLE IF NOT EXISTS reinitialisations_mot_de_passe (
        id              SERIAL PRIMARY KEY,
        utilisateur_id  INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
        token_hash      TEXT NOT NULL UNIQUE,
        cree_le         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expire_le       TIMESTAMP NOT NULL,
        utilise         INTEGER DEFAULT 0
      )
    `)
    await client.query('CREATE INDEX IF NOT EXISTS idx_reinitialisations_utilisateur ON reinitialisations_mot_de_passe(utilisateur_id)')

    // Validation finale pre-production — remplace la Map en memoire du
    // rate limiter (server/api/middleware/rateLimiter.js) : partagee entre
    // toutes les instances du process API et persistante a travers un
    // redemarrage, contrairement a une Map locale au process.
    await client.query(`
      CREATE TABLE IF NOT EXISTS limites_tentatives (
        limiteur  TEXT NOT NULL,
        cle       TEXT NOT NULL,
        compte    INTEGER NOT NULL DEFAULT 1,
        depuis    TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (limiteur, cle)
      )
    `)

    // Chantier emails transactionnels — trace l'envoi de la relance avant
    // fin d'essai (core/services/relanceEssaiJob.js) pour garantir un envoi
    // unique par essai, meme pattern defensif que le job d'expiration.
    await client.query('ALTER TABLE abonnements ADD COLUMN IF NOT EXISTS relance_essai_envoyee_le TIMESTAMP')

    // Chantier invitations d'equipe — jusqu'ici, un administrateur ne pouvait
    // que creer directement un compte en fournissant lui-meme le mot de
    // passe. Meme conventions crypto que reinitialisations_mot_de_passe :
    // token opaque aleatoire, jamais stocke en clair (seulement son hash),
    // a usage unique. organisation_id/role/email figes des l'invitation ;
    // l'invite choisit uniquement son nom, son identifiant et son mot de
    // passe en acceptant.
    await client.query(`
      CREATE TABLE IF NOT EXISTS invitations_utilisateur (
        id              SERIAL PRIMARY KEY,
        organisation_id INTEGER NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        email           TEXT NOT NULL,
        role            TEXT NOT NULL,
        token_hash      TEXT NOT NULL UNIQUE,
        invite_par_id   INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL,
        expire_le       TIMESTAMP NOT NULL,
        utilise         INTEGER NOT NULL DEFAULT 0,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await client.query('CREATE INDEX IF NOT EXISTS idx_invitations_org ON invitations_utilisateur(organisation_id)')

    // Chantier RGPD — demande de suppression de compte, self-service. NON
    // destructif par construction : ne fait que reutiliser le statut
    // 'inactive' deja existant (meme mecanisme que la desactivation
    // manuelle) et marquer QUAND la demande a ete faite. Aucune suppression
    // definitive automatique n'est declenchee par ce chantier -- la colonne
    // sert uniquement a distinguer, cote Platform Admin, une organisation
    // desactivee manuellement d'une organisation qui a demande sa propre
    // suppression, et a permettre a l'administrateur d'annuler sa demande
    // tant que les donnees n'ont pas ete retirees.
    await client.query('ALTER TABLE organisations ADD COLUMN IF NOT EXISTS suppression_demandee_le TIMESTAMP')

    console.log('✅ Migrations terminées')
  } catch (err) {
    console.error('❌ Erreur migration:', err.message)
    throw err
  } finally {
    client.release()
  }
}

module.exports = runMigrations
