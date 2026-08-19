// Sprint 19 — journal d'audit des actions Platform Admin. organisation_id
// nullable (certaines actions n'en concernent aucune précise).
const pool = require('../../db/pool')

async function journaliser({ adminPlateformeId, action, organisationId = null, details = null }) {
  await pool.query(
    'INSERT INTO audit_logs_plateforme (admin_plateforme_id, action, organisation_id, details) VALUES ($1,$2,$3,$4)',
    [adminPlateformeId, action, organisationId, details ? JSON.stringify(details) : null]
  )
}

async function getPourOrganisation(organisationId) {
  const { rows } = await pool.query(
    `SELECT l.*, a.email AS admin_email
     FROM audit_logs_plateforme l
     LEFT JOIN admins_plateforme a ON l.admin_plateforme_id = a.id
     WHERE l.organisation_id = $1
     ORDER BY l.created_at DESC
     LIMIT 200`,
    [organisationId]
  )
  return rows
}

module.exports = { journaliser, getPourOrganisation }
