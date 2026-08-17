const pool = require('../db/pool')

// Type normalisé : 'entree' ou 'sortie' (accepte aussi 'recette'/'depense' legacy)
const isEntree = (type) => type === 'entree' || type === 'recette'

const TresorerieDAO = {
  async getAll(organisationId) {
    const { rows } = await pool.query(
      'SELECT * FROM tresorerie WHERE organisation_id = $1 ORDER BY date_operation DESC, id DESC',
      [organisationId]
    )
    return rows
  },

  async create(op, organisationId) {
    const { rows } = await pool.query(
      `INSERT INTO tresorerie (type, categorie, description, montant, date_operation, organisation_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [op.type, op.categorie, op.description, op.montant, op.date_operation, organisationId]
    )
    return rows[0]
  },

  async update(op, organisationId) {
    // Interdit de modifier une opération clôturée
    const { rows: [existing] } = await pool.query('SELECT cloturee FROM tresorerie WHERE id=$1 AND organisation_id=$2', [op.id, organisationId])
    if (existing?.cloturee) return { erreur: 'Opération verrouillée après clôture' }
    await pool.query(
      'UPDATE tresorerie SET type=$1, categorie=$2, description=$3, montant=$4, date_operation=$5 WHERE id=$6 AND organisation_id=$7',
      [op.type, op.categorie, op.description, op.montant, op.date_operation, op.id, organisationId]
    )
    return { succes: true }
  },

  async delete(id, organisationId) {
    const { rows: [existing] } = await pool.query('SELECT cloturee FROM tresorerie WHERE id=$1 AND organisation_id=$2', [id, organisationId])
    if (existing?.cloturee) return { erreur: 'Opération verrouillée après clôture' }
    await pool.query('DELETE FROM tresorerie WHERE id=$1 AND organisation_id=$2', [id, organisationId])
    return { succes: true }
  },

  async getStats(organisationId) {
    // Pour le solde : exclut catégorie='avoir' (argent réservé clients prépayés)
    const entreeSolde = `COALESCE(SUM(CASE WHEN type IN ('entree','recette') AND categorie != 'avoir' THEN montant ELSE 0 END),0)`
    // Les remboursements de retours (catégorie='retour') sont déjà déduits du solde
    // via la baisse de ventes.montant_paye lors de l'approbation (RetoursDAO.approuver) —
    // les recompter ici en sortie doublerait la déduction du solde de caisse.
    const sortieSolde = `COALESCE(SUM(CASE WHEN type IN ('sortie','depense') AND categorie != 'retour' THEN montant ELSE 0 END),0)`
    // Pour affichage brut (KPI "Sorties") : toutes les sorties, retours inclus
    const sortieExpr  = `COALESCE(SUM(CASE WHEN type IN ('sortie','depense') THEN montant ELSE 0 END),0)`
    const entreeTotal = `COALESCE(SUM(CASE WHEN type IN ('entree','recette') THEN montant ELSE 0 END),0)`

    const { rows: [jour] } = await pool.query(`
      SELECT ${entreeSolde} AS entrees_solde, ${entreeTotal} AS entrees,
             ${sortieExpr}  AS sorties, ${sortieSolde} AS sorties_solde
      FROM tresorerie WHERE date_operation = CURRENT_DATE AND organisation_id = $1
    `, [organisationId])
    const { rows: [mois] } = await pool.query(`
      SELECT ${entreeSolde} AS entrees_solde, ${entreeTotal} AS entrees,
             ${sortieExpr}  AS sorties, ${sortieSolde} AS sorties_solde
      FROM tresorerie WHERE TO_CHAR(date_operation,'YYYY-MM') = TO_CHAR(CURRENT_DATE,'YYYY-MM') AND organisation_id = $1
    `, [organisationId])
    const { rows: [global] } = await pool.query(`
      SELECT ${entreeSolde} AS entrees_solde, ${sortieSolde} AS sorties_solde
      FROM tresorerie WHERE organisation_id = $1
    `, [organisationId])

    // Encaissements ventes : ca=total(avoir inclus), paye=cash uniquement (avoir exclu du solde caisse)
    const { rows: [ventesJour] } = await pool.query(`
      SELECT COUNT(*) AS nb,
             COALESCE(SUM(montant_total), 0)                                             AS ca,
             COALESCE(SUM(CASE WHEN mode_paiement='avoir' THEN montant_total ELSE 0 END),0) AS ca_avoir,
             COALESCE(SUM(montant_paye) FILTER (WHERE mode_paiement != 'avoir'),0)       AS paye
      FROM ventes WHERE created_at::date = CURRENT_DATE AND organisation_id = $1
    `, [organisationId])
    const { rows: [ventesMois] } = await pool.query(`
      SELECT COALESCE(SUM(montant_paye) FILTER (WHERE mode_paiement != 'avoir'),0) AS paye,
             COALESCE(SUM(CASE WHEN mode_paiement='avoir' THEN montant_total ELSE 0 END),0) AS ca_avoir
      FROM ventes WHERE TO_CHAR(created_at,'YYYY-MM') = TO_CHAR(CURRENT_DATE,'YYYY-MM') AND organisation_id = $1
    `, [organisationId])
    const { rows: [ventesGlobal] } = await pool.query(
      `SELECT COALESCE(SUM(montant_paye) FILTER (WHERE mode_paiement != 'avoir'),0) AS paye FROM ventes WHERE organisation_id = $1`,
      [organisationId]
    )

    const { rows: [derniereCloture] } = await pool.query(
      'SELECT solde_fin, date_cloture FROM clotures_journalieres WHERE organisation_id = $1 ORDER BY date_cloture DESC LIMIT 1',
      [organisationId]
    )

    const toF = v => parseFloat(v) || 0
    const toI = v => parseInt(v) || 0

    const jEntS = toF(jour.entrees_solde), jEnt = toF(jour.entrees), jSor = toF(jour.sorties), jSorSolde = toF(jour.sorties_solde)
    const mEntS = toF(mois.entrees_solde), mEnt = toF(mois.entrees), mSor = toF(mois.sorties), mSorSolde = toF(mois.sorties_solde)
    const gEntS = toF(global.entrees_solde), gSorSolde = toF(global.sorties_solde)
    const jPay  = toF(ventesJour.paye)
    const mPay  = toF(ventesMois.paye)
    const gPay  = toF(ventesGlobal.paye)

    return {
      jour: {
        entrees: jEnt, sorties: jSor,
        solde: jEntS + jPay - jSorSolde,
        ventesPaye: jPay,
        caVentes: toF(ventesJour.ca),
        caVentesAvoir: toF(ventesJour.ca_avoir),
        caVentesCash: toF(ventesJour.ca) - toF(ventesJour.ca_avoir),
        nbVentes: toI(ventesJour.nb)
      },
      mois: {
        entrees: mEnt, sorties: mSor,
        solde: mEntS + mPay - mSorSolde,
        ventesPaye: mPay,
        caAvoir: toF(ventesMois.ca_avoir)
      },
      global: {
        solde: gEntS + gPay - gSorSolde,
        ventesPaye: gPay
      },
      derniereCloture: derniereCloture || null
    }
  },

  async getClotures(organisationId) {
    const { rows } = await pool.query(
      'SELECT * FROM clotures_journalieres WHERE organisation_id = $1 ORDER BY date_cloture DESC',
      [organisationId]
    )
    return rows
  },

  async cloturer(date, cloturePar, notes, organisationId) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Vérifier doublon
      const { rows: dup } = await client.query(
        'SELECT id FROM clotures_journalieres WHERE date_cloture=$1 AND organisation_id=$2', [date, organisationId]
      )
      if (dup.length) throw new Error('Cette journée est déjà clôturée')

      // Opérations trésorerie du jour (non encore clôturées)
      const { rows: ops } = await client.query(
        "SELECT * FROM tresorerie WHERE date_operation=$1 AND cloturee=0 AND organisation_id=$2", [date, organisationId]
      )
      // Exclut catégorie='avoir' des entrées (argent réservé, pas dans la caisse principale)
      const entrees = ops.reduce((s, o) => s + (isEntree(o.type) && o.categorie !== 'avoir' ? o.montant : 0), 0)
      const sorties = ops.reduce((s, o) => s + (!isEntree(o.type) ? o.montant : 0), 0)
      // Les remboursements de retours (catégorie='retour') sont déjà déduits du solde
      // via la baisse de ventes.montant_paye (RetoursDAO.approuver) — exclus ici du calcul
      // du solde pour ne pas les déduire une seconde fois (total_sorties, lui, garde tout).
      const sortiesSolde = ops.reduce((s, o) => s + (!isEntree(o.type) && o.categorie !== 'retour' ? o.montant : 0), 0)

      // CA ventes du jour — exclut avoir (dépôt déjà compté en trésorerie)
      const { rows: [ventesJour] } = await client.query(
        `SELECT COUNT(*) AS nb,
                COALESCE(SUM(montant_total),0)                                      AS ca,
                COALESCE(SUM(montant_paye) FILTER (WHERE mode_paiement != 'avoir'), 0) AS paye
         FROM ventes WHERE created_at::date=$1 AND organisation_id=$2`, [date, organisationId]
      )
      const payeJour = parseFloat(ventesJour.paye) || 0

      // Solde début = solde fin de la dernière clôture
      const { rows: [last] } = await client.query(
        'SELECT solde_fin FROM clotures_journalieres WHERE organisation_id=$1 ORDER BY date_cloture DESC LIMIT 1',
        [organisationId]
      )
      const soldeDebut = parseFloat(last?.solde_fin || 0)
      // solde fin = début + trésorerie manuelles + encaissements ventes - sorties
      const soldeFin   = soldeDebut + entrees + payeJour - sortiesSolde

      // Insérer la clôture
      const { rows: [cloture] } = await client.query(
        `INSERT INTO clotures_journalieres
          (date_cloture, ca_jour, nb_ventes, total_entrees, total_sorties, solde_debut, solde_fin, notes, cloturee_par, organisation_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [date, parseFloat(ventesJour.ca), parseInt(ventesJour.nb), entrees, sorties, soldeDebut, soldeFin, notes || null, cloturePar, organisationId]
      )

      // Verrouiller les opérations du jour
      await client.query(
        'UPDATE tresorerie SET cloturee=1, cloture_id=$1 WHERE date_operation=$2 AND organisation_id=$3',
        [cloture.id, date, organisationId]
      )

      await client.query('COMMIT')
      return { succes: true, cloture }
    } catch (err) {
      await client.query('ROLLBACK')
      return { erreur: err.message }
    } finally {
      client.release()
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // Rapport de clôture intelligent — analyse (pas seulement un relevé
  // brut) des ventes du jour : résumé, clients, dettes, anomalies
  // détectées automatiquement et recommandations en langage clair.
  // Appelé AVANT la clôture réelle pour que le caissier puisse vérifier
  // la journée avant de verrouiller les opérations.
  // ═══════════════════════════════════════════════════════════════
  async rapportCloture(date, organisationId) {
    const { rows: ventes } = await pool.query(`
      SELECT v.*, c.nom AS client_nom, c.telephone AS client_telephone
      FROM ventes v
      LEFT JOIN clients c ON v.client_id = c.id
      WHERE v.created_at::date = $1 AND v.organisation_id = $2
      ORDER BY v.created_at ASC
    `, [date, organisationId])

    const { rows: retours } = await pool.query(`
      SELECT r.montant_retour, r.vente_id
      FROM retours r
      WHERE r.statut = 'approuve' AND r.approuve_le::date = $1 AND r.organisation_id = $2
    `, [date, organisationId])

    // Produits référencés aujourd'hui — pour comparer prix vendu / prix d'achat courant
    const produitIds = new Set()
    for (const v of ventes) {
      for (const it of JSON.parse(v.panier || '[]')) produitIds.add(it.produit_id)
    }
    let produitsMap = {}
    if (produitIds.size) {
      const { rows: prods } = await pool.query(
        'SELECT id, nom, prix_achat, stock_actuel FROM produits WHERE id = ANY($1) AND organisation_id = $2',
        [[...produitIds], organisationId]
      )
      produitsMap = Object.fromEntries(prods.map(p => [p.id, p]))
    }

    const toF = v => parseFloat(v) || 0
    const numero = v => `F-${String(v.id).padStart(4, '0')}`

    // ── Résumé ──────────────────────────────────────────────────
    const nbVentes = ventes.length
    const ca = ventes.reduce((s, v) => s + toF(v.montant_total), 0)
    const caCash = ventes.filter(v => v.mode_paiement !== 'avoir').reduce((s, v) => s + toF(v.montant_paye), 0)
    const caCredit = ventes.filter(v => v.est_pret === 1).reduce((s, v) => s + toF(v.montant_total), 0)
    const caAvoir = ventes.filter(v => v.mode_paiement === 'avoir').reduce((s, v) => s + toF(v.montant_total), 0)
    const clientsUniques = new Set(ventes.filter(v => v.client_id).map(v => v.client_id)).size
    const panierMoyen = nbVentes ? ca / nbVentes : 0

    // ── Clients du jour ─────────────────────────────────────────
    const parClient = {}
    for (const v of ventes) {
      const cle = v.client_id || `anon-${v.id}`
      if (!parClient[cle]) {
        parClient[cle] = { client_id: v.client_id, nom: v.client_nom || 'Client de passage', nb: 0, total: 0, du: 0 }
      }
      parClient[cle].nb += 1
      parClient[cle].total += toF(v.montant_total)
      parClient[cle].du += toF(v.montant_du)
    }
    const clients = Object.values(parClient).sort((a, b) => b.total - a.total)

    // ── Dettes (crédit / partiel) ───────────────────────────────
    const dettes = ventes
      .filter(v => toF(v.montant_du) > 0)
      .map(v => ({
        vente_id: v.id, numero: numero(v),
        client_nom: v.client_nom || 'Client anonyme',
        montant_du: toF(v.montant_du), date_pret: v.date_pret, est_pret: v.est_pret === 1
      }))
    const totalDu = dettes.reduce((s, d) => s + d.montant_du, 0)

    // ── Anomalies détectées automatiquement ──────────────────────
    const anomalies = []

    for (const v of ventes) {
      for (const it of JSON.parse(v.panier || '[]')) {
        const prod = produitsMap[it.produit_id]
        if (prod && toF(prod.prix_achat) > 0 && toF(it.prix_unitaire) < toF(prod.prix_achat)) {
          anomalies.push({
            type: 'vente_perte', gravite: 'haute',
            message: `Vente à perte sur ${numero(v)} : "${it.nom}" vendu ${toF(it.prix_unitaire).toLocaleString('fr-FR')} F (achat ${toF(prod.prix_achat).toLocaleString('fr-FR')} F)`
          })
        }
      }
    }

    for (const v of ventes) {
      const pct = toF(v.escompte_pourcentage)
      const montantRemise = toF(v.escompte_montant)
      if (montantRemise > 0 && (pct >= 20 || montantRemise >= 5000)) {
        anomalies.push({
          type: 'remise_importante', gravite: 'moyenne',
          message: `Remise importante sur ${numero(v)} : -${montantRemise.toLocaleString('fr-FR')} F${pct ? ` (${pct}%)` : ''}`
        })
      }
    }

    for (const v of ventes) {
      if (v.est_pret === 1 && !v.date_pret) {
        anomalies.push({
          type: 'credit_sans_date', gravite: 'moyenne',
          message: `Crédit sans date de remboursement sur ${numero(v)} (${v.client_nom || 'client inconnu'})`
        })
      }
    }

    for (let i = 1; i < ventes.length; i++) {
      const a = ventes[i - 1], b = ventes[i]
      const ecartMs = new Date(b.created_at) - new Date(a.created_at)
      if (a.client_id && a.client_id === b.client_id &&
          Math.abs(toF(a.montant_total) - toF(b.montant_total)) < 1 &&
          ecartMs >= 0 && ecartMs < 2 * 60 * 1000) {
        anomalies.push({
          type: 'doublon_potentiel', gravite: 'haute',
          message: `Doublon possible : ${numero(a)} et ${numero(b)} — même client, même montant, ${Math.round(ecartMs / 1000)}s d'écart`
        })
      }
    }

    for (const p of Object.values(produitsMap)) {
      if (toF(p.stock_actuel) < 0) {
        anomalies.push({
          type: 'stock_negatif', gravite: 'haute',
          message: `Stock négatif détecté : "${p.nom}" (${p.stock_actuel})`
        })
      }
    }

    const totalRetours = retours.reduce((s, r) => s + toF(r.montant_retour), 0)
    if (ca > 0 && totalRetours / ca > 0.15) {
      anomalies.push({
        type: 'retours_eleves', gravite: 'moyenne',
        message: `Retours élevés aujourd'hui : ${totalRetours.toLocaleString('fr-FR')} F, soit ${Math.round(totalRetours / ca * 100)}% du CA du jour`
      })
    }

    // ── Recommandations en langage clair ─────────────────────────
    const recommandations = []
    if (nbVentes === 0) {
      recommandations.push("Aucune vente enregistrée aujourd'hui — vérifiez qu'aucune transaction n'a été oubliée avant de clôturer.")
    }
    if (ca > 0 && caCredit / ca > 0.3) {
      recommandations.push(`Le crédit représente ${Math.round(caCredit / ca * 100)}% du CA du jour (${caCredit.toLocaleString('fr-FR')} F) — pensez à relancer les clients concernés.`)
    }
    if (totalDu > 0) {
      recommandations.push(`${dettes.length} vente(s) avec un solde dû, pour un total de ${totalDu.toLocaleString('fr-FR')} F.`)
    }
    if (clients.length > 0 && clients[0].client_id) {
      recommandations.push(`Meilleur client du jour : ${clients[0].nom} (${clients[0].nb} achat(s), ${clients[0].total.toLocaleString('fr-FR')} F).`)
    }
    if (anomalies.length === 0) {
      recommandations.push('Aucune anomalie détectée — journée saine.')
    } else {
      const haute = anomalies.filter(a => a.gravite === 'haute').length
      recommandations.push(
        haute > 0
          ? `${anomalies.length} anomalie(s) détectée(s), dont ${haute} à vérifier en priorité avant de clôturer.`
          : `${anomalies.length} anomalie(s) mineure(s) détectée(s) — à vérifier si besoin.`
      )
    }

    return {
      date,
      resume: { nbVentes, ca, caCash, caCredit, caAvoir, clientsUniques, panierMoyen, nbFactures: nbVentes },
      ventes: ventes.map(v => ({
        id: v.id, numero: numero(v),
        client_nom: v.client_nom || 'Client de passage',
        montant_total: toF(v.montant_total),
        mode_paiement: v.mode_paiement,
        est_pret: v.est_pret === 1,
        montant_du: toF(v.montant_du),
        heure: v.created_at
      })),
      clients,
      dettes: { total: totalDu, liste: dettes },
      anomalies,
      recommandations
    }
  }
}

module.exports = TresorerieDAO
