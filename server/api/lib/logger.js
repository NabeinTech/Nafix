// Sprint 20 — logs structurés (JSON, une ligne par événement) vers
// stdout/stderr. Volontairement PAS de fichier local (contrairement à
// server/errorLogger.js, pensé pour un poste Desktop unique et dépendant
// d'Electron/app.getPath) : un process serveur doit logger sur stdout/stderr
// et laisser l'environnement d'exécution (systemd, Docker, PM2, plateforme
// cloud...) capturer et router les logs — principe 12-factor, évite de
// choisir une destination de logs prématurément (cf. audit Sprint 13 §L :
// "ne choisis pas encore un fournisseur cloud précis").
function ecrireLog(niveau, message, details) {
  const ligne = JSON.stringify({
    horodatage: new Date().toISOString(),
    niveau,
    message,
    ...(details || {})
  })
  if (niveau === 'erreur') process.stderr.write(ligne + '\n')
  else process.stdout.write(ligne + '\n')
}

module.exports = {
  info: (message, details) => ecrireLog('info', message, details),
  avertissement: (message, details) => ecrireLog('avertissement', message, details),
  erreur: (message, details) => ecrireLog('erreur', message, details)
}
