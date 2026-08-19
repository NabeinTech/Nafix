// Sprint 14 — extraction du tenant context depuis un access token déjà
// vérifié (voir ../auth/tokenService.verifierAccessToken). Jamais depuis une
// valeur fournie par le client dans le corps/query/headers de la requête :
// organisationId est embarqué dans le token au moment de son émission
// (connexion/rafraîchissement, résolution serveur), jamais fourni par le
// client courant — même garantie que getOrganisationIdActive() côté Desktop
// (main.js), sur une source différente.
//
// Pas encore branché sur une route HTTP réelle (Sprint 15) : ce module reste
// une fonction pure, appelable indépendamment d'Express ou de tout framework.

function extraireTenantContext(payloadAccessToken) {
  if (!payloadAccessToken || !payloadAccessToken.organisationId) {
    throw new Error('Utilisateur sans organisation — accès refusé')
  }
  return {
    userId: payloadAccessToken.sub,
    organisationId: payloadAccessToken.organisationId,
    role: payloadAccessToken.role
  }
}

module.exports = { extraireTenantContext }
