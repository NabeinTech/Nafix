// Extraction Service Layer (Sprint 0), désormais scopée par organisation
// (Sprint 1) : organisationId est reçu explicitement en paramètre à chaque
// appel — jamais lu d'un état global — et relayé tel quel à ProduitsDAO.

const ProduitsDAO = require('../../dao/ProduitsDAO')

function getAll(organisationId) {
  return ProduitsDAO.getAll(organisationId)
}

function create(produit, organisationId) {
  return ProduitsDAO.create(produit, organisationId)
}

function update(produit, organisationId) {
  return ProduitsDAO.update(produit, organisationId)
}

function remove(id, organisationId) {
  return ProduitsDAO.delete(id, organisationId)
}

module.exports = { getAll, create, update, delete: remove }
