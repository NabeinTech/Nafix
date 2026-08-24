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

// Audit final pre-production — les routes renvoient e.message tel quel dans
// leur catch(e), un pattern qui sert aussi bien les erreurs de validerEntree()
// ci-dessus que les erreurs metier deliberement levees par les services/DAO
// (ex. VentesDAO : "Quantité invalide pour le produit...", destine a etre lu
// par l'utilisateur - convention etablie dans tout le depot). Mais une vraie
// erreur du driver PostgreSQL (contrainte violee, type invalide...) passe par
// le meme chemin et fuit alors des details internes (noms de colonnes/tables/
// contraintes, moteur de BDD) au client HTTP. Distinction fiable : le driver
// pg pose toujours un e.code SQLSTATE (5 caracteres), qu'aucun `throw new
// Error(...)` applicatif ne pose jamais (verifie par recherche exhaustive
// dans le depot) — permet de filtrer sans casser les messages metier
// existants, qui restent inchanges.
function messageErreurSur(e) {
  if (e && typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code)) {
    return 'Requête invalide'
  }
  return e.message
}

module.exports = { validerEntree, messageErreurSur }
