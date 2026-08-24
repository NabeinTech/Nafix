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
    // Audit securite — deliberement PAS attendu, et l'echec est avale ici,
    // jamais propage a l'appelant. Deux raisons : (1) un Resend en panne/mal
    // configure ferait remonter une exception jusqu'a la route -> 500,
    // distinguable du 200 renvoye quand le compte n'existe pas, ce qui casse
    // la garantie anti-enumeration que cette fonction promet ; (2) attendre
    // l'appel HTTP sortant introduit un ecart de temps de reponse mesurable
    // entre "compte existe" et "compte inconnu" (celui-ci renvoie
    // immediatement) — meme avec un corps de reponse identique, ca reste un
    // canal d'enumeration. Ne pas attendre supprime ce canal pour la reponse
    // HTTP elle-meme.
    emailService.envoyerEmail({
      to: destinataire,
      subject: 'Réinitialisation de votre mot de passe Nafix',
      html: `<p>Bonjour ${utilisateur.nom},</p>
             <p>Cliquez sur ce lien pour choisir un nouveau mot de passe (valable 1 heure) :</p>
             <p><a href="${lien}">${lien}</a></p>
             <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe actuel reste inchangé.</p>`
    }).catch((e) => {
      console.error('Échec envoi email de réinitialisation :', e.message)
    })
  }

  return { succes: true }
}

async function reinitialiser(tokenClair, nouveauMotDePasse) {
  const tokenHash = crypto.createHash('sha256').update(tokenClair || '').digest('hex')
  const hash = await AuthService.hashPassword(nouveauMotDePasse)

  // Audit securite — la lecture du token se faisait avant la transaction,
  // sur une connexion separee, sans verrou : deux requetes concurrentes
  // rejouant le MEME token valide passaient toutes les deux le controle
  // "!ligne.utilise" avant qu'aucune n'ait commit, et changeaient toutes les
  // deux le mot de passe — un token cense etre a usage unique pouvait donc
  // servir deux fois. SELECT ... FOR UPDATE a l'interieur de la transaction
  // verrouille la ligne : une deuxieme requete concurrente attend que la
  // premiere commit, puis voit utilise=1 et est correctement rejetee.
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: [ligne] } = await client.query(
      'SELECT * FROM reinitialisations_mot_de_passe WHERE token_hash = $1 FOR UPDATE',
      [tokenHash]
    )
    if (!ligne || ligne.utilise || new Date(ligne.expire_le) < new Date()) {
      await client.query('ROLLBACK')
      return { erreur: 'Lien invalide ou expiré' }
    }

    await client.query('UPDATE utilisateurs SET password = $1 WHERE id = $2', [hash, ligne.utilisateur_id])
    await client.query('UPDATE reinitialisations_mot_de_passe SET utilise = 1 WHERE id = $1', [ligne.id])
    // Un reset de mot de passe doit fermer tous les acces existants — meme
    // principe que la detection de vol de refresh token (tokenService.js).
    await client.query('UPDATE refresh_tokens SET revoque = 1 WHERE utilisateur_id = $1 AND revoque = 0', [ligne.utilisateur_id])
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }

  return { succes: true }
}

module.exports = { demander, reinitialiser }
