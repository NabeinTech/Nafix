// Sprint 18 — DAO abonnements/plans. Même pattern que les DAO métier
// existants (organisationId explicite), même si cette entité sert la
// fondation SaaS plutôt qu'un module Desktop existant.
const pool = require('../db/pool')

const AbonnementsDAO = {
  async getByOrganisation(organisationId) {
    const { rows } = await pool.query(`
      SELECT a.*, p.code AS plan_code, p.nom AS plan_nom, p.prix_mensuel, p.max_utilisateurs
      FROM abonnements a
      JOIN plans p ON a.plan_id = p.id
      WHERE a.organisation_id = $1
    `, [organisationId])
    return rows[0] || null
  },

  async getPlans() {
    const { rows } = await pool.query('SELECT * FROM plans WHERE actif = 1 ORDER BY prix_mensuel ASC')
    return rows
  },

  async changerPlan(organisationId, codePlan) {
    const { rows: [plan] } = await pool.query('SELECT id FROM plans WHERE code = $1 AND actif = 1', [codePlan])
    if (!plan) return { erreur: 'Plan introuvable' }
    const { rows: [abonnement] } = await pool.query(
      'UPDATE abonnements SET plan_id = $1, updated_at = CURRENT_TIMESTAMP WHERE organisation_id = $2 RETURNING *',
      [plan.id, organisationId]
    )
    if (!abonnement) return { erreur: 'Abonnement introuvable' }
    return { succes: abonnement }
  },

  async changerStatut(organisationId, statut) {
    const statutsValides = ['essai', 'essai_expire', 'actif', 'impaye', 'suspendu', 'annule']
    if (!statutsValides.includes(statut)) return { erreur: 'Statut invalide' }
    const { rows: [abonnement] } = await pool.query(
      'UPDATE abonnements SET statut = $1, updated_at = CURRENT_TIMESTAMP WHERE organisation_id = $2 RETURNING *',
      [statut, organisationId]
    )
    if (!abonnement) return { erreur: 'Abonnement introuvable' }
    return { succes: abonnement }
  },

  async compterUtilisateurs(organisationId) {
    const { rows: [{ n }] } = await pool.query('SELECT COUNT(*)::int AS n FROM utilisateurs WHERE organisation_id = $1', [organisationId])
    return n
  },

  // Job d'expiration des essais — abonnementsService.accesAutorise() bloque
  // deja l'acces des la date depassee (calcul a la volee, correct meme sans
  // ce job), mais la ligne restait affichee "essai" en base indefiniment :
  // Platform Admin ne pouvait pas distinguer un essai encore actif d'un
  // essai deja bloque sans recalculer la date lui-meme. Bascule en masse,
  // en un aller-retour, tous les abonnements essai dont la date est
  // depassee vers un statut dedie — renvoie les organisation_id affectes
  // pour journalisation.
  async expirerEssaisPasses() {
    const { rows } = await pool.query(
      `UPDATE abonnements SET statut = 'essai_expire', updated_at = CURRENT_TIMESTAMP
       WHERE statut = 'essai' AND fin_essai_le IS NOT NULL AND fin_essai_le < now()
       RETURNING organisation_id`
    )
    return rows.map(r => r.organisation_id)
  }
}

module.exports = AbonnementsDAO
