// Conversion des nombres écrits en toutes lettres (français) vers des chiffres —
// utilisé par le moteur de commande vocale (voiceCommandParser) pour que
// « trois ordinateurs à trois cent mille francs » soit compris comme
// « 3 ordinateurs à 300000 francs », exactement comme la version déjà en
// chiffres. Aucune dépendance externe — pur JS, calcul déterministe.

const UNITES = {
  'zéro': 0, 'zero': 0, 'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4,
  'cinq': 5, 'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10,
  'onze': 11, 'douze': 12, 'treize': 13, 'quatorze': 14, 'quinze': 15, 'seize': 16,
  'vingt': 20, 'trente': 30, 'quarante': 40, 'cinquante': 50, 'soixante': 60,
  // Idiome français : « quatre-vingt » = 4×20, pas 4+20 — normalisé en un seul
  // mot avant tokenisation (voir normaliserQuatreVingt) pour éviter l'ambiguïté.
  'quatrevingt': 80, 'quatrevingts': 80
}

const MULTIPLICATEURS = {
  'cent': 100, 'cents': 100,
  'mille': 1000,
  'million': 1000000, 'millions': 1000000,
  'milliard': 1000000000, 'milliards': 1000000000
}

const CONNECTEUR = 'et'

function normaliserQuatreVingt(texte) {
  return texte.replace(/quatre[-\s]vingts?/gi, (m) => m.toLowerCase().includes('vingts') ? 'quatrevingts' : 'quatrevingt')
}

function estMotNombre(mot) {
  const m = mot.toLowerCase()
  return m in UNITES || m in MULTIPLICATEURS
}

// Calcule la valeur numérique d'une suite de mots-nombres français
// (algorithme d'accumulation standard : unités s'additionnent, "cent"
// multiplie l'accumulateur courant, "mille"/"million"/"milliard" ferment
// un groupe et l'ajoutent au total).
function calculerValeur(mots) {
  let total = 0
  let courant = 0
  for (const motBrut of mots) {
    const mot = motBrut.toLowerCase()
    if (mot === CONNECTEUR) continue
    if (mot in UNITES) {
      courant += UNITES[mot]
    } else if (mot === 'cent' || mot === 'cents') {
      courant = courant === 0 ? 100 : courant * 100
    } else if (mot in MULTIPLICATEURS) {
      total += (courant || 1) * MULTIPLICATEURS[mot]
      courant = 0
    }
  }
  return total + courant
}

// Remplace, dans le texte original, chaque suite de mots-nombres par sa
// valeur en chiffres — laisse le reste du texte (noms de produits, client,
// "à", "francs"...) intact, pour que le parseur d'intentions n'ait ensuite
// qu'à reconnaître des chiffres, jamais des mots.
export function convertirNombresEnChiffres(texte) {
  if (!texte) return texte
  const normalise = normaliserQuatreVingt(texte)
  const tokens = normalise.split(/(\s+)/) // garde les espaces pour reconstruire le texte
  const motsIndex = tokens
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !/^\s*$/.test(t))

  const resultat = [...tokens]
  let i = 0
  while (i < motsIndex.length) {
    const { t: mot } = motsIndex[i]
    if (!estMotNombre(mot)) { i++; continue }

    // Étendre la suite de mots-nombres consécutifs (autorise "et" au milieu
    // uniquement s'il relie deux mots-nombres, ex: "vingt et un").
    let j = i
    const groupe = []
    while (j < motsIndex.length) {
      const courant = motsIndex[j].t
      if (estMotNombre(courant)) {
        groupe.push(motsIndex[j])
        j++
      } else if (courant.toLowerCase() === CONNECTEUR &&
                 j + 1 < motsIndex.length && estMotNombre(motsIndex[j + 1].t)) {
        groupe.push(motsIndex[j]) // le "et"
        j++
      } else {
        break
      }
    }

    const valeur = calculerValeur(groupe.map(g => g.t))
    // Remplace le premier token du groupe par la valeur, vide les suivants.
    resultat[groupe[0].i] = String(valeur)
    for (let k = 1; k < groupe.length; k++) resultat[groupe[k].i] = ''
    // Nettoie les espaces devenus superflus entre les tokens vidés.
    for (let k = 0; k < groupe.length - 1; k++) {
      const between = groupe[k].i + 1
      if (resultat[between] !== undefined) resultat[between] = ''
    }

    i = j
  }

  return resultat.join('').replace(/\s{2,}/g, ' ').trim()
}

// Convertit une expression isolée ("trois cent mille") en nombre — utile
// hors contexte de phrase complète.
export function motsVersNombre(expression) {
  if (!expression) return null
  const converti = convertirNombresEnChiffres(expression)
  const n = parseFloat(converti.replace(/\s/g, ''))
  return isNaN(n) ? null : n
}
