const path = require('path')
const fs = require('fs')
const os = require('os')
const net = require('net')
const crypto = require('crypto')
const { spawn, execFile } = require('child_process')
const { app } = require('electron')

const DB_USER = 'admin'
const DB_NAME = 'nafix_db'
const DEFAULT_PORT = 5432

// Avant ce correctif, toutes les installations utilisaient ce mot de passe
// fixe (identique sur chaque poste), ce qui permettait à quiconque sur le
// même réseau local — en mode "réseau ouvert" — de se connecter directement
// à PostgreSQL en contournant toute l'isolation applicative multi-tenant.
// Conservé uniquement en repli pour les installations déjà provisionnées
// avant ce correctif (leur instance PostgreSQL a réellement ce mot de passe
// et on ne peut pas le deviner autrement sans la reprovisionner).
const ANCIEN_MOT_DE_PASSE_PAR_DEFAUT = '9292'

// PostgreSQL est géré comme simple processus enfant de Nafix (pas de service
// Windows, pas d'élévation UAC en cours d'utilisation) — c'est le choix fait
// après plusieurs tentatives instables avec un service Windows.

function getBinDir() {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'postgres')
    : path.join(__dirname, '..', 'resources', 'postgres')
  return path.join(base, 'bin')
}

function getVcRedistPath() {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'vcredist')
    : path.join(__dirname, '..', 'resources', 'vcredist')
  return path.join(base, 'vc_redist.x64.exe')
}

function getDataDir() {
  return path.join(app.getPath('userData'), 'pgdata')
}

function isProvisioned() {
  return fs.existsSync(path.join(getDataDir(), 'PG_VERSION'))
}

// À côté de pgdata (pas dedans) : initdb attend un répertoire vide ou
// inexistant à sa première exécution, y créer ce fichier avant coup aurait
// fait échouer la provision. app.getPath('userData') existe déjà toujours
// (créé par Electron au démarrage), donc pas de mkdir nécessaire ici.
function getPasswordFilePath() {
  return path.join(app.getPath('userData'), '.nafix_admin_pw')
}

// Génère un mot de passe aléatoire à la toute première provision (persisté
// dans pgdata, comme le port l'est déjà dans postgresql.conf, pour rester
// récupérable même si config/db.config.json est perdu/supprimé). Pour une
// installation déjà provisionnée avant ce correctif (pas de fichier
// marqueur), on ne peut que retomber sur l'ancien mot de passe fixe.
function getOrCreatePassword(dejaProvisionne) {
  const pwPath = getPasswordFilePath()
  if (fs.existsSync(pwPath)) return fs.readFileSync(pwPath, 'utf8').trim()
  if (dejaProvisionne) return ANCIEN_MOT_DE_PASSE_PAR_DEFAUT
  const motDePasse = crypto.randomBytes(24).toString('hex')
  fs.writeFileSync(pwPath, motDePasse, 'utf8')
  return motDePasse
}

// Le port ne doit jamais changer une fois provisionné, sinon les postes
// clients déjà configurés perdent la connexion.
function getExistingPort() {
  const confPath = path.join(getDataDir(), 'postgresql.conf')
  if (!fs.existsSync(confPath)) return null
  const contenu = fs.readFileSync(confPath, 'utf8')
  const matches = [...contenu.matchAll(/^\s*port\s*=\s*(\d+)/gm)]
  return matches.length ? parseInt(matches[matches.length - 1][1], 10) : null
}

function getLocalNetwork() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return { ip: iface.address, cidr: iface.cidr }
      }
    }
  }
  return null
}

function isPortFree(port) {
  return new Promise(resolve => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port, '127.0.0.1')
  })
}

async function findFreePort() {
  for (let p = DEFAULT_PORT; p < DEFAULT_PORT + 6; p++) {
    if (await isPortFree(p)) return p
  }
  throw new Error('Aucun port disponible pour PostgreSQL (5432-5437 tous occupés)')
}

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

async function detecterPort(host) {
  for (let p = DEFAULT_PORT; p < DEFAULT_PORT + 6; p++) {
    if (await testConnection(host, p)) return p
  }
  return null
}

async function attendrePret(port, tentatives = 30, delaiMs = 500) {
  for (let i = 0; i < tentatives; i++) {
    if (await testConnection('127.0.0.1', port)) return true
    await new Promise(resolve => setTimeout(resolve, delaiMs))
  }
  return false
}

// Toute étape externe (binaire lancé, connexion réseau) est bornée dans le
// temps : un blocage inattendu doit se transformer en message d'erreur
// exploitable, jamais en attente indéfinie de l'assistant de configuration.
function execFileP(file, args, timeout = 60000) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message))
      resolve(stdout)
    })
  })
}

// Les binaires PostgreSQL nécessitent le runtime Visual C++. Installation
// silencieuse, sans effet si déjà présent. Non bloquant : si ce PC a déjà un
// runtime compatible, postgres.exe démarrera même si cette étape échoue.
async function installerVcRedistSiBesoin() {
  const vcPath = getVcRedistPath()
  if (!fs.existsSync(vcPath)) return
  await new Promise(resolve => {
    const enfant = spawn(vcPath, ['/install', '/quiet', '/norestart'], { windowsHide: true })
    const limite = setTimeout(() => { try { enfant.kill() } catch (_) {} ; resolve() }, 90000)
    enfant.on('exit', () => { clearTimeout(limite); resolve() })
    enfant.on('error', () => { clearTimeout(limite); resolve() })
  })
}

async function initialiser(port, network, reseauOuvert, password) {
  const dataDir = getDataDir()
  const binDir = getBinDir()
  const initdb = path.join(binDir, 'initdb.exe')

  fs.mkdirSync(dataDir, { recursive: true })
  const pwFile = path.join(app.getPath('temp'), `nafix_pg_pw_${Date.now()}.txt`)
  fs.writeFileSync(pwFile, password, 'utf8')
  try {
    await execFileP(initdb, ['-D', dataDir, '-U', DB_USER, `--pwfile=${pwFile}`, '--auth=scram-sha-256', '-E', 'UTF8'])
  } finally {
    try { fs.unlinkSync(pwFile) } catch (_) {}
  }

  // initdb génère déjà un postgresql.conf/pg_hba.conf par défaut adaptés à un
  // usage local (listen_addresses='localhost' implicite, règles 127.0.0.1/::1
  // déjà présentes) — on ne fait qu'ajouter ce qui manque.
  let confAjout = `\nport = ${port}\n`
  if (reseauOuvert) confAjout += `listen_addresses = '*'\n`
  fs.appendFileSync(path.join(dataDir, 'postgresql.conf'), confAjout, 'utf8')

  if (reseauOuvert && network) {
    fs.appendFileSync(
      path.join(dataDir, 'pg_hba.conf'),
      `host    ${DB_NAME}    ${DB_USER}    ${network.cidr}    scram-sha-256\n`,
      'utf8'
    )
  }
}

async function creerBaseEtRole(port, password) {
  const { Client } = require('pg')
  const client = new Client({
    host: '127.0.0.1',
    port,
    user: DB_USER,
    password,
    database: 'postgres',
    connectionTimeoutMillis: 10000,
    query_timeout: 10000
  })
  await client.connect()
  try {
    const existe = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME])
    if (!existe.rows.length) {
      await client.query(`CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}`)
    }
  } finally {
    await client.end()
  }
}

async function demarrer(port) {
  // Peut déjà tourner depuis un lancement précédent de Nafix (processus laissé
  // actif volontairement pour que les autres postes restent servis).
  if (await testConnection('127.0.0.1', port)) return true

  const dataDir = getDataDir()
  const pgCtl = path.join(getBinDir(), 'pg_ctl.exe')
  const logPath = path.join(dataDir, 'nafix_demarrage.log')

  // pg_ctl start (plutôt que lancer postgres.exe directement) configure
  // correctement le détachement de la console sous Windows — sans ça, chaque
  // nouvelle connexion à la base fait brièvement clignoter une fenêtre noire.
  await execFileP(pgCtl, ['start', '-D', dataDir, '-l', logPath, '-w', '-t', '30'])

  const pret = await attendrePret(port)
  if (!pret) throw new Error("PostgreSQL n'a pas démarré à temps sur ce PC.")
  return true
}

// Appelé au démarrage de Nafix quand ce poste gère sa propre base locale
// (mono-poste ou serveur multi-poste) : s'assure que PostgreSQL répond avant
// de continuer, en le (re)démarrant si besoin.
async function assurerDemarre() {
  if (!isProvisioned()) return null
  const port = getExistingPort()
  if (!port) return null
  await demarrer(port)
  return port
}

// Ouvre le port dans le pare-feu Windows — nécessite une seule élévation
// (UAC), demandée uniquement pour le mode serveur multi-poste. Le résultat
// (succès ou échec — UAC refusée, netsh en échec) est renvoyé à l'appelant
// pour être affiché dans l'interface, plutôt que d'être avalé silencieusement
// (un pare-feu non configuré rend le serveur injoignable sans aucun message
// à l'utilisateur, ce qui s'est déjà produit).
function ouvrirParefeu(port) {
  const sudo = require('sudo-prompt')
  const nomRegle = `Nafix PostgreSQL ${port}`
  const commande = `netsh advfirewall firewall show rule name="${nomRegle}" >nul 2>&1 || netsh advfirewall firewall add rule name="${nomRegle}" dir=in action=allow protocol=TCP localport=${port}`
  return new Promise(resolve => {
    sudo.exec(commande, { name: 'Nafix' }, (error) => resolve(!error))
  })
}

async function provisionner(reseauOuvert) {
  await installerVcRedistSiBesoin()

  const network = getLocalNetwork()
  if (reseauOuvert && !network) {
    throw new Error('Impossible de détecter une adresse réseau locale (connectez ce PC au réseau/Wi-Fi)')
  }

  const dejaProvisionne = isProvisioned()
  const port = (dejaProvisionne && getExistingPort()) || await findFreePort()
  const password = getOrCreatePassword(dejaProvisionne)

  if (!dejaProvisionne) {
    await initialiser(port, network, reseauOuvert, password)
  }

  await demarrer(port)
  await creerBaseEtRole(port, password)

  let parefeuOk = true
  if (reseauOuvert) {
    parefeuOk = await ouvrirParefeu(port)
  }

  return { port, ipLocale: network ? network.ip : null, parefeuOk, password }
}

// Permet de réessayer uniquement l'étape du pare-feu depuis l'interface,
// sans tout reprovisionner, quand la première tentative a échoué.
async function reessayerParefeu() {
  const port = getExistingPort()
  if (!port) throw new Error('PostgreSQL ne semble pas configuré sur ce poste.')
  return ouvrirParefeu(port)
}

module.exports = {
  provisionner,
  reessayerParefeu,
  assurerDemarre,
  testConnection,
  detecterPort,
  DB_USER,
  DB_NAME
}
