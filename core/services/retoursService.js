// Service Layer Retours (Sprint 3), même pattern que les précédents :
// délégation directe vers RetoursDAO, organisationId reçu explicitement.

const RetoursDAO = require('../../dao/RetoursDAO')

function getAll(organisationId) {
  return RetoursDAO.getAll(organisationId)
}

function getPendants(organisationId) {
  return RetoursDAO.getPendants(organisationId)
}

function create(retour, organisationId) {
  return RetoursDAO.create(retour, organisationId)
}

function approuver(id, approuvePar, organisationId) {
  return RetoursDAO.approuver(id, approuvePar, organisationId)
}

function rejeter(id, approuvePar, organisationId) {
  return RetoursDAO.rejeter(id, approuvePar, organisationId)
}

module.exports = { getAll, getPendants, create, approuver, rejeter }
