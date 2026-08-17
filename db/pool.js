const { Pool } = require('pg')
const { getDbConfigPath } = require('../config/paths')

let config
try {
  config = require(getDbConfigPath())
} catch (e) {
  console.error('❌ Fichier config/db.config.json manquant. Copiez db.config.example.json et configurez-le.')
  process.exit(1)
}

const pool = new Pool({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.database,
  ssl: false,
  max: 10,
  min: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  allowExitOnIdle: false
})

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message)
})

module.exports = pool
