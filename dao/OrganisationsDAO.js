const pool = require('../db/pool')
const AuthService = require('../auth/AuthService')

const OrganisationsDAO = {
  async getById(id) {
    const { rows } = await pool.query(
      'SELECT id, nom, code, statut, created_at, suppression_demandee_le FROM organisations WHERE id = $1',
      [id]
    )
    return rows[0] || null
  },

  // "code" n'est jamais modifiable ici : db/migrate.js retrouve l'organisation
  // legacy via WHERE code = 'legacy' au démarrage — le changer romprait ce
  // lookup et créerait une organisation fantôme au redémarrage suivant.
  async update(id, { nom }) {
    const { rows } = await pool.query(
      'UPDATE organisations SET nom = $1 WHERE id = $2 RETURNING id, nom, code, statut, created_at',
      [nom, id]
    )
    return rows[0] || null
  },

  async setStatut(id, statut) {
    const statutsValides = ['active', 'inactive']
    if (!statutsValides.includes(statut)) return { erreur: 'Statut invalide' }
    const { rows } = await pool.query(
      'UPDATE organisations SET statut = $1 WHERE id = $2 RETURNING id, nom, code, statut, created_at',
      [statut, id]
    )
    return { succes: rows[0] }
  },

  // Chantier RGPD — jamais de suppression definitive automatique ici : se
  // contente de reutiliser le statut 'inactive' deja existant (coupe l'acces,
  // meme mecanisme que la desactivation manuelle) et de dater la demande,
  // pour que le Platform Admin distingue les deux cas et traite la
  // suppression reelle des donnees separement.
  async demanderSuppression(id) {
    const { rows } = await pool.query(
      "UPDATE organisations SET statut = 'inactive', suppression_demandee_le = now() WHERE id = $1 RETURNING id, nom, code, statut, created_at, suppression_demandee_le",
      [id]
    )
    return { succes: rows[0] }
  },

  async annulerSuppression(id) {
    const { rows } = await pool.query(
      "UPDATE organisations SET statut = 'active', suppression_demandee_le = NULL WHERE id = $1 RETURNING id, nom, code, statut, created_at, suppression_demandee_le",
      [id]
    )
    return { succes: rows[0] }
  },

  // Disponible pour un futur flux d'onboarding SaaS — pas encore exposée
  // dans l'UI Desktop (une organisation créée ici serait orpheline : aucun
  // utilisateur, inaccessible depuis une installation mono-organisation).
  async create({ nom, code }) {
    const { rows } = await pool.query(
      "INSERT INTO organisations (nom, code, statut) VALUES ($1, $2, 'active') RETURNING id, nom, code, statut, created_at",
      [nom, code || null]
    )
    return rows[0]
  },

  // Onboarding self-service — appelé avant toute session (écran de connexion),
  // donc sans organisationId/RBAC à ce stade : la seule protection possible
  // est la validation des données. Transaction unique : si le username existe
  // déjà, tout est annulé — jamais d'organisation orpheline sans utilisateur.
  async creerAvecAdmin({ nom, adminNom, username, password, email }) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const existant = await client.query('SELECT id FROM utilisateurs WHERE username = $1', [username])
      if (existant.rows.length) {
        await client.query('ROLLBACK')
        return { erreur: 'Cet identifiant existe déjà !' }
      }

      if (email) {
        const emailExistant = await client.query('SELECT id FROM utilisateurs WHERE email = $1', [email])
        if (emailExistant.rows.length) {
          await client.query('ROLLBACK')
          return { erreur: 'Cet email est déjà utilisé par un autre compte !' }
        }
      }

      const { rows: [organisation] } = await client.query(
        "INSERT INTO organisations (nom, code, statut) VALUES ($1, NULL, 'active') RETURNING id, nom, code, statut, created_at",
        [nom]
      )

      const hashedPwd = await AuthService.hashPassword(password)
      const { rows: [utilisateur] } = await client.query(
        `INSERT INTO utilisateurs (nom, username, password, role, organisation_id, email)
         VALUES ($1, $2, $3, 'administrateur', $4, $5)
         RETURNING id, nom, username, role, organisation_id, email`,
        [adminNom, username, hashedPwd, organisation.id, email || null]
      )

      // Sprint 18 — toute organisation créée par ce flux reçoit un essai
      // gratuit de 14 jours, dans la même transaction (jamais d'organisation
      // sans abonnement). Silencieux si le plan n'existe pas encore (base pas
      // migrée avec le Sprint 18) plutôt que de faire échouer la création.
      const { rows: [planEssai] } = await client.query("SELECT id FROM plans WHERE code = 'essai_gratuit'")
      if (planEssai) {
        const finEssai = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        await client.query(
          "INSERT INTO abonnements (organisation_id, plan_id, statut, fin_essai_le) VALUES ($1,$2,'essai',$3)",
          [organisation.id, planEssai.id, finEssai]
        )
      }

      await client.query('COMMIT')
      return { succes: { organisation, utilisateur } }
    } catch (err) {
      await client.query('ROLLBACK')
      return { erreur: err.message }
    } finally {
      client.release()
    }
  },

  // Sprint 19 — SEUL point sanctionné de tout le dépôt pour lister TOUTES les
  // organisations sans filtre organisation_id. Nom délibérément explicite
  // ("PourPlateforme") pour qu'un futur appel accidentel depuis un chemin
  // tenant-scopé saute aux yeux en revue de code — n'appeler que depuis
  // server/api/routes/platform.js, jamais depuis un service/DAO métier.
  async getAllPourPlateforme() {
    const { rows } = await pool.query(`
      SELECT o.id, o.nom, o.code, o.statut, o.created_at, o.suppression_demandee_le,
             a.statut AS abonnement_statut, a.fin_essai_le, p.code AS plan_code, p.nom AS plan_nom,
             (SELECT COUNT(*)::int FROM utilisateurs u WHERE u.organisation_id = o.id) AS nb_utilisateurs
      FROM organisations o
      LEFT JOIN abonnements a ON a.organisation_id = o.id
      LEFT JOIN plans p ON a.plan_id = p.id
      ORDER BY o.id
    `)
    return rows
  }
}

module.exports = OrganisationsDAO
