// Service Layer Domaine (Sprint 6), même pattern que les précédents :
// délégation directe vers DomaineDAO, organisationId reçu explicitement.

const DomaineDAO = require('../../dao/DomaineDAO')

function get(organisationId) {
  return DomaineDAO.get(organisationId)
}

function save(domaine, organisationId) {
  return DomaineDAO.save(domaine, organisationId)
}

module.exports = { get, save }
