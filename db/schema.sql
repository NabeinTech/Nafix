-- Schéma PostgreSQL — Nafix Multi-Poste

CREATE TABLE IF NOT EXISTS produits (
  id SERIAL PRIMARY KEY,
  reference TEXT UNIQUE,
  nom TEXT NOT NULL,
  categorie TEXT,
  sous_categorie TEXT,
  marque TEXT,
  prix_achat REAL DEFAULT 0,
  prix_vente REAL DEFAULT 0,
  stock_actuel NUMERIC(10,3) DEFAULT 0,
  stock_minimum NUMERIC(10,3) DEFAULT 5,
  unite TEXT DEFAULT 'pièce',
  attributs TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  type TEXT DEFAULT 'particulier',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS factures (
  id SERIAL PRIMARY KEY,
  numero TEXT UNIQUE,
  client_id INTEGER REFERENCES clients(id),
  date_facture DATE,
  montant_ht REAL DEFAULT 0,
  tva REAL DEFAULT 0,
  montant_ttc REAL DEFAULT 0,
  statut TEXT DEFAULT 'en_attente',
  mode_paiement TEXT DEFAULT 'especes',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lignes_facture (
  id SERIAL PRIMARY KEY,
  facture_id INTEGER REFERENCES factures(id),
  produit_id INTEGER REFERENCES produits(id),
  quantite NUMERIC(10,3) DEFAULT 1,
  prix_unitaire REAL DEFAULT 0,
  total REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tresorerie (
  id SERIAL PRIMARY KEY,
  type TEXT,
  categorie TEXT,
  montant REAL DEFAULT 0,
  description TEXT,
  date_operation DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS ventes (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  mode_paiement TEXT,
  montant_total_original REAL DEFAULT 0,
  escompte_montant REAL DEFAULT 0,
  escompte_type TEXT DEFAULT 'pourcentage',
  escompte_pourcentage REAL DEFAULT 0,
  montant_total REAL DEFAULT 0,
  montant_paye REAL DEFAULT 0,
  montant_du REAL DEFAULT 0,
  est_pret INTEGER DEFAULT 0,
  est_partiel INTEGER DEFAULT 0,
  date_pret DATE,
  panier TEXT,
  vendeur TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS devis (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id),
  validite INTEGER DEFAULT 30,
  notes TEXT,
  montant_total REAL DEFAULT 0,
  panier TEXT,
  statut TEXT DEFAULT 'en_attente',
  converti INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS utilisateurs (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  username TEXT UNIQUE,
  password TEXT,
  role TEXT DEFAULT 'caissier',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS parametres (
  id INTEGER PRIMARY KEY DEFAULT 1,
  nom_entreprise TEXT,
  slogan TEXT,
  telephone TEXT,
  telephone_secondaire TEXT,
  email TEXT,
  adresse TEXT,
  registre_commerce TEXT,
  ninea TEXT,
  tva_taux TEXT,
  mention_facture TEXT,
  logo_base64 TEXT,
  activites TEXT,
  sous_activites TEXT,
  couleur_theme TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  nom TEXT UNIQUE NOT NULL,
  icone TEXT DEFAULT '📦',
  couleur TEXT DEFAULT 'blue',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sous_categories (
  id SERIAL PRIMARY KEY,
  categorie_id INTEGER NOT NULL REFERENCES categories(id),
  nom TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fournisseurs (
  id SERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  contact_nom TEXT,
  type TEXT DEFAULT 'grossiste',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS achats (
  id SERIAL PRIMARY KEY,
  fournisseur_id INTEGER REFERENCES fournisseurs(id),
  reference TEXT,
  montant_total REAL DEFAULT 0,
  montant_paye REAL DEFAULT 0,
  montant_du REAL DEFAULT 0,
  mode_paiement TEXT DEFAULT 'especes',
  statut TEXT DEFAULT 'en_attente',
  notes TEXT,
  panier TEXT,
  date_achat DATE DEFAULT CURRENT_DATE,
  etape TEXT DEFAULT 'brouillon',
  priorite TEXT DEFAULT 'normale',
  date_livraison_prevue DATE,
  date_livraison_reelle DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS domaine (
  id INTEGER PRIMARY KEY DEFAULT 1,
  type TEXT DEFAULT 'general',
  nom TEXT DEFAULT 'Commerce Général'
);

CREATE TABLE IF NOT EXISTS retours (
  id SERIAL PRIMARY KEY,
  vente_id INTEGER REFERENCES ventes(id),
  panier_retour TEXT,
  montant_retour REAL DEFAULT 0,
  raison TEXT,
  mode_remboursement TEXT DEFAULT 'especes',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commandes_clients (
  id                    SERIAL PRIMARY KEY,
  numero                TEXT UNIQUE,
  client_id             INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  client_nom            TEXT NOT NULL,
  client_telephone      TEXT,
  date_commande         TIMESTAMP DEFAULT NOW(),
  date_livraison_prevue DATE,
  date_livraison_reelle DATE,
  statut                TEXT DEFAULT 'nouvelle',
  priorite              TEXT DEFAULT 'normale',
  mode_paiement         TEXT DEFAULT 'especes',
  panier                TEXT DEFAULT '[]',
  total                 NUMERIC(12,2) DEFAULT 0,
  acompte               NUMERIC(12,2) DEFAULT 0,
  notes                 TEXT,
  vendeur               TEXT,
  vente_id              INTEGER REFERENCES ventes(id) ON DELETE SET NULL,
  created_at            TIMESTAMP DEFAULT NOW()
);

-- ── Index de performance ───────────────────────────────────
-- Clés étrangères (accélèrent les JOIN)
CREATE INDEX IF NOT EXISTS idx_ventes_client_id       ON ventes(client_id);
CREATE INDEX IF NOT EXISTS idx_lignes_facture_id      ON lignes_facture(facture_id);
CREATE INDEX IF NOT EXISTS idx_lignes_produit_id      ON lignes_facture(produit_id);
CREATE INDEX IF NOT EXISTS idx_achats_fournisseur_id  ON achats(fournisseur_id);
CREATE INDEX IF NOT EXISTS idx_retours_vente_id       ON retours(vente_id);
CREATE INDEX IF NOT EXISTS idx_sous_cat_categorie_id  ON sous_categories(categorie_id);

-- Colonnes de tri et recherche
CREATE INDEX IF NOT EXISTS idx_ventes_created_at      ON ventes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_produits_nom           ON produits(LOWER(nom));
CREATE INDEX IF NOT EXISTS idx_produits_reference     ON produits(LOWER(reference));
CREATE INDEX IF NOT EXISTS idx_produits_stock         ON produits(stock_actuel) WHERE stock_actuel <= stock_minimum;
CREATE INDEX IF NOT EXISTS idx_clients_nom            ON clients(LOWER(nom));
CREATE INDEX IF NOT EXISTS idx_clients_telephone      ON clients(telephone);
