// Sprint 19 — émission/vérification des tokens Platform Admin. Structurellement
// séparé de tokenService.js (Sprint 14) : table dédiée (admins_plateforme,
// refresh_tokens_plateforme), claim "type" incompatible (jamais 'access'),
// jamais de organisationId dans le payload. Un token émis ici est rejeté par
// authentification.js (org) exactement comme un token org est rejeté par
// authentifierPlateforme.js — les deux domaines de confiance ne se
// chevauchent à aucun point du code.
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const pool = require('../../../db/pool')
const AuthService = require('../../../auth/AuthService')

const DUREE_ACCESS_TOKEN = '15m'
const DUREE_REFRESH_TOKEN_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours — plus court que côté organisation (30j) : surface d'exposition réduite pour un compte à portée inter-organisations

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

function emettreAccessToken(adminPlateforme) {
  return jwt.sign(
    { sub: adminPlateforme.id, type: 'platform' }, // jamais de organisationId ici, par construction
    getSecret(),
    { expiresIn: DUREE_ACCESS_TOKEN }
  )
}

function verifierAccessToken(token) {
  const payload = jwt.verify(token, getSecret())
  if (payload.type !== 'platform') throw new Error('Type de token invalide')
  return payload
}

async function emettreRefreshToken(adminPlateformeId, remplaceId = null) {
  const tokenClair = genererTokenOpaque()
  const tokenHash = hasherToken(tokenClair)
  const expireLe = new Date(Date.now() + DUREE_REFRESH_TOKEN_MS)
  const { rows: [ligne] } = await pool.query(
    'INSERT INTO refresh_tokens_plateforme (admin_plateforme_id, token_hash, expire_le) VALUES ($1,$2,$3) RETURNING id',
    [adminPlateformeId, tokenHash, expireLe]
  )
  if (remplaceId) {
    await pool.query('UPDATE refresh_tokens_plateforme SET revoque = 1, remplace_par = $1 WHERE id = $2', [ligne.id, remplaceId])
  }
  return tokenClair
}

async function connexion(email, password) {
  const { rows: [admin] } = await pool.query('SELECT * FROM admins_plateforme WHERE email = $1', [email])
  if (!admin) return { erreur: 'Identifiants incorrects' }
  if (!admin.actif) return { erreur: 'Compte désactivé' }

  const motDePasseOk = await AuthService.verifyPassword(password, admin.password)
  if (!motDePasseOk) return { erreur: 'Identifiants incorrects' }

  const accessToken = emettreAccessToken(admin)
  const refreshToken = await emettreRefreshToken(admin.id)
  return { succes: { accessToken, refreshToken, admin: { id: admin.id, nom: admin.nom, email: admin.email } } }
}

async function rafraichir(refreshTokenClair) {
  const tokenHash = hasherToken(refreshTokenClair)
  const { rows: [ligne] } = await pool.query('SELECT * FROM refresh_tokens_plateforme WHERE token_hash = $1', [tokenHash])
  if (!ligne) return { erreur: 'Refresh token invalide' }

  if (ligne.revoque) {
    await pool.query('UPDATE refresh_tokens_plateforme SET revoque = 1 WHERE admin_plateforme_id = $1 AND revoque = 0', [ligne.admin_plateforme_id])
    return { erreur: 'Refresh token déjà utilisé — toutes les sessions ont été révoquées par sécurité' }
  }
  if (new Date(ligne.expire_le) < new Date()) return { erreur: 'Refresh token expiré' }

  const { rows: [admin] } = await pool.query('SELECT id, nom, email, actif FROM admins_plateforme WHERE id = $1', [ligne.admin_plateforme_id])
  if (!admin || !admin.actif) return { erreur: 'Compte introuvable ou désactivé' }

  const accessToken = emettreAccessToken(admin)
  const refreshToken = await emettreRefreshToken(admin.id, ligne.id)
  return { succes: { accessToken, refreshToken } }
}

async function deconnexion(refreshTokenClair) {
  const tokenHash = hasherToken(refreshTokenClair)
  await pool.query('UPDATE refresh_tokens_plateforme SET revoque = 1 WHERE token_hash = $1', [tokenHash])
  return { succes: true }
}

module.exports = { connexion, rafraichir, deconnexion, emettreAccessToken, verifierAccessToken }
