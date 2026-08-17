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
        for (const dom of ['informatique', 'alimentaire', 'quincaillerie', 'textile', 'restauration', 'btp', 'general']) {
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

    // Administrateur par défaut avec mot de passe hashé
    const admin = await client.query("SELECT id FROM utilisateurs WHERE username = 'admin'")
    if (!admin.rows.length) {
      const hashedPwd = await AuthService.hashPassword('admin123')
      await client.query(
        'INSERT INTO utilisateurs (nom, username, password, role) VALUES ($1, $2, $3, $4)',
        ['Administrateur', 'admin', hashedPwd, 'administrateur']
      )
      console.log('✅ Utilisateur admin créé (admin / admin123)')
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
    } else {
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

    console.log('✅ Migrations terminées')
  } catch (err) {
    console.error('❌ Erreur migration:', err.message)
    throw err
  } finally {
    client.release()
  }
}

module.exports = runMigrations
