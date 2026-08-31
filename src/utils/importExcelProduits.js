// Reproduit côté navigateur la même heuristique de reconnaissance de
// colonnes que main.js (canal produits:importerExcel, coté Electron) : le
// shim web (public/ipc-shim.js) n'a pas accès à la lib xlsx ni au disque,
// l'import doit donc être fait ici, dans le renderer, à partir d'un
// ArrayBuffer choisi via <input type="file">.

const MOTS_CLES_NOM = ['nom', 'produit', 'designation', 'article', 'libelle']

// Décompose les accents (NFD) puis retire les marques diacritiques sans
// dépendre d'un regex littéral — identique à main.js.
export function normaliser(s) {
  const decompose = String(s ?? '').toLowerCase().normalize('NFD')
  let resultat = ''
  for (const car of decompose) {
    const code = car.codePointAt(0)
    if (code < 0x0300 || code > 0x036f) resultat += car
  }
  return resultat.trim()
}

function positifOuDefaut(val, defaut) {
  const n = parseFloat(val)
  return (isFinite(n) && n >= 0) ? n : defaut
}

// grille : résultat de XLSX.utils.sheet_to_json(feuille, { header: 1, defval: '', blankrows: false })
// Retourne { produits, ignores, indexEntete } — indexEntete sert à retrouver
// le vrai numéro de ligne du fichier dans les messages d'erreur.
export function analyserGrilleProduits(grille) {
  let indexEntete = grille.findIndex(ligne =>
    ligne.some(cellule => MOTS_CLES_NOM.some(mot => normaliser(cellule).includes(mot)))
  )
  if (indexEntete === -1) indexEntete = 0
  const entetes = (grille[indexEntete] || []).map(normaliser)
  const lignesDonnees = grille.slice(indexEntete + 1)

  const indexColonne = (motsClefs) =>
    entetes.findIndex(entete => motsClefs.some(mot => entete.includes(mot)))

  const idxNom       = indexColonne(MOTS_CLES_NOM)
  const idxReference = indexColonne(['reference', 'ref', 'code'])
  const idxCategorie = indexColonne(['categorie'])
  const idxMarque    = indexColonne(['marque'])
  const idxPrixAchat = indexColonne(['prix achat', 'prixachat', 'achat'])
  const idxPrixVente = indexColonne(['prix vente', 'prixvente', 'vente'])
  const idxStock     = indexColonne(['stock actuel', 'quantite', 'stock'])
  const idxStockMin  = indexColonne(['stock minimum', 'seuil', 'stock min'])
  const idxUnite     = indexColonne(['unite'])

  const valeur = (ligne, idx) => (idx === -1 ? '' : (ligne[idx] ?? ''))

  const produits = []
  let ignores = 0
  for (const ligne of lignesDonnees) {
    const nom = idxNom === -1 ? '' : String(valeur(ligne, idxNom)).trim()
    if (!nom) { ignores++; continue }
    const categorieBrute = String(valeur(ligne, idxCategorie)).trim()
    produits.push({
      nom,
      reference: String(valeur(ligne, idxReference)).trim() || null,
      categorie: categorieBrute || 'Sans catégorie',
      marque: String(valeur(ligne, idxMarque)).trim() || null,
      prix_achat: positifOuDefaut(valeur(ligne, idxPrixAchat), 0),
      prix_vente: positifOuDefaut(valeur(ligne, idxPrixVente), 0),
      stock_actuel: positifOuDefaut(valeur(ligne, idxStock), 0),
      stock_minimum: positifOuDefaut(valeur(ligne, idxStockMin), 5),
      unite: String(valeur(ligne, idxUnite)).trim() || 'pièce'
    })
  }
  return { produits, ignores, indexEntete }
}
