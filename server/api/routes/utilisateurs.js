// Chantier web-shim — équivalent HTTP des canaux IPC utilisateurs:* de
// main.js (lignes 961-997), miroir exact : mêmes DAO, mêmes rôles autorisés
// (core/services/permissionsService.js, réutilisé sans duplication via
// middleware/rbac.js), aucune nouvelle logique métier.
const express = require('express')
const UtilisateursDAO = require('../../../dao/UtilisateursDAO')
const invitationsService = require('../../../core/services/invitationsService')
const { authentifier } = require('../middleware/authentification')
const { verifierAbonnement } = require('../middleware/subscriptionGate')
const { exigerRole } = require('../middleware/rbac')
const { validerEntree, messageErreurSur } = require('../../../core/validation')

const router = express.Router()
router.use(authentifier)
router.use(verifierAbonnement)

router.get('/', exigerRole('utilisateurs:getAll'), async (req, res) => {
  res.json(await UtilisateursDAO.getAll(req.tenantContext.organisationId))
})

router.post('/', exigerRole('utilisateurs:create'), async (req, res) => {
  try {
    validerEntree(req.body, {
      username: { required: true, type: 'string', maxLen: 100 },
      password: { required: true, type: 'string', maxLen: 200 },
      role:     { required: true, type: 'string', enum: ['administrateur', 'gerant', 'comptable', 'caissier'] },
      email:    { type: 'email', maxLen: 200 }
    })
    const resultat = await UtilisateursDAO.create(req.body, req.tenantContext.organisationId)
    if (resultat?.erreur) return res.status(400).json(resultat)
    res.status(201).json(resultat)
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})

router.delete('/:id', exigerRole('utilisateurs:delete'), async (req, res) => {
  res.json(await UtilisateursDAO.delete(req.params.id, req.tenantContext.organisationId))
})

// Chantier invitations d'equipe — reutilise les memes permissions que la
// creation/suppression directe (inviter/annuler une invitation est une
// variante de creer/supprimer un utilisateur, pas une action distincte).
router.post('/inviter', exigerRole('utilisateurs:create'), async (req, res) => {
  try {
    validerEntree(req.body, {
      email: { required: true, type: 'email', maxLen: 200 },
      role:  { required: true, type: 'string', enum: ['administrateur', 'gerant', 'comptable', 'caissier'] }
    })
    const resultat = await invitationsService.inviter({
      organisationId: req.tenantContext.organisationId,
      email: req.body.email,
      role: req.body.role,
      inviteParId: req.tenantContext.userId
    })
    if (resultat.erreur) return res.status(400).json(resultat)
    res.status(201).json(resultat)
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})

router.get('/invitations', exigerRole('utilisateurs:getAll'), async (req, res) => {
  res.json(await invitationsService.getEnAttente(req.tenantContext.organisationId))
})

router.delete('/invitations/:id', exigerRole('utilisateurs:delete'), async (req, res) => {
  await invitationsService.annuler(req.params.id, req.tenantContext.organisationId)
  res.json({ succes: true })
})

router.put('/:id/password', exigerRole('utilisateurs:updatePassword'), async (req, res) => {
  try {
    validerEntree(req.body, { password: { required: true, type: 'string', maxLen: 200 } })
    res.json(await UtilisateursDAO.updatePassword(req.params.id, req.body.password, req.tenantContext.organisationId))
  } catch (e) {
    res.status(400).json({ erreur: messageErreurSur(e) })
  }
})

router.put('/:id/role', exigerRole('utilisateurs:updateRole'), async (req, res) => {
  const resultat = await UtilisateursDAO.updateRole(req.params.id, req.body?.role, req.tenantContext.organisationId)
  if (resultat?.erreur) return res.status(400).json(resultat)
  res.json(resultat)
})

router.put('/:id/permissions', exigerRole('utilisateurs:updatePermissions'), async (req, res) => {
  // Audit securite — aucune validation auparavant (colonne JSONB purement
  // d'affichage cote UI, jamais lue par le RBAC serveur, donc pas un vecteur
  // d'elevation de privileges) : garde-fou minimal de forme/taille tout de
  // meme, plutot que d'accepter n'importe quelle valeur telle quelle.
  const permissions = req.body?.permissions
  if (typeof permissions !== 'object' || permissions === null || Array.isArray(permissions)) {
    return res.status(400).json({ erreur: 'permissions: doit être un objet' })
  }
  if (JSON.stringify(permissions).length > 10000) {
    return res.status(400).json({ erreur: 'permissions: trop volumineux' })
  }
  res.json(await UtilisateursDAO.updatePermissions(req.params.id, permissions, req.tenantContext.organisationId))
})

module.exports = router
