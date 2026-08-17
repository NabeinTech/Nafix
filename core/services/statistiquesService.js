// Service Layer Statistiques (Sprint 3), même pattern que les précédents :
// délégation directe vers StatistiquesDAO, organisationId reçu explicitement.

const StatistiquesDAO = require('../../dao/StatistiquesDAO')

function getAll(organisationId) {
  return StatistiquesDAO.getAll(organisationId)
}

module.exports = { getAll }
