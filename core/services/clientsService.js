// Service Layer Clients (Sprint 2), même pattern que produitsService :
// délégation directe vers ClientsDAO, organisationId reçu explicitement.

const ClientsDAO = require('../../dao/ClientsDAO')

function getAll(organisationId) {
  return ClientsDAO.getAll(organisationId)
}

function create(client, organisationId) {
  return ClientsDAO.create(client, organisationId)
}

function update(client, organisationId) {
  return ClientsDAO.update(client, organisationId)
}

function remove(id, organisationId) {
  return ClientsDAO.delete(id, organisationId)
}

module.exports = { getAll, create, update, delete: remove }
