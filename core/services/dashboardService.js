// Service Layer Dashboard (Sprint 3), même pattern que les précédents :
// délégation directe vers DashboardDAO, organisationId reçu explicitement.

const DashboardDAO = require('../../dao/DashboardDAO')

function getAll(organisationId) {
  return DashboardDAO.getAll(organisationId)
}

module.exports = { getAll }
