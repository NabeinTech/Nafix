// Service Layer Achats (Sprint 3), même pattern que les précédents :
// délégation directe vers AchatsDAO, organisationId reçu explicitement.

const AchatsDAO = require('../../dao/AchatsDAO')

function getAll(organisationId) {
  return AchatsDAO.getAll(organisationId)
}

function create(achat, organisationId) {
  return AchatsDAO.create(achat, organisationId)
}

function update(achat, organisationId) {
  return AchatsDAO.update(achat, organisationId)
}

function changerEtape(id, etape, organisationId) {
  return AchatsDAO.changerEtape(id, etape, organisationId)
}

function remove(id, organisationId) {
  return AchatsDAO.delete(id, organisationId)
}

module.exports = { getAll, create, update, changerEtape, delete: remove }
