// Service Layer Trésorerie (Sprint 3), même pattern que les précédents :
// délégation directe vers TresorerieDAO, organisationId reçu explicitement.

const TresorerieDAO = require('../../dao/TresorerieDAO')

function getAll(organisationId) {
  return TresorerieDAO.getAll(organisationId)
}

function create(op, organisationId) {
  return TresorerieDAO.create(op, organisationId)
}

function update(op, organisationId) {
  return TresorerieDAO.update(op, organisationId)
}

function remove(id, organisationId) {
  return TresorerieDAO.delete(id, organisationId)
}

function getStats(organisationId) {
  return TresorerieDAO.getStats(organisationId)
}

function getClotures(organisationId) {
  return TresorerieDAO.getClotures(organisationId)
}

function cloturer(date, cloturePar, notes, organisationId) {
  return TresorerieDAO.cloturer(date, cloturePar, notes, organisationId)
}

function rapportCloture(date, organisationId) {
  return TresorerieDAO.rapportCloture(date, organisationId)
}

module.exports = { getAll, create, update, delete: remove, getStats, getClotures, cloturer, rapportCloture }
