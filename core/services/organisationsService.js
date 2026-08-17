// Sprint 1 — Fondation multi-tenant. Une installation Desktop n'a aujourd'hui
// qu'une seule organisation active à la fois : cette fonction la résout
// explicitement (jamais via une variable globale cachée), pour que
// main.js puisse la transmettre en paramètre à chaque appel de service.

const pool = require('../../db/pool')

async function getOrganisationActive() {
  const { rows } = await pool.query(
    "SELECT id, nom, code, statut FROM organisations WHERE statut = 'active' ORDER BY id LIMIT 1"
  )
  return rows[0] || null
}

module.exports = { getOrganisationActive }
