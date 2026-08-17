// Service Layer Ventes (Sprint 2), même pattern que produitsService /
// clientsService : délégation directe vers VentesDAO, organisationId reçu
// explicitement à chaque appel.

const VentesDAO = require('../../dao/VentesDAO')

function getAll(organisationId) {
  return VentesDAO.getAll(organisationId)
}

function create(vente, organisationId) {
  return VentesDAO.create(vente, organisationId)
}

function update(vente, organisationId) {
  return VentesDAO.update(vente, organisationId)
}

function fullUpdate(vente, organisationId) {
  return VentesDAO.fullUpdate(vente, organisationId)
}

function remove(id, organisationId) {
  return VentesDAO.delete(id, organisationId)
}

module.exports = { getAll, create, update, fullUpdate, delete: remove }
