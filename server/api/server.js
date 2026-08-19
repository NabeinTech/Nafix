// Sprint 15 — point d'entrée du process API SaaS, hors Electron. Démarré
// séparément du Desktop (npm run api), jamais par main.js.
const { creerApp } = require('./app')

const PORT = process.env.PORT || 3001
const app = creerApp()

app.listen(PORT, () => {
  console.log(`API Nafix démarrée sur le port ${PORT}`)
})
