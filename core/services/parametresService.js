// Service Layer Paramètres (Sprint 6), même pattern que les précédents :
// délégation directe vers ParametresDAO, organisationId reçu explicitement.

const ParametresDAO = require('../../dao/ParametresDAO')

function get(organisationId) {
  return ParametresDAO.get(organisationId)
}

function save(params, organisationId) {
  return ParametresDAO.save(params, organisationId)
}

module.exports = { get, save }
