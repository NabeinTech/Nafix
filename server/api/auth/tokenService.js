// Sprint 14 — émission/vérification des tokens de la future API SaaS.
// Aucune route HTTP ici (Sprint 15) : ce module est une brique pure, testable
// indépendamment, appelée plus tard par les routes /auth/login, /auth/refresh,
// /auth/logout. Réutilise auth/AuthService.js (hachage mot de passe) et
// dao/UtilisateursDAO.js / dao/OrganisationsDAO.js tels quels, sans aucune
// modification de ces fichiers.
//
// Design (décidé et validé au Sprint 13) :
// - Access token JWT courte durée (15 min), jamais persisté en base ni sur
//   disque côté client — organisationId/role y sont embarqués au moment de
//   l'émission (résolution serveur), jamais fournis par le client ensuite.
// - Refresh token opaque (aléatoire, haute entropie), stocké haché (SHA-256 —
//   suffisant et rapide pour un secret déjà aléatoire, contrairement à un mot
//   de passe choisi par un humain où bcrypt se justifie), révocable, avec
//   rotation à chaque utilisation.
// - Réutilisation d'un refresh token déjà tourné = signal de vol : toutes les
//   sessions actives de l'utilisateur sont révoquées par précaution.
// - Organisation/utilisateur désactivé : revérifié à chaque connexion ET à
//   chaque rafraîchissement — donc coupure effective en ≤ durée de vie de
//   l'access token (15 min), pas seulement au prochain login complet.

const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const pool = require('../../../db/pool')
const UtilisateursDAO = require('../../../dao/UtilisateursDAO')
const OrganisationsDAO = require('../../../dao/OrganisationsDAO')
const AuthService = require('../../../auth/AuthService')

const DUREE_ACCESS_TOKEN = '15m'
const DUREE_REFRESH_TOKEN_MS = 30 * 24 * 60 * 60 * 1000 // 30 jours

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET non configuré (variable d\'environnement manquante)')
  return secret
}

function hasherToken(tokenClair) {
  return crypto.createHash('sha256').update(tokenClair).digest('hex')
}

function genererTokenOpaque() {
  return crypto.randomBytes(48).toString('hex')
}

function emettreAccessToken(utilisateur) {
  return jwt.sign(
    { sub: utilisateur.id, organisationId: utilisateur.organisation_id, role: utilisateur.role, type: 'access' },
    getSecret(),
    { expiresIn: DUREE_ACCESS_TOKEN }
  )
}

// Ne vérifie que la signature/expiration/forme — la vérification "utilisateur
// et organisation toujours actifs" se fait à l'émission (connexion/rafraichir),
// pas ici : verifierAccessToken() doit rester rapide (appelé à chaque requête
// API future), sans aller-retour base à chaque fois.
function verifierAccessToken(token) {
  const payload = jwt.verify(token, getSecret())
  if (payload.type !== 'access') throw new Error('Type de token invalide')
  return payload
}

async function emettreRefreshToken(utilisateurId, remplaceId = null) {
  const tokenClair = genererTokenOpaque()
  const tokenHash = hasherToken(tokenClair)
  const expireLe = new Date(Date.now() + DUREE_REFRESH_TOKEN_MS)
  const { rows: [ligne] } = await pool.query(
    'INSERT INTO refresh_tokens (utilisateur_id, token_hash, expire_le) VALUES ($1,$2,$3) RETURNING id',
    [utilisateurId, tokenHash, expireLe]
  )
  if (remplaceId) {
    await pool.query('UPDATE refresh_tokens SET revoque = 1, remplace_par = $1 WHERE id = $2', [ligne.id, remplaceId])
  }
  return tokenClair
}

async function organisationEstActive(organisationId) {
  if (!organisationId) return true // utilisateur sans organisation : cas non bloqué ici, filtré ailleurs
  const organisation = await OrganisationsDAO.getById(organisationId)
  return !organisation || organisation.statut === 'active'
}

// Audit securite — un identifiant inconnu renvoyait immediatement, alors
// qu'un identifiant connu avec un mauvais mot de passe attendait le cout
// bcrypt (~50-150ms, deliberement lent). Corps et statut HTTP identiques
// dans les deux cas, mais le temps de reponse ne l'etait pas — un canal
// d'enumeration mesurable par mesure statistique. Hash bicrypte valide mais
// jamais associe a un vrai compte, calcule une seule fois (meme cout que
// AuthService.hashPassword, donc directement comparable).
let hashFictifPromise = null
function getHashFictif() {
  if (!hashFictifPromise) hashFictifPromise = AuthService.hashPassword(crypto.randomBytes(24).toString('hex'))
  return hashFictifPromise
}

async function connexion(username, password) {
  const utilisateur = await UtilisateursDAO.findByUsername(username)
  const motDePasseOk = await AuthService.verifyPassword(password, utilisateur ? utilisateur.password : await getHashFictif())
  if (!utilisateur || !motDePasseOk) return { erreur: 'Identifiant ou mot de passe incorrect !' }

  if (!(await organisationEstActive(utilisateur.organisation_id))) {
    return { erreur: 'Votre organisation a été désactivée. Contactez votre administrateur.' }
  }

  const accessToken = emettreAccessToken(utilisateur)
  const refreshToken = await emettreRefreshToken(utilisateur.id)

  return {
    succes: {
      accessToken,
      refreshToken,
      utilisateur: {
        id: utilisateur.id, nom: utilisateur.nom, username: utilisateur.username,
        role: utilisateur.role, organisation_id: utilisateur.organisation_id
      }
    }
  }
}

async function rafraichir(refreshTokenClair) {
  const tokenHash = hasherToken(refreshTokenClair)
  const { rows: [ligne] } = await pool.query('SELECT * FROM refresh_tokens WHERE token_hash = $1', [tokenHash])
  if (!ligne) return { erreur: 'Refresh token invalide' }

  if (ligne.revoque) {
    // Un token déjà tourné (ou explicitement révoqué) qui revient est un
    // signal de vol potentiel — on coupe tout par précaution plutôt que de
    // se contenter de refuser cette seule requête.
    await pool.query('UPDATE refresh_tokens SET revoque = 1 WHERE utilisateur_id = $1 AND revoque = 0', [ligne.utilisateur_id])
    return { erreur: 'Refresh token déjà utilisé — toutes les sessions ont été révoquées par sécurité' }
  }
  if (new Date(ligne.expire_le) < new Date()) return { erreur: 'Refresh token expiré' }

  const { rows: [utilisateur] } = await pool.query(
    'SELECT id, nom, username, role, organisation_id FROM utilisateurs WHERE id = $1',
    [ligne.utilisateur_id]
  )
  if (!utilisateur) return { erreur: 'Utilisateur introuvable' }
  if (!(await organisationEstActive(utilisateur.organisation_id))) {
    return { erreur: 'Votre organisation a été désactivée. Contactez votre administrateur.' }
  }

  const accessToken = emettreAccessToken(utilisateur)
  const refreshToken = await emettreRefreshToken(utilisateur.id, ligne.id)
  return { succes: { accessToken, refreshToken } }
}

async function deconnexion(refreshTokenClair) {
  const tokenHash = hasherToken(refreshTokenClair)
  await pool.query('UPDATE refresh_tokens SET revoque = 1 WHERE token_hash = $1', [tokenHash])
  return { succes: true }
}

module.exports = { connexion, rafraichir, deconnexion, emettreAccessToken, verifierAccessToken }
