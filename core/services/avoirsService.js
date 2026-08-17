// Service Layer Avoirs / comptes prépayés (Sprint 3), même pattern que les
// précédents : délégation directe vers AvoirsDAO, organisationId reçu
// explicitement à chaque appel.

const AvoirsDAO = require('../../dao/AvoirsDAO')

function getAll(organisationId) {
  return AvoirsDAO.getAll(organisationId)
}

function getByClient(clientId, organisationId) {
  return AvoirsDAO.getByClient(clientId, organisationId)
}

function getTransactions(avoirId, organisationId) {
  return AvoirsDAO.getTransactions(avoirId, organisationId)
}

function getAllTransactions(organisationId) {
  return AvoirsDAO.getAllTransactions(organisationId)
}

function creerCompte(d, organisationId) {
  return AvoirsDAO.creerCompte(d, organisationId)
}

function recharger(d, organisationId) {
  return AvoirsDAO.recharger(d, organisationId)
}

function enregistrerAchat(d, organisationId) {
  return AvoirsDAO.enregistrerAchat(d, organisationId)
}

function cloturerCompte(id, organisationId) {
  return AvoirsDAO.cloturerCompte(id, organisationId)
}

function remove(id, organisationId) {
  return AvoirsDAO.delete(id, organisationId)
}

module.exports = {
  getAll, getByClient, getTransactions, getAllTransactions,
  creerCompte, recharger, enregistrerAchat, cloturerCompte, delete: remove
}
