// Sprint 1 — Fondation multi-tenant. getOrganisationActive() reste disponible
// (ex. futur assistant de configuration) mais n'est plus dans le chemin de
// résolution de session depuis le Sprint 4 (voir getOrganisationIdActive
// dans main.js, qui dérive l'organisation de l'utilisateur authentifié).
//
// Sprint 5 — Gestion des organisations : délégation vers OrganisationsDAO,
// organisationId toujours reçu explicitement, jamais lu d'un état global.

const pool = require('../../db/pool')
const OrganisationsDAO = require('../../dao/OrganisationsDAO')

async function getOrganisationActive() {
  const { rows } = await pool.query(
    "SELECT id, nom, code, statut FROM organisations WHERE statut = 'active' ORDER BY id LIMIT 1"
  )
  return rows[0] || null
}

function getById(organisationId) {
  return OrganisationsDAO.getById(organisationId)
}

function update(organisationId, data) {
  return OrganisationsDAO.update(organisationId, data)
}

function setStatut(organisationId, statut) {
  return OrganisationsDAO.setStatut(organisationId, statut)
}

module.exports = { getOrganisationActive, getById, update, setStatut }
