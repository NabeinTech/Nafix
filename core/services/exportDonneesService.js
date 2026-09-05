// Chantier RGPD — export complet des donnees d'une organisation, en
// self-service. Reutilise tel quel le getAll(organisationId) deja expose par
// chaque DAO metier (aucune nouvelle requete SQL ecrite ici) : les memes
// garanties de cloisonnement multi-tenant deja en place et testees
// (dao/multiTenantIsolation.test.js) s'appliquent donc automatiquement a
// l'export. UtilisateursDAO.getAll ne renvoie jamais le hash du mot de
// passe (verifie : SELECT explicite sans la colonne password).
const OrganisationsDAO = require('../../dao/OrganisationsDAO')
const ClientsDAO = require('../../dao/ClientsDAO')
const ProduitsDAO = require('../../dao/ProduitsDAO')
const FournisseursDAO = require('../../dao/FournisseursDAO')
const VentesDAO = require('../../dao/VentesDAO')
const DevisDAO = require('../../dao/DevisDAO')
const AchatsDAO = require('../../dao/AchatsDAO')
const CommandesDAO = require('../../dao/CommandesDAO')
const RetoursDAO = require('../../dao/RetoursDAO')
const AvoirsDAO = require('../../dao/AvoirsDAO')
const TresorerieDAO = require('../../dao/TresorerieDAO')
const CategoriesDAO = require('../../dao/CategoriesDAO')
const UtilisateursDAO = require('../../dao/UtilisateursDAO')
const DomaineDAO = require('../../dao/DomaineDAO')
const ParametresDAO = require('../../dao/ParametresDAO')

async function exporterTout(organisationId) {
  const [
    organisation, clients, produits, fournisseurs, ventes, devis, achats,
    commandes, retours, avoirs, tresorerie, categories, utilisateurs, domaine, parametres
  ] = await Promise.all([
    OrganisationsDAO.getById(organisationId),
    ClientsDAO.getAll(organisationId),
    ProduitsDAO.getAll(organisationId),
    FournisseursDAO.getAll(organisationId),
    VentesDAO.getAll(organisationId),
    DevisDAO.getAll(organisationId),
    AchatsDAO.getAll(organisationId),
    CommandesDAO.getAll(organisationId),
    RetoursDAO.getAll(organisationId),
    AvoirsDAO.getAll(organisationId),
    TresorerieDAO.getAll(organisationId),
    CategoriesDAO.getAll(organisationId),
    UtilisateursDAO.getAll(organisationId),
    DomaineDAO.get(organisationId),
    ParametresDAO.get(organisationId)
  ])

  return {
    exporte_le: new Date().toISOString(),
    organisation, domaine, parametres, utilisateurs,
    clients, produits, fournisseurs, categories,
    ventes, devis, achats, commandes, retours, avoirs, tresorerie
  }
}

module.exports = { exporterTout }
