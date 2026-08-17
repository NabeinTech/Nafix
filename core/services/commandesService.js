// Service Layer Commandes clients (Sprint 3), même pattern que les précédents :
// délégation directe vers CommandesDAO, organisationId reçu explicitement.

const CommandesDAO = require('../../dao/CommandesDAO')

function getAll(organisationId) {
  return CommandesDAO.getAll(organisationId)
}

function create(commande, organisationId) {
  return CommandesDAO.create(commande, organisationId)
}

function changerStatut(id, statut, organisationId) {
  return CommandesDAO.changerStatut(id, statut, organisationId)
}

function setPriorite(id, priorite, organisationId) {
  return CommandesDAO.setPriorite(id, priorite, organisationId)
}

function setDateLivraison(id, date, organisationId) {
  return CommandesDAO.setDateLivraison(id, date, organisationId)
}

function remove(id, organisationId) {
  return CommandesDAO.delete(id, organisationId)
}

function getAlertes(organisationId) {
  return CommandesDAO.getAlertes(organisationId)
}

function getCalendrier(annee, mois, organisationId) {
  return CommandesDAO.getCalendrier(annee, mois, organisationId)
}

module.exports = { getAll, create, changerStatut, setPriorite, setDateLivraison, delete: remove, getAlertes, getCalendrier }
