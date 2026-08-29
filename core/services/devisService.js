// Service Layer Devis (Sprint 2), même pattern que les autres : délégation
// directe vers DevisDAO, organisationId reçu explicitement à chaque appel.

const DevisDAO = require('../../dao/DevisDAO')

function getAll(organisationId) {
  return DevisDAO.getAll(organisationId)
}

function create(devis, organisationId) {
  return DevisDAO.create(devis, organisationId)
}

function updateStatut(id, statut, organisationId) {
  return DevisDAO.updateStatut(id, statut, organisationId)
}

function convertir(facture, organisationId) {
  return DevisDAO.convertir(facture, organisationId)
}

function update(devis, organisationId) {
  return DevisDAO.update(devis, organisationId)
}

function deleteDevis(id, organisationId) {
  return DevisDAO.delete(id, organisationId)
}

module.exports = { getAll, create, updateStatut, convertir, update, delete: deleteDevis }
