// Sprint 19 — bootstrap manuel d'un Platform Admin. Volontairement UNIQUEMENT
// exécutable en ligne de commande, jamais via une route HTTP : c'est le
// point le plus sensible de tout le système (accès à toutes les
// organisations), il ne doit exister aucun chemin réseau pour créer ce rôle.
//
// Usage : node server/api/scripts/creerAdminPlateforme.js <email> <motdepasse> "<nom>"
const path = require('path')

async function main() {
  const [, , email, password, nom] = process.argv
  if (!email || !password || !nom) {
    console.error('Usage: node creerAdminPlateforme.js <email> <motdepasse> "<nom>"')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('Le mot de passe doit contenir au moins 8 caractères (compte à portée inter-organisations).')
    process.exit(1)
  }

  const pool = require(path.join(__dirname, '../../../db/pool'))
  const AuthService = require(path.join(__dirname, '../../../auth/AuthService'))

  const existant = await pool.query('SELECT id FROM admins_plateforme WHERE email = $1', [email])
  if (existant.rows.length) {
    console.error('Un Platform Admin avec cet email existe déjà.')
    process.exit(1)
  }

  const hash = await AuthService.hashPassword(password)
  const { rows: [admin] } = await pool.query(
    'INSERT INTO admins_plateforme (nom, email, password) VALUES ($1,$2,$3) RETURNING id, nom, email',
    [nom, email, hash]
  )
  console.log('✅ Platform Admin créé :', JSON.stringify(admin))
  await pool.end()
  process.exit(0)
}

main().catch(e => { console.error('Erreur:', e.message); process.exit(1) })
