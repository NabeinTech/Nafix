// Recherche floue légère, sans dépendance externe — sert à faire correspondre
// un nom prononcé ("Mamadou", "sacs de ciment") à un enregistrement existant
// (client, produit) malgré une formulation approximative ou une transcription
// vocale imparfaite. Score par chevauchement de mots + sous-chaîne, pas de
// vraie distance de Levenshtein (suffisant pour des noms courts en français).

function normaliser(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function motsSignificatifs(s) {
  const MOTS_VIDES = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'un', 'une', 'et', 'à', 'a'])
  return normaliser(s).split(' ').filter(m => m.length > 1 && !MOTS_VIDES.has(m))
}

// Score de 0 à 1 entre une requête et un texte candidat.
function scorer(requete, candidat) {
  const rNorm = normaliser(requete)
  const cNorm = normaliser(candidat)
  if (!rNorm || !cNorm) return 0
  if (rNorm === cNorm) return 1
  if (cNorm.includes(rNorm) || rNorm.includes(cNorm)) return 0.85

  const rMots = motsSignificatifs(requete)
  const cMots = motsSignificatifs(candidat)
  if (rMots.length === 0 || cMots.length === 0) return 0

  let correspondances = 0
  for (const rm of rMots) {
    if (cMots.some(cm => cm === rm || cm.startsWith(rm) || rm.startsWith(cm))) {
      correspondances++
    }
  }
  return correspondances / Math.max(rMots.length, cMots.length)
}

// Cherche les meilleures correspondances d'une requête dans une liste
// d'objets, en comparant contre `keyFn(item)`. Retourne un tableau trié
// (meilleur score d'abord), chaque entrée = { item, score }.
export function chercherCorrespondances(requete, liste, keyFn, { seuil = 0.34, max = 5 } = {}) {
  if (!requete || !Array.isArray(liste)) return []
  return liste
    .map(item => ({ item, score: scorer(requete, keyFn(item)) }))
    .filter(r => r.score >= seuil)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
}

// Raccourci : renvoie la meilleure correspondance seule (ou null), ainsi
// qu'un indicateur "ambigu" si plusieurs candidats ont un score très proche
// du meilleur (le parseur doit alors demander confirmation plutôt que
// deviner silencieusement).
export function meilleureCorrespondance(requete, liste, keyFn, options) {
  const resultats = chercherCorrespondances(requete, liste, keyFn, options)
  if (resultats.length === 0) return { match: null, ambigu: false, alternatives: [] }
  const [meilleur, ...reste] = resultats
  const ambigu = reste.length > 0 && (meilleur.score - reste[0].score) < 0.12
  return {
    match: meilleur.item,
    score: meilleur.score,
    ambigu,
    alternatives: ambigu ? resultats.slice(0, 3).map(r => r.item) : []
  }
}
