// Service Layer Sauvegarde (Sprint 9) — remplace l'export pg_dump global
// (fuite de confidentialité inter-organisations identifiée à l'audit de
// clôture du Sprint 8) par un export/import scopé par organisation.
//
// Accès direct aux tables (SELECT *), pas via les services métier existants :
// leurs getAll() sont pensés pour l'affichage (jointures, colonnes calculées,
// projections partielles — ex. VentesDAO.getAll() n'inclut pas
// montant_retourne) et perdraient en route des colonnes réelles nécessaires
// à une restauration fidèle. Une sauvegarde a besoin de lignes brutes
// complètes, comme le faisait pg_dump — juste correctement filtrées.
//
// Les comptes utilisateurs ne sont volontairement ni exportés ni restaurés :
// remplacer les utilisateurs de l'organisation cible en cours de restauration
// exposerait à un verrouillage de la session en cours et à des collisions
// sur username (unique globalement). La restauration couvre les données
// métier et la configuration (paramètres, domaine, catégories) ; les comptes
// se recréent via l'onglet Utilisateurs si nécessaire.

const pool = require('../../db/pool')

const VERSION_FORMAT = 1

// Ordre d'insertion respectant les dépendances de clés étrangères
// (parents avant enfants) — utilisé aussi pour l'export, par simplicité.
const TABLES_DONNEES = [
  'produits', 'clients', 'fournisseurs', 'categories', 'sous_categories',
  'clotures_journalieres', 'tresorerie', 'ventes', 'devis', 'achats',
  'retours', 'commandes_clients', 'avoirs_clients', 'transactions_avoir'
]

const SEQUENCE_PAR_TABLE = {
  produits: 'produits_id_seq',
  clients: 'clients_id_seq',
  fournisseurs: 'fournisseurs_id_seq',
  categories: 'categories_id_seq',
  sous_categories: 'sous_categories_id_seq',
  clotures_journalieres: 'clotures_journalieres_id_seq',
  tresorerie: 'tresorerie_id_seq',
  ventes: 'ventes_id_seq',
  devis: 'devis_id_seq',
  achats: 'achats_id_seq',
  retours: 'retours_id_seq',
  commandes_clients: 'commandes_clients_id_seq',
  avoirs_clients: 'avoirs_clients_id_seq',
  transactions_avoir: 'transactions_avoir_id_seq'
}

async function exporter(organisationId) {
  const donnees = {}
  for (const table of TABLES_DONNEES) {
    const { rows } = await pool.query(`SELECT * FROM ${table} WHERE organisation_id = $1`, [organisationId])
    donnees[table] = rows
  }
  const { rows: parametresRows } = await pool.query('SELECT * FROM parametres WHERE organisation_id = $1', [organisationId])
  const { rows: domaineRows } = await pool.query('SELECT * FROM domaine WHERE organisation_id = $1', [organisationId])

  return {
    version: VERSION_FORMAT,
    genereLe: new Date().toISOString(),
    donnees: {
      ...donnees,
      parametres: parametresRows[0] || null,
      domaine: domaineRows[0] || null
    }
  }
}

async function importer(sauvegarde, organisationId) {
  if (!sauvegarde || sauvegarde.version !== VERSION_FORMAT || !sauvegarde.donnees) {
    return { erreur: 'Fichier de sauvegarde invalide ou incompatible.' }
  }
  const donnees = sauvegarde.donnees

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Précondition : les tables de données doivent être vides sur TOUTE la
    // base (pas seulement pour cette organisation) — nécessaire pour
    // préserver les identifiants d'origine sans risque de collision avec
    // une autre organisation. Même exigence que l'ancienne restauration par
    // pg_restore, qui imposait déjà une base vide.
    for (const table of TABLES_DONNEES) {
      const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM ${table}`)
      if (rows[0].n > 0) {
        await client.query('ROLLBACK')
        return { erreur: `Restauration refusée : la table "${table}" contient déjà des données. La restauration exige une base vide.` }
      }
    }

    const inserer = async (table, lignes) => {
      for (const ligne of (lignes || [])) {
        // organisation_id est toujours forcé à l'organisation courante,
        // jamais repris du fichier importé.
        const ligneCorrigee = { ...ligne, organisation_id: organisationId }
        const colonnes = Object.keys(ligneCorrigee)
        const placeholders = colonnes.map((_, i) => `$${i + 1}`).join(',')
        await client.query(
          `INSERT INTO ${table} (${colonnes.join(',')}) VALUES (${placeholders})`,
          colonnes.map(c => ligneCorrigee[c])
        )
      }
    }

    for (const table of TABLES_DONNEES) {
      await inserer(table, donnees[table])
    }

    // Recaler chaque séquence sur le MAX(id) réel — même technique qu'au Sprint 8.
    for (const [table, seq] of Object.entries(SEQUENCE_PAR_TABLE)) {
      await client.query(
        `SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`
      )
    }

    // Paramètres/domaine : upsert simple, sans risque (une ligne par organisation).
    if (donnees.parametres) {
      const p = donnees.parametres
      await client.query(
        `INSERT INTO parametres (organisation_id, nom_entreprise, slogan, telephone, telephone_secondaire,
          email, adresse, registre_commerce, ninea, tva_taux, mention_facture, logo_base64, format_facture,
          activites, sous_activites, couleur_theme)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (organisation_id) DO UPDATE SET
           nom_entreprise=$2, slogan=$3, telephone=$4, telephone_secondaire=$5, email=$6, adresse=$7,
           registre_commerce=$8, ninea=$9, tva_taux=$10, mention_facture=$11, logo_base64=$12,
           format_facture=$13, activites=$14, sous_activites=$15, couleur_theme=$16`,
        [organisationId, p.nom_entreprise, p.slogan, p.telephone, p.telephone_secondaire, p.email, p.adresse,
         p.registre_commerce, p.ninea, p.tva_taux, p.mention_facture, p.logo_base64, p.format_facture,
         p.activites, p.sous_activites, p.couleur_theme]
      )
    }
    if (donnees.domaine) {
      const d = donnees.domaine
      await client.query(
        `INSERT INTO domaine (organisation_id, type, nom) VALUES ($1,$2,$3)
         ON CONFLICT (organisation_id) DO UPDATE SET type=$2, nom=$3`,
        [organisationId, d.type, d.nom]
      )
    }

    await client.query('COMMIT')
    return { succes: true }
  } catch (err) {
    await client.query('ROLLBACK')
    return { erreur: err.message }
  } finally {
    client.release()
  }
}

module.exports = { exporter, importer }
