// Service Layer Fournisseurs (Sprint 3), même pattern que les précédents :
// délégation directe vers FournisseursDAO, organisationId reçu explicitement.

const FournisseursDAO = require('../../dao/FournisseursDAO')

function getAll(organisationId) {
  return FournisseursDAO.getAll(organisationId)
}

function create(f, organisationId) {
  return FournisseursDAO.create(f, organisationId)
}

function update(f, organisationId) {
  return FournisseursDAO.update(f, organisationId)
}

function remove(id, organisationId) {
  return FournisseursDAO.delete(id, organisationId)
}

module.exports = { getAll, create, update, delete: remove }
