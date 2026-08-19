// Sprint 18 — Service Layer Abonnements, même pattern que les autres :
// délégation directe vers AbonnementsDAO, organisationId reçu explicitement.
const AbonnementsDAO = require('../../dao/AbonnementsDAO')

function getByOrganisation(organisationId) {
  return AbonnementsDAO.getByOrganisation(organisationId)
}

function getPlans() {
  return AbonnementsDAO.getPlans()
}

function changerPlan(organisationId, codePlan) {
  return AbonnementsDAO.changerPlan(organisationId, codePlan)
}

function changerStatut(organisationId, statut) {
  return AbonnementsDAO.changerStatut(organisationId, statut)
}

// Règle d'accès unique, partagée par le gate HTTP (Sprint 18) et tout futur
// appelant (Desktop inclus) — un essai expiré (même si la ligne n'a pas
// encore été basculée en base par un job planifié, qui n'existe pas encore)
// est traité comme bloquant dès que sa date est dépassée.
function accesAutorise(abonnement) {
  if (!abonnement) return false
  if (abonnement.statut === 'essai') {
    if (abonnement.fin_essai_le && new Date(abonnement.fin_essai_le) < new Date()) return false
    return true
  }
  return abonnement.statut === 'actif' || abonnement.statut === 'impaye'
}

async function quotaUtilisateursAtteint(organisationId) {
  const abonnement = await AbonnementsDAO.getByOrganisation(organisationId)
  if (!abonnement || abonnement.max_utilisateurs == null) return false
  const nb = await AbonnementsDAO.compterUtilisateurs(organisationId)
  return nb >= abonnement.max_utilisateurs
}

module.exports = { getByOrganisation, getPlans, changerPlan, changerStatut, accesAutorise, quotaUtilisateursAtteint }
