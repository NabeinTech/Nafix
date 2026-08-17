// Journal local des erreurs non interceptées — même principe que
// journaliserImpression() dans main.js : un fichier append dans userData,
// sans dépendance externe (aucun service tiers, aucune donnée envoyée hors poste).

const path = require('path')
const fs = require('fs')
const { app } = require('electron')

function journaliserErreur({ source, message, stack, utilisateur }) {
  try {
    const cheminJournal = path.join(app.getPath('userData'), 'erreurs.log')
    const ligne = JSON.stringify({
      date: new Date().toISOString(),
      source: source || 'inconnue',
      message: message || '',
      stack: stack || '',
      utilisateur: utilisateur || null
    }) + '\n'
    fs.appendFileSync(cheminJournal, ligne, 'utf8')
  } catch (err) {
    console.error('Journal erreurs — échec écriture :', err.message)
  }
}

module.exports = { journaliserErreur }
