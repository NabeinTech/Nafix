// Contrôle d'accès côté serveur pour un sous-ensemble d'actions
// particulièrement sensibles (RBAC IPC/API, Sprint 0). Volontairement
// distinct de src/utils/permissions.js (ES modules, non requérable depuis
// ce fichier CommonJS) — les deux ne couvrent pas le même besoin, ce n'est
// pas une duplication à corriger : permissions.js pilote l'affichage côté
// UI (routes/modules visibles, permissions personnalisées par
// utilisateur) ; CANAUX_RESTREINTS ci-dessous est un garde-fou de sécurité
// pour une liste précise d'actions sensibles, appliqué indépendamment de ce
// que montre l'interface. Chacune de ces actions n'est, côté UI, jamais
// accessible en dehors de l'onglet Paramètres, réservé à administrateur —
// la cohérence entre les deux fichiers est vérifiée automatiquement par
// permissionsService.reconciliation.test.js (pas par une fusion technique
// des deux systèmes ES modules/CommonJS, qui resterait à part entière un
// changement d'architecture hors de ce périmètre).

const CANAUX_RESTREINTS = {
  'db:reinitialiser': ['administrateur'],
  'utilisateurs:create': ['administrateur'],
  'utilisateurs:delete': ['administrateur'],
  'utilisateurs:updatePassword': ['administrateur'],
  'utilisateurs:updateRole': ['administrateur'],
  'utilisateurs:updatePermissions': ['administrateur'],
  'parametres:save': ['administrateur'],
  'parametres:exporterSauvegarde': ['administrateur'],
  'organisations:update': ['administrateur'],
  'organisations:setStatut': ['administrateur'],
  // Sprint 6, Partie A — les 3 canaux suivants n'avaient aucune vérification
  // RBAC côté IPC alors que leur seul appelant légitime (l'onglet Paramètres)
  // est déjà réservé à l'administrateur côté UI. Défense en profondeur :
  // un appel IPC direct depuis un autre rôle était jusqu'ici possible.
  'domaine:save': ['administrateur'],
  'utilisateurs:getAll': ['administrateur'],
  'db:getStats': ['administrateur'],
  // Sprint 9 — même protection que l'export qu'il remplace en partie.
  'parametres:importerSauvegarde': ['administrateur'],
  // Sprint 12 — création d'une organisation supplémentaire par un admin déjà
  // connecté (scénario franchise/multi-boutique) ; à distinguer du canal
  // organisations:creerAvecAdmin (Sprint 11), volontairement sans RBAC car
  // appelé avant toute session, depuis l'écran de connexion.
  'organisations:creerOrganisation': ['administrateur'],
  // Chantier PayDunya — creation d'une facture de paiement d'abonnement,
  // action de facturation reservee a l'administrateur comme le reste de ce
  // module (ne fait jamais passer abonnements.statut a 'actif' elle-meme —
  // voir server/api/routes/abonnement.js et core/services/paydunyaService.js).
  'abonnement:payer': ['administrateur']
}

function verifierPermission(canal, utilisateurConnecte) {
  const rolesAutorises = CANAUX_RESTREINTS[canal]
  if (!rolesAutorises) return

  if (!utilisateurConnecte) {
    throw new Error('Action non autorisée : aucune session active.')
  }
  if (!rolesAutorises.includes(utilisateurConnecte.role)) {
    throw new Error('Action non autorisée pour votre rôle.')
  }
}

module.exports = { verifierPermission, CANAUX_RESTREINTS }
