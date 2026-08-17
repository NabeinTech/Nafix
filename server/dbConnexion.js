const net = require('net')

const DB_USER = 'admin'
const DB_PASSWORD = '9292'
const DB_NAME = 'nafix_db'
const DEFAULT_PORT = 5432

function testConnection(host, port) {
  return new Promise(resolve => {
    const socket = new net.Socket()
    const done = ok => { socket.destroy(); resolve(ok) }
    socket.setTimeout(4000)
    socket.once('connect', () => done(true))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(false))
    socket.connect(port, host)
  })
}

// PostgreSQL est installé manuellement (voir INSTALLATION.md) — le port est
// en général 5432, mais on sonde une petite plage au cas où un autre service
// occupe déjà ce port sur la machine hôte.
async function detecterPort(host) {
  for (let p = DEFAULT_PORT; p < DEFAULT_PORT + 6; p++) {
    if (await testConnection(host, p)) return p
  }
  return null
}

module.exports = { testConnection, detecterPort, DB_USER, DB_PASSWORD, DB_NAME }
