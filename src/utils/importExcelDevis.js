import { normaliser } from './importExcelProduits'

// Reproduit côté navigateur la même heuristique que main.js (canal
// devis:importerExcel, côté Electron) : le shim web n'a pas accès à
// XLSX.readFile ni au disque, l'import doit donc être fait ici, dans le
// renderer, à partir d'un ArrayBuffer choisi via <input type="file">.
//
// Une ligne = un article ; plusieurs lignes du même client forment un seul
// devis. Le regroupement par client est fait ici (pur, testable) ; la
// résolution/création du client et du produit (qui a besoin des listes
// chargées en mémoire) reste à la charge de l'appelant.

const MOTS_CLES_CLIENT = ['client', 'nom client']

export function analyserGrilleDevis(grille) {
  let indexEntete = grille.findIndex(ligne =>
    ligne.some(cellule => MOTS_CLES_CLIENT.some(mot => normaliser(cellule).includes(mot)))
  )
  if (indexEntete === -1) indexEntete = 0
  const entetes = (grille[indexEntete] || []).map(normaliser)
  const lignesDonnees = grille.slice(indexEntete + 1)

  const indexColonne = (motsClefs) =>
    entetes.findIndex(entete => motsClefs.some(mot => entete.includes(mot)))

  const idxClient   = indexColonne(MOTS_CLES_CLIENT)
  const idxProduit  = indexColonne(['produit', 'article', 'designation', 'libelle'])
  const idxQuantite = indexColonne(['quantite', 'qte'])
  const idxPrix     = indexColonne(['prix unitaire', 'prix', 'pu'])
  const idxRemise   = indexColonne(['remise', 'reduction'])
  const idxValidite = indexColonne(['validite'])
  const idxNotes    = indexColonne(['notes', 'commentaire'])

  const valeur = (ligne, idx) => (idx === -1 ? '' : (ligne[idx] ?? ''))

  const groupesMap = new Map()
  for (let i = 0; i < lignesDonnees.length; i++) {
    const ligne = lignesDonnees[i]
    const clientBrut = idxClient === -1 ? '' : String(valeur(ligne, idxClient)).trim()
    if (!clientBrut) continue
    const cle = normaliser(clientBrut)
    if (!groupesMap.has(cle)) groupesMap.set(cle, { clientNom: clientBrut, lignes: [] })
    groupesMap.get(cle).lignes.push({
      produitTexte: String(valeur(ligne, idxProduit)).trim(),
      quantiteBrute: valeur(ligne, idxQuantite),
      prixBrut: valeur(ligne, idxPrix),
      remiseBrute: valeur(ligne, idxRemise),
      validiteBrute: valeur(ligne, idxValidite),
      noteBrute: String(valeur(ligne, idxNotes)).trim(),
      numeroLigne: indexEntete + i + 2
    })
  }

  return { groupes: [...groupesMap.values()], indexEntete }
}

// Correspondance approximative simple (contient / est contenu), identique à
// main.js — jamais de création automatique du produit : une ligne dont le
// produit est introuvable est signalée en erreur plutôt que de créer un
// doublon silencieux sur une simple faute de frappe.
export function trouverProduit(texte, produits) {
  const cible = normaliser(texte)
  if (!cible) return null
  let meilleur = null
  for (const p of produits) {
    const nomNorm = normaliser(p.nom)
    if (nomNorm === cible) return p
    if ((nomNorm.includes(cible) || cible.includes(nomNorm)) && !meilleur) meilleur = p
  }
  return meilleur
}
