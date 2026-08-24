const { Pool } = require('pg')

const OPTIONS_COMMUNES = {
  max: 10,
  min: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  allowExitOnIdle: false
}

// Audit du 22/08/2026 — ssl était figé à false pour TOUS les modes, y
// compris DATABASE_URL/PGHOST (process API SaaS). Correct pour le mode
// Desktop (PostgreSQL sur le LAN du commerce, jamais exposé publiquement) ;
// dangereux pour le mode API si la base n'est pas jointe sur un réseau
// strictement privé — identifiants et données transiteraient en clair.
// rejectUnauthorized:false plutôt que true : les certificats des PostgreSQL
// managés (Railway compris) ne sont généralement pas signés par une autorité
// présente dans le magasin de confiance de Node — le chiffrement du canal
// est ce qu'on cherche ici, pas la validation de chaîne de certification.
// Désactivable explicitement via PGSSL=disable pour un déploiement sur
// réseau privé confirmé.
const SSL_CLOUD = process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false }

// Sprint 13 — deux modes de résolution de la configuration, sans rien changer
// au comportement Desktop existant :
// - Contexte Electron (process.versions.electron défini) : comportement
//   historique inchangé, via config/paths.js.
// - Hors Electron (futur process API SaaS) : variables d'environnement.
//   process.versions.electron est fiable pour cette distinction — un simple
//   `node script.js` hors Electron ne l'a jamais, contrairement à un script
//   exécuté via electron.cmd (même en mode "node pur" ELECTRON_RUN_AS_NODE).
let poolConfig

if (process.versions.electron) {
  const { getDbConfigPath } = require('../config/paths')
  let config
  try {
    config = require(getDbConfigPath())
  } catch (e) {
    console.error('❌ Fichier config/db.config.json manquant. Copiez db.config.example.json et configurez-le.')
    process.exit(1)
  }
  poolConfig = {
    host: config.host, port: config.port, user: config.user,
    password: config.password, database: config.database,
    ssl: false, ...OPTIONS_COMMUNES
  }
} else if (process.env.DATABASE_URL) {
  poolConfig = { connectionString: process.env.DATABASE_URL, ssl: SSL_CLOUD, ...OPTIONS_COMMUNES }
} else if (process.env.PGHOST) {
  poolConfig = {
    host: process.env.PGHOST,
    port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: SSL_CLOUD, ...OPTIONS_COMMUNES
  }
} else {
  console.error('❌ Configuration PostgreSQL introuvable (ni contexte Electron, ni DATABASE_URL, ni PGHOST/PGUSER/PGPASSWORD/PGDATABASE).')
  process.exit(1)
}

const pool = new Pool(poolConfig)

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message)
})

module.exports = pool
