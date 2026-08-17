// ============================================================
// 🤖 NAFIX AI ENGINE — Algorithmes ML purs JavaScript
// ============================================================

//  1. RÉGRESSION LINÉAIRE SIMPLE
export function regressionLineaire(donnees) {
  const n = donnees.length
  if (n < 2) return { pente: 0, intercept: 0, r2: 0 }

  const sumX = donnees.reduce((acc, _, i) => acc + i, 0)
  const sumY = donnees.reduce((acc, d) => acc + d, 0)
  const sumXY = donnees.reduce((acc, d, i) => acc + i * d, 0)
  const sumX2 = donnees.reduce((acc, _, i) => acc + i * i, 0)

  const pente = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - pente * sumX) / n

  // Calculer R²
  const moyenneY = sumY / n
  const ssTot = donnees.reduce((acc, d) => acc + Math.pow(d - moyenneY, 2), 0)
  const ssRes = donnees.reduce((acc, d, i) => {
    const predicted = pente * i + intercept
    return acc + Math.pow(d - predicted, 2)
  }, 0)
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0

  return { pente, intercept, r2 }
}

// 2. PRÉDICTION FUTURE
export function predire(donnees, nbPeriodes = 3) {
  const { pente, intercept, r2 } = regressionLineaire(donnees)
  const n = donnees.length
  const predictions = []

  for (let i = 0; i < nbPeriodes; i++) {
    const valeur = Math.max(0, Math.round(pente * (n + i) + intercept))
    const confiance = Math.round(r2 * 100)
    predictions.push({ valeur, confiance, periode: n + i })
  }

  return { predictions, r2, tendance: pente > 0 ? 'hausse' : pente < 0 ? 'baisse' : 'stable' }
}

//  3. SEGMENTATION CLIENTS RFM
export function segmenterClientsRFM(ventes) {
  const maintenant = new Date()
  const clientsMap = {}

  ventes.forEach(v => {
    if (!v.client_id || !v.client_nom) return
    const id = v.client_id
    if (!clientsMap[id]) {
      clientsMap[id] = {
        id, nom: v.client_nom,
        derniereVisite: new Date(v.created_at),
        nbAchats: 0, totalDepense: 0
      }
    }
    const dateVisite = new Date(v.created_at)
    if (dateVisite > clientsMap[id].derniereVisite) {
      clientsMap[id].derniereVisite = dateVisite
    }
    clientsMap[id].nbAchats++
    clientsMap[id].totalDepense += v.montant_total || 0
  })

  const clients = Object.values(clientsMap).map(c => {
    const recence = Math.floor((maintenant - c.derniereVisite) / (1000 * 60 * 60 * 24))
    return { ...c, recence }
  })

  if (clients.length === 0) return []

  // Scorer chaque dimension (1-5)
  const scorer = (valeurs, inverse = false) => {
    const sorted = [...valeurs].sort((a, b) => inverse ? b - a : a - b)
    return (val) => {
      const rank = sorted.indexOf(val) / sorted.length
      return Math.ceil(rank * 5) || 1
    }
  }

  const scoreR = scorer(clients.map(c => c.recence), false) // moins = mieux
  const scoreF = scorer(clients.map(c => c.nbAchats), true) // plus = mieux
  const scoreM = scorer(clients.map(c => c.totalDepense), true) // plus = mieux

  return clients.map(c => {
    const r = 6 - scoreR(c.recence) // Inverser: récent = score élevé
    const f = scoreF(c.nbAchats)
    const m = scoreM(c.totalDepense)
    const rfm = r + f + m

    let segment, couleur, description
    if (rfm >= 13) { segment = '⭐ Champion'; couleur = '#52c41a'; description = 'Meilleur client, acheteur régulier' }
    else if (rfm >= 10) { segment = '🔥 Fidèle'; couleur = '#1890ff'; description = 'Client loyal, bon potentiel' }
    else if (rfm >= 7) { segment = '📈 Prometteur'; couleur = '#faad14'; description = 'Client en progression' }
    else if (rfm >= 4) { segment = '😴 Dormant'; couleur = '#ff7a45'; description = 'Besoin de réactivation' }
    else { segment = '❌ Perdu'; couleur = '#ff4d4f'; description = 'Très inactif, à reconquérir' }

    return { ...c, r, f, m, rfm, segment, couleur, description }
  }).sort((a, b) => b.rfm - a.rfm)
}

//  4. PRÉDICTION RUPTURE STOCK
export function predireRuptureStock(produits, ventes) {
  const consommationMap = {}

  ventes.forEach(v => {
    try {
      const panier = JSON.parse(v.panier || '[]')
      panier.forEach(item => {
        if (!consommationMap[item.produit_id]) {
          consommationMap[item.produit_id] = { quantites: [], total: 0, nbVentes: 0 }
        }
        consommationMap[item.produit_id].total += item.quantite
        consommationMap[item.produit_id].nbVentes++
      })
    } catch(e) {}
  })

  return produits.map(p => {
    const conso = consommationMap[p.id]
    if (!conso) return { ...p, joursRestants: Infinity, risque: 'aucun', consommationJour: 0 }

    // Consommation moyenne par jour (sur 30 jours)
    const consommationJour = conso.total / 30
    const joursRestants = consommationJour > 0
      ? Math.floor(p.stock_actuel / consommationJour)
      : Infinity

    let risque, couleur
    if (joursRestants <= 3) { risque = 'critique'; couleur = '#ff4d4f' }
    else if (joursRestants <= 7) { risque = 'élevé'; couleur = '#ff7a45' }
    else if (joursRestants <= 14) { risque = 'modéré'; couleur = '#faad14' }
    else { risque = 'faible'; couleur = '#52c41a' }

    return { ...p, consommationJour: consommationJour.toFixed(1), joursRestants, risque, couleur }
  })
  .filter(p => p.joursRestants < Infinity)
  .sort((a, b) => a.joursRestants - b.joursRestants)
}

//  5. DÉTECTION D'ANOMALIES (Z-Score)
export function detecterAnomalies(donnees) {
  if (donnees.length < 3) return []
  const moyenne = donnees.reduce((a, b) => a + b, 0) / donnees.length
  const variance = donnees.reduce((acc, d) => acc + Math.pow(d - moyenne, 2), 0) / donnees.length
  const ecartType = Math.sqrt(variance)

  return donnees.map((val, i) => {
    const zScore = ecartType > 0 ? Math.abs((val - moyenne) / ecartType) : 0
    return {
      index: i,
      valeur: val,
      zScore: zScore.toFixed(2),
      anomalie: zScore > 2,
      type: val > moyenne ? 'pic' : 'creux'
    }
  })
}

//  6. SCORE RENTABILITÉ PRODUIT
export function scorerRentabilite(produits, ventes) {
  const ventesMap = {}

  ventes.forEach(v => {
    try {
      const panier = JSON.parse(v.panier || '[]')
      panier.forEach(item => {
        if (!ventesMap[item.nom]) {
          ventesMap[item.nom] = { ca: 0, quantite: 0, marges: [] }
        }
        ventesMap[item.nom].ca += item.total || 0
        ventesMap[item.nom].quantite += item.quantite || 0
      })
    } catch(e) {}
  })

  return produits.map(p => {
    const v = ventesMap[p.nom] || { ca: 0, quantite: 0 }
    const marge = p.prix_vente - p.prix_achat
    const margePct = p.prix_achat > 0 ? (marge / p.prix_achat) * 100 : 0
    const rotation = p.stock_actuel > 0 ? v.quantite / p.stock_actuel : 0
    const score = Math.round((margePct * 0.4) + (rotation * 30 * 0.3) + (v.ca / 1000 * 0.3))

    let grade
    if (score >= 80) grade = '🏆 A+'
    else if (score >= 60) grade = '⭐ A'
    else if (score >= 40) grade = '✅ B'
    else if (score >= 20) grade = '⚠️ C'
    else grade = '❌ D'

    return { ...p, marge, margePct: margePct.toFixed(1), rotation: rotation.toFixed(2), score, grade, ca: v.ca, quantiteVendue: v.quantite }
  }).sort((a, b) => b.score - a.score)
}