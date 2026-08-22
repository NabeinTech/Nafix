// Validation d'entrée pour l'API HTTP (server/api/routes/*.js) — mêmes
// règles et mêmes messages que validateIPC (main.js), pour rester cohérent
// avec ce que le Desktop applique déjà à ses handlers IPC. Dupliqué plutôt
// que réutilisé directement pour ne pas toucher le validateIPC de main.js,
// déjà testé sur ~15 handlers Desktop — le risque de régression dépasserait
// le bénéfice d'éviter une quinzaine de lignes en double.
function validerEntree(data, rules) {
  for (const [field, rule] of Object.entries(rules)) {
    const val = data?.[field]
    const absent = val === null || val === undefined || val === ''
    if (rule.required && absent) throw new Error(`Champ requis manquant: ${field}`)
    if (!absent) {
      if (rule.type && rule.type !== 'email' && typeof val !== rule.type) throw new Error(`${field}: type invalide`)
      if (rule.type === 'number' && (!isFinite(val) || isNaN(val))) throw new Error(`${field}: nombre invalide`)
      if (rule.type === 'email' && (typeof val !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))) throw new Error(`${field}: email invalide`)
      if (rule.min !== undefined && val < rule.min) throw new Error(`${field}: valeur trop petite (min ${rule.min})`)
      if (rule.maxLen && typeof val === 'string' && val.length > rule.maxLen) throw new Error(`${field}: texte trop long`)
      if (rule.enum && !rule.enum.includes(val)) throw new Error(`${field}: valeur non autorisée`)
    }
  }
}

module.exports = { validerEntree }
