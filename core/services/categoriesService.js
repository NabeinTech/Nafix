// Service Layer Catégories (Sprint 7), même pattern que les précédents :
// délégation directe vers CategoriesDAO, organisationId reçu explicitement.

const CategoriesDAO = require('../../dao/CategoriesDAO')

function getAll(organisationId) {
  return CategoriesDAO.getAll(organisationId)
}

function create(cat, organisationId) {
  return CategoriesDAO.create(cat, organisationId)
}

function update(cat, organisationId) {
  return CategoriesDAO.update(cat, organisationId)
}

function remove(id, organisationId) {
  return CategoriesDAO.delete(id, organisationId)
}

function createSousCategorie(scat, organisationId) {
  return CategoriesDAO.createSousCategorie(scat, organisationId)
}

function deleteSousCategorie(id, organisationId) {
  return CategoriesDAO.deleteSousCategorie(id, organisationId)
}

module.exports = { getAll, create, update, delete: remove, createSousCategorie, deleteSousCategorie }
