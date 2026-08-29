// Conversion nombre -> lettres en francais, pour la ligne "Arretee a la
// somme de" des factures (modele professionnel demande par l'utilisateur).
// Gere les cas irreguliers du francais : soixante-dix/quatre-vingt(s)/
// quatre-vingt-dix, l'accord de "cent(s)" et "quatre-vingt(s)" (perdent leur
// s final uniquement quand ils sont le tout dernier mot du nombre — jamais
// quand suivis de "mille"/"million"/"milliard", ex. "quatre-vingt mille"
// sans s), "mille" invariable et jamais precede de "un", et "et" uniquement
// devant un/onze en fin de dizaine (vingt-et-un, soixante-et-onze).
const UNITES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']

// Convertit un nombre de 0 a 99. estTerminal : ce segment est-il le tout
// dernier mot du nombre complet (rien apres, pas meme "mille") ? Seul ce
// cas autorise le "s" de "quatre-vingts".
function convertirDizaines(n, estTerminal) {
  if (n < 20) return UNITES[n]
  if (n < 70) {
    const dizaine = Math.floor(n / 10)
    const unite = n % 10
    if (unite === 0) return DIZAINES[dizaine]
    if (unite === 1) return `${DIZAINES[dizaine]}-et-un`
    return `${DIZAINES[dizaine]}-${UNITES[unite]}`
  }
  // 70-79 : soixante + (dix..dix-neuf)
  if (n < 80) {
    const reste = n - 60
    return reste === 11 ? 'soixante-et-onze' : `soixante-${UNITES[reste]}`
  }
  // 80-99 : quatre-vingt(s) + unite/dix..dix-neuf
  const reste = n - 80
  if (reste === 0) return estTerminal ? 'quatre-vingts' : 'quatre-vingt'
  return `quatre-vingt-${UNITES[reste]}`
}

// Convertit un nombre de 0 a 999.
function convertirCentaine(n, estTerminal) {
  const centaines = Math.floor(n / 100)
  const reste = n % 100
  let mots = ''
  if (centaines > 0) {
    mots += centaines === 1 ? 'cent' : `${UNITES[centaines]} cent`
    if (reste === 0 && centaines > 1 && estTerminal) mots += 's' // "deux cents" mais "deux cent un"/"deux cent mille"
    if (reste > 0) mots += ' '
  }
  if (reste > 0) mots += convertirDizaines(reste, estTerminal)
  return mots
}

// Convertit un entier positif en toutes lettres (francais). Seul le tout
// dernier segment non nul (milliards > millions > mille > unites, dans cet
// ordre) peut recevoir l'accord "s" — "mille" et "million(s)" s'intercalent
// toujours entre un segment et le suivant, donc un segment suivi de l'un de
// ces mots n'est jamais terminal.
function nombreEnLettres(nombre) {
  const n = Math.round(Math.abs(nombre))
  if (n === 0) return 'zéro'

  const milliards = Math.floor(n / 1_000_000_000)
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000)
  const milliers = Math.floor((n % 1_000_000) / 1000)
  const unites = n % 1000

  const parties = []
  if (milliards > 0) {
    parties.push(milliards === 1 ? 'un milliard' : `${convertirCentaine(milliards, false)} milliards`)
  }
  if (millions > 0) {
    parties.push(millions === 1 ? 'un million' : `${convertirCentaine(millions, false)} millions`)
  }
  if (milliers > 0) {
    parties.push(milliers === 1 ? 'mille' : `${convertirCentaine(milliers, false)} mille`)
  }
  if (unites > 0) {
    parties.push(convertirCentaine(unites, true))
  }
  return parties.join(' ')
}

// Formate directement pour la ligne "Arretee a la somme de" d'une facture.
export function montantEnLettresFCFA(montant) {
  const texte = nombreEnLettres(montant)
  return `${texte.charAt(0).toUpperCase()}${texte.slice(1)} francs CFA`
}

export default nombreEnLettres
