const path = require('path')
const fs = require('fs')
const { app } = require('electron')

// Nouvel emplacement (toujours accessible en écriture, même si l'app est
// installée sous Program Files) : le dossier de données utilisateur.
// Ancien emplacement (installations existantes, antérieures à l'assistant de
// configuration) : à côté de l'exécutable, sous resources/config — conservé
// en lecture pour ne pas casser les postes déjà configurés.
function getDbConfigPath() {
  if (!app.isPackaged) return path.join(__dirname, 'db.config.json')

  const userDataPath = path.join(app.getPath('userData'), 'db.config.json')
  if (fs.existsSync(userDataPath)) return userDataPath

  const legacyPath = path.join(process.resourcesPath, 'config', 'db.config.json')
  if (fs.existsSync(legacyPath)) return legacyPath

  return userDataPath
}

module.exports = { getDbConfigPath }
