// Moteur local de compréhension des commandes vocales pour Nafix Voice —
// 100% déterministe (aucun appel IA externe, aucune clé API), à base de
// motifs/mots-clés. Volontairement plus rigide qu'un LLM : phrases-types
// reconnues plutôt que compréhension totalement libre, en échange d'un
// fonctionnement gratuit et hors-ligne.
//
// Pipeline : texte brut → nombres en lettres convertis en chiffres → extraction
// intention/client/articles/remise → résolution floue contre les clients et
// produits existants → état structuré (jamais de calcul monétaire ici, voir
// voiceQuoteEngine.js pour les totaux — cette séparation reprend le schéma
// "Structured Command → Validation → Business Logic" demandé).

import { convertirNombresEnChiffres } from './frenchNumbers'
import { meilleureCorrespondance } from './fuzzyMatch'

const MOTS_CONFIRMATION = /^(oui|ok|okay|d'accord|daccord|confirme|confirmer|valide|valider|c'est bon|parfait|vas[- ]y|génère|genere|générer|generer)\b/i
const MOTS_ANNULATION = /^(non|annule|annuler|stop|arrête|arrete|laisse tomber)\b/i

const MOT_ORDINAL = {
  'premier': 0, 'première': 0, 'premiere': 0,
  'deuxième': 1, 'deuxieme': 1, 'second': 1, 'seconde': 1,
  'troisième': 2, 'troisieme': 2,
  'quatrième': 3, 'quatrieme': 3,
  'dernier': -1, 'dernière': -1, 'derniere': -1
}

export function etatInitial() {
  return {
    clientTexte: null, clientMatch: null, clientAmbigu: false, clientAlternatives: [],
    items: [],
    remisePourcent: 0,
    pretAGenerer: false,
    annule: false
  }
}

function extraireClient(texte) {
  const m = texte.match(/\bpour\s+(.+?)(?:[.,]|(?:\s+(?:il|elle|qui|veut|voudrait|souhaite|avec)\b)|$)/i)
  return m ? m[1].trim() : null
}

function extraireRemise(texte) {
  const m = texte.match(/remise\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*(?:%|pourcent|pour\s*cent)/i)
  return m ? parseFloat(m[1].replace(',', '.')) : null
}

function extraireArticles(texte) {
  const regex = /(\d+(?:[.,]\d+)?)\s+([a-zà-ÿ][a-zà-ÿ'\s-]*?)\s+(?:à|a)\s+(\d[\d\s]*)(?:\s*(?:francs?|fcfa|f\b))?/gi
  const resultats = []
  let m
  while ((m = regex.exec(texte)) !== null) {
    const quantite = parseFloat(m[1].replace(',', '.'))
    const produitTexte = m[2].trim()
    const prixUnitaire = parseFloat(m[3].replace(/\s/g, ''))
    if (quantite > 0 && prixUnitaire >= 0 && produitTexte) {
      resultats.push({ quantite, produitTexte, prixUnitaire })
    }
  }
  return resultats
}

function extraireSuppression(texte) {
  const m = texte.match(/\b(?:supprime|enlève|enleve|retire)\s+le\s+(\w+)\s+(?:produit|article)/i)
  if (!m) return null
  const cle = m[1].toLowerCase()
  return cle in MOT_ORDINAL ? MOT_ORDINAL[cle] : null
}

function resoudreProduit(produitTexte, produits) {
  return meilleureCorrespondance(
    produitTexte, produits,
    p => `${p.nom} ${p.categorie || ''} ${p.marque || ''}`.trim(),
    { seuil: 0.3 }
  )
}

function resoudreClient(clientTexte, clients) {
  if (!clientTexte) return { match: null, ambigu: false, alternatives: [] }
  return meilleureCorrespondance(clientTexte, clients, c => c.nom, { seuil: 0.34 })
}

// Analyse un tour de parole et fusionne le résultat dans l'état de la
// conversation en cours (permet le multi-tour : "Fais un devis pour Awa."
// → "Deux ordinateurs HP à 350000." → "Mets 5% de remise." → "Oui.")
export function analyserCommande(transcriptBrut, etatPrecedent, { clients = [], produits = [] } = {}) {
  const etat = { ...etatPrecedent, items: [...etatPrecedent.items] }
  const messages = []
  const texteConverti = convertirNombresEnChiffres(transcriptBrut || '')
  const texteCourt = texteConverti.trim()

  if (MOTS_CONFIRMATION.test(texteCourt)) {
    etat.pretAGenerer = true
    return { etat, messages: ['Compris, je prépare le document.'] }
  }
  if (MOTS_ANNULATION.test(texteCourt)) {
    etat.annule = true
    return { etat, messages: ['Annulé.'] }
  }

  const indexSuppr = extraireSuppression(texteConverti)
  if (indexSuppr !== null && etat.items.length > 0) {
    const idx = indexSuppr === -1 ? etat.items.length - 1 : indexSuppr
    const retire = etat.items[idx]
    if (retire) {
      etat.items = etat.items.filter((_, i) => i !== idx)
      messages.push(`Article retiré : ${retire.produitTexte}.`)
    }
    return { etat, messages }
  }

  const clientTexte = extraireClient(texteConverti)
  if (clientTexte) {
    const { match, ambigu, alternatives } = resoudreClient(clientTexte, clients)
    etat.clientTexte = clientTexte
    etat.clientMatch = match
    etat.clientAmbigu = ambigu
    etat.clientAlternatives = alternatives
    if (ambigu) {
      messages.push(`Plusieurs clients correspondent à « ${clientTexte} » : ${alternatives.map(a => a.nom).join(', ')}. Lequel ?`)
    } else if (match) {
      messages.push(`Client : ${match.nom}.`)
    } else {
      messages.push(`Je n'ai pas trouvé « ${clientTexte} » dans vos clients — le devis sera fait à ce nom directement.`)
    }
  }

  const remise = extraireRemise(texteConverti)
  if (remise !== null) {
    etat.remisePourcent = remise
    messages.push(`Remise appliquée : ${remise}%.`)
  }

  const articles = extraireArticles(texteConverti)
  for (const art of articles) {
    const { match, ambigu, alternatives } = resoudreProduit(art.produitTexte, produits)
    const item = {
      texteBrut: art.produitTexte,
      quantite: art.quantite,
      prixUnitaire: art.prixUnitaire,
      produitMatch: match,
      ambigu,
      alternatives
    }
    etat.items.push(item)
    if (ambigu) {
      messages.push(`Plusieurs produits correspondent à « ${art.produitTexte} » : ${alternatives.map(a => a.nom).join(', ')}. Lequel ?`)
    } else if (match) {
      messages.push(`Ajouté : ${art.quantite} × ${match.nom} à ${art.prixUnitaire.toLocaleString('fr-FR')} FCFA.`)
    } else {
      messages.push(`Produit introuvable pour « ${art.produitTexte} » — vous pouvez le créer directement.`)
    }
  }

  // ── Relance conversationnelle ──────────────────────────────
  // Nafix Voice doit se comporter comme une vraie conversation : si une
  // information essentielle manque encore, poser LA question suivante
  // plutôt qu'un message d'erreur générique — jamais besoin de tout répéter
  // depuis le début (le contexte déjà acquis reste dans `etat`).
  const question = prochaineQuestion(etat)
  if (messages.length === 0) {
    messages.push(question || "Je n'ai pas bien compris. Vous pouvez par exemple dire « deux ordinateurs à 300 000 francs », ou « confirme » pour générer le devis.")
  } else if (question) {
    messages.push(question)
  }

  return { etat, messages }
}

// Détermine la prochaine information manquante à demander à voix haute, ou
// null si tout ce qu'il faut pour générer le devis est déjà réuni.
function prochaineQuestion(etat) {
  if (etat.annule || etat.pretAGenerer) return null
  if (etat.clientAmbigu || etat.items.some(it => it.ambigu)) return null // déjà signalé ci-dessus
  if (!etat.clientMatch && !etat.clientTexte) {
    return 'Pour quel client souhaitez-vous ce devis ?'
  }
  if (etat.items.length === 0) {
    return 'Quels produits souhaitez-vous ajouter, et en quelle quantité ?'
  }
  if (etat.items.some(it => !it.produitMatch)) {
    return null // déjà signalé comme "introuvable" ci-dessus
  }
  return 'Voulez-vous que je génère le devis ? Dites « confirme », ou continuez à ajouter des articles.'
}
