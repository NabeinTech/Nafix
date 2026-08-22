// Chantier mot de passe oublie — demande + confirmation de reinitialisation.
// Meme conventions crypto que server/api/auth/tokenService.js (token opaque
// aleatoire, jamais stocke en clair, seulement son hash SHA-256) sans
// dependre de ce fichier directement (helpers courts, pas assez pour
// justifier un import croise entre deux domaines distincts : tokens de
// session vs reinitialisation de mot de passe).
const crypto = require('crypto')
const pool = require('../../db/pool')
const AuthService = require('../../auth/AuthService')
const emailService = require('./emailService')

const DUREE_TOKEN_MS = 60 * 60 * 1000 // 1h
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Ne renvoie jamais d'information sur l'existence d'un compte (anti-
// enumeration) : toujours { succes: true }, qu'un email ait ete envoye ou
// non.
async function demander(identifiant) {
  const { rows: [utilisateur] } = await pool.query(
    'SELECT id, nom, email, username FROM utilisateurs WHERE username = $1 OR email = $1',
    [identifiant]
  )

  // Repli pragmatique : un compte existant dont le username ressemble a un
  // email (cas reel constate : amina@nafix.digital, cree avant l'ajout de la
  // colonne email) recoit quand meme le lien, sans migration de donnees.
  const destinataire = utilisateur?.email || (utilisateur && REGEX_EMAIL.test(utilisateur.username) ? utilisateur.username : null)

  if (utilisateur && destinataire) {
    const tokenClair = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(tokenClair).digest('hex')
    await pool.query(
      'INSERT INTO reinitialisations_mot_de_passe (utilisateur_id, token_hash, expire_le) VALUES ($1,$2,$3)',
      [utilisateur.id, tokenHash, new Date(Date.now() + DUREE_TOKEN_MS)]
    )
    const lien = `${process.env.NAFIX_BASE_URL || 'https://nafix.digital'}/reinitialiser-mot-de-passe.html?token=${tokenClair}`
    await emailService.envoyerEmail({
      to: destinataire,
      subject: 'Réinitialisation de votre mot de passe Nafix',
      html: `<p>Bonjour ${utilisateur.nom},</p>
             <p>Cliquez sur ce lien pour choisir un nouveau mot de passe (valable 1 heure) :</p>
             <p><a href="${lien}">${lien}</a></p>
             <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe actuel reste inchangé.</p>`
    })
  }

  return { succes: true }
}

async function reinitialiser(tokenClair, nouveauMotDePasse) {
  const tokenHash = crypto.createHash('sha256').update(tokenClair || '').digest('hex')
  const { rows: [ligne] } = await pool.query('SELECT * FROM reinitialisations_mot_de_passe WHERE token_hash = $1', [tokenHash])
  if (!ligne || ligne.utilise || new Date(ligne.expire_le) < new Date()) {
    return { erreur: 'Lien invalide ou expiré' }
  }

  const hash = await AuthService.hashPassword(nouveauMotDePasse)
  await pool.query('UPDATE utilisateurs SET password = $1 WHERE id = $2', [hash, ligne.utilisateur_id])
  await pool.query('UPDATE reinitialisations_mot_de_passe SET utilise = 1 WHERE id = $1', [ligne.id])
  // Un reset de mot de passe doit fermer tous les acces existants — meme
  // principe que la detection de vol de refresh token (tokenService.js).
  await pool.query('UPDATE refresh_tokens SET revoque = 1 WHERE utilisateur_id = $1 AND revoque = 0', [ligne.utilisateur_id])

  return { succes: true }
}

module.exports = { demander, reinitialiser }
