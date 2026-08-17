const pool = require('../db/pool')

const StatistiquesDAO = {
  async getAll(organisationId) {
    const { rows: [cv] } = await pool.query('SELECT COUNT(*) as count FROM ventes WHERE organisation_id = $1', [organisationId])
    const totalVentes = parseInt(cv.count)

    const { rows: [ca] } = await pool.query(`
      SELECT COALESCE(SUM(montant_total),0) as brut,
             COALESCE(SUM(COALESCE(montant_retourne,0)),0) as retourne,
             COALESCE(SUM(CASE WHEN mode_paiement='avoir' THEN montant_total ELSE 0 END),0) as avoir
      FROM ventes WHERE organisation_id = $1
    `, [organisationId])
    const chiffreAffaireBrut  = parseFloat(ca.brut) || 0
    const totalRetournes      = parseFloat(ca.retourne) || 0
    const chiffreAffaire      = chiffreAffaireBrut - totalRetournes
    const chiffreAffaireAvoir = parseFloat(ca.avoir) || 0
    const chiffreAffaireCash  = chiffreAffaireBrut - chiffreAffaireAvoir

    const { rows: [cc] } = await pool.query('SELECT COUNT(*) as count FROM clients WHERE organisation_id = $1', [organisationId])
    const totalClients = parseInt(cc.count)

    const { rows: [cp] } = await pool.query('SELECT COUNT(*) as count FROM produits WHERE organisation_id = $1', [organisationId])
    const totalProduits = parseInt(cp.count)

    const panierMoyen = totalVentes > 0 ? Math.round(chiffreAffaire / totalVentes) : 0

    const { rows: ventesParJour } = await pool.query(`
      SELECT
        DATE(created_at) as jour,
        COUNT(*) as nb_ventes,
        SUM(montant_total) as total,
        SUM(montant_paye) as total_paye,
        COALESCE(SUM(CASE WHEN mode_paiement='avoir' THEN montant_total ELSE 0 END),0) as total_avoir
      FROM ventes
      WHERE created_at >= NOW() - INTERVAL '30 days' AND organisation_id = $1
      GROUP BY DATE(created_at)
      ORDER BY jour ASC
    `, [organisationId])

    const { rows: ventesParMois } = await pool.query(`
      SELECT
        TO_CHAR(created_at, 'MM/YYYY') as mois,
        COUNT(*) as nb_ventes,
        SUM(montant_total) as total,
        SUM(montant_paye) as total_paye,
        COALESCE(SUM(CASE WHEN mode_paiement='avoir' THEN montant_total ELSE 0 END),0) as total_avoir
      FROM ventes
      WHERE organisation_id = $1
      GROUP BY TO_CHAR(created_at, 'YYYY-MM'), TO_CHAR(created_at, 'MM/YYYY')
      ORDER BY MIN(created_at) ASC
      LIMIT 12
    `, [organisationId])

    const { rows: ventesParSemaine } = await pool.query(`
      SELECT
        TO_CHAR(created_at, 'IW') as semaine,
        TO_CHAR(created_at, 'MM/YYYY') as mois,
        COUNT(*) as nb_ventes,
        SUM(montant_total) as total,
        COALESCE(SUM(CASE WHEN mode_paiement='avoir' THEN montant_total ELSE 0 END),0) as total_avoir
      FROM ventes
      WHERE organisation_id = $1
      GROUP BY TO_CHAR(created_at, 'IYYY-IW'), TO_CHAR(created_at, 'IW'), TO_CHAR(created_at, 'MM/YYYY')
      ORDER BY MIN(created_at) ASC
      LIMIT 52
    `, [organisationId])

    const { rows: statsParPaiement } = await pool.query(`
      SELECT mode_paiement, COUNT(*) as nb, SUM(montant_total) as total
      FROM ventes WHERE organisation_id = $1 GROUP BY mode_paiement ORDER BY total DESC
    `, [organisationId])

    const { rows: [statsCredits] } = await pool.query(`
      SELECT
        SUM(CASE WHEN est_pret = 1 THEN 1 ELSE 0 END) as total_prets,
        SUM(CASE WHEN est_partiel = 1 THEN 1 ELSE 0 END) as total_partiels,
        SUM(CASE WHEN est_pret = 1 THEN montant_total ELSE 0 END) as montant_prets,
        SUM(CASE WHEN est_partiel = 1 THEN montant_du ELSE 0 END) as montant_partiels,
        SUM(montant_du) as total_du
      FROM ventes WHERE organisation_id = $1
    `, [organisationId])

    const { rows: topProduits } = await pool.query(`
      SELECT
        item->>'nom' as nom,
        SUM((item->>'quantite')::numeric) as total_quantite,
        SUM((item->>'total')::numeric)    as total_ca
      FROM ventes,
           json_array_elements(
             CASE WHEN panier IS NOT NULL AND panier != ''
                  THEN panier::json ELSE '[]'::json END
           ) AS item
      WHERE organisation_id = $1
      GROUP BY item->>'nom'
      ORDER BY total_quantite DESC
      LIMIT 10
    `, [organisationId])

    const { rows: topSousCategories } = await pool.query(`
      SELECT
        p.sous_categorie as nom,
        SUM((item->>'quantite')::numeric) as total_vendu,
        SUM((item->>'total')::numeric)    as ca,
        COUNT(*)                          as nb_ventes
      FROM ventes,
           json_array_elements(
             CASE WHEN panier IS NOT NULL AND panier != ''
                  THEN panier::json ELSE '[]'::json END
           ) AS item
      JOIN produits p ON p.id = (item->>'produit_id')::integer AND p.organisation_id = $1
      WHERE p.sous_categorie IS NOT NULL AND ventes.organisation_id = $1
      GROUP BY p.sous_categorie
      ORDER BY ca DESC
      LIMIT 10
    `, [organisationId])

    const { rows: topClients } = await pool.query(`
      SELECT c.nom, COUNT(v.id) as nb_achats, SUM(v.montant_total) as total_ca
      FROM ventes v JOIN clients c ON v.client_id = c.id AND c.organisation_id = $1
      WHERE v.organisation_id = $1
      GROUP BY c.id, c.nom ORDER BY total_ca DESC LIMIT 5
    `, [organisationId])

    const { rows: [ventesAujourdhui] } = await pool.query(`
      SELECT COUNT(*) as nb, SUM(montant_total) as total,
             COALESCE(SUM(CASE WHEN mode_paiement='avoir' THEN montant_total ELSE 0 END),0) as avoir
      FROM ventes WHERE DATE(created_at) = CURRENT_DATE AND organisation_id = $1
    `, [organisationId])

    const { rows: [ventesSemaine] } = await pool.query(`
      SELECT COUNT(*) as nb, SUM(montant_total) as total,
             COALESCE(SUM(CASE WHEN mode_paiement='avoir' THEN montant_total ELSE 0 END),0) as avoir
      FROM ventes WHERE created_at >= NOW() - INTERVAL '7 days' AND organisation_id = $1
    `, [organisationId])

    const { rows: [ventesMois] } = await pool.query(`
      SELECT COUNT(*) as nb, SUM(montant_total) as total,
             COALESCE(SUM(CASE WHEN mode_paiement='avoir' THEN montant_total ELSE 0 END),0) as avoir
      FROM ventes WHERE TO_CHAR(created_at, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM') AND organisation_id = $1
    `, [organisationId])

    const { rows: alertesStock } = await pool.query(`
      SELECT * FROM produits WHERE stock_actuel <= stock_minimum AND organisation_id = $1 ORDER BY stock_actuel ASC
    `, [organisationId])

    // ── Comptes prépayés ─────────────────────────────────────────────
    const { rows: [statsAvoirs] } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE actif = 1)                           AS nb_actifs,
        COUNT(*) FILTER (WHERE actif = 0)                           AS nb_clotures,
        COALESCE(SUM(montant_initial), 0)                           AS total_depots_initiaux,
        COALESCE(SUM(solde_restant) FILTER (WHERE actif = 1), 0)    AS soldes_disponibles
      FROM avoirs_clients WHERE organisation_id = $1
    `, [organisationId])
    const { rows: [statsAvoirsTx] } = await pool.query(`
      SELECT
        COALESCE(SUM(montant) FILTER (WHERE type = 'depot'), 0)   AS total_recharges,
        COALESCE(SUM(montant) FILTER (WHERE type = 'achat'), 0)   AS total_achats,
        COUNT(*) FILTER (WHERE type = 'achat')                    AS nb_achats
      FROM transactions_avoir WHERE organisation_id = $1
    `, [organisationId])
    const { rows: avoirsParMois } = await pool.query(`
      SELECT
        TO_CHAR(created_at, 'MM/YYYY') AS mois,
        COALESCE(SUM(montant) FILTER (WHERE type = 'depot'), 0)  AS depots,
        COALESCE(SUM(montant) FILTER (WHERE type = 'achat'), 0)  AS achats,
        COUNT(*) FILTER (WHERE type = 'achat')                   AS nb_achats
      FROM transactions_avoir
      WHERE organisation_id = $1
      GROUP BY TO_CHAR(created_at, 'YYYY-MM'), TO_CHAR(created_at, 'MM/YYYY')
      ORDER BY MIN(created_at) ASC
      LIMIT 12
    `, [organisationId])

    // ── Retours (approuvés uniquement) ───────────────────────────────
    const { rows: [statsRetours] } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE statut = 'approuve')                                                                                                    AS nb_total,
        COALESCE(SUM(montant_retour) FILTER (WHERE statut = 'approuve'), 0)                                                                           AS montant_total,
        COUNT(*) FILTER (WHERE statut = 'approuve' AND TO_CHAR(approuve_le,'YYYY-MM') = TO_CHAR(NOW(),'YYYY-MM'))                                      AS nb_mois,
        COALESCE(SUM(montant_retour) FILTER (WHERE statut = 'approuve' AND TO_CHAR(approuve_le,'YYYY-MM') = TO_CHAR(NOW(),'YYYY-MM')), 0)              AS montant_mois,
        COUNT(*) FILTER (WHERE statut = 'en_attente')                                                                                                  AS nb_en_attente
      FROM retours WHERE organisation_id = $1
    `, [organisationId])
    const { rows: retoursParMois } = await pool.query(`
      SELECT
        TO_CHAR(approuve_le, 'MM/YYYY') AS mois,
        COUNT(*)                         AS nb,
        COALESCE(SUM(montant_retour), 0) AS montant
      FROM retours
      WHERE statut = 'approuve' AND organisation_id = $1
      GROUP BY TO_CHAR(approuve_le, 'YYYY-MM'), TO_CHAR(approuve_le, 'MM/YYYY')
      ORDER BY MIN(approuve_le) ASC
      LIMIT 12
    `, [organisationId])

    return {
      totalVentes, chiffreAffaire, chiffreAffaireBrut, totalRetournes,
      chiffreAffaireAvoir, chiffreAffaireCash,
      totalClients, totalProduits, panierMoyen,
      ventesParJour, ventesParMois, ventesParSemaine, statsParPaiement,
      statsCredits,
      topProduits, topSousCategories, topClients,
      ventesAujourdhui: {
        nb: parseInt(ventesAujourdhui.nb) || 0,
        total: parseFloat(ventesAujourdhui.total) || 0,
        avoir: parseFloat(ventesAujourdhui.avoir) || 0
      },
      ventesSemaine: {
        nb: parseInt(ventesSemaine.nb) || 0,
        total: parseFloat(ventesSemaine.total) || 0,
        avoir: parseFloat(ventesSemaine.avoir) || 0
      },
      ventesMois: {
        nb: parseInt(ventesMois.nb) || 0,
        total: parseFloat(ventesMois.total) || 0,
        avoir: parseFloat(ventesMois.avoir) || 0
      },
      alertesStock,
      statsRetours: {
        nbTotal:      parseInt(statsRetours.nb_total) || 0,
        montantTotal: parseFloat(statsRetours.montant_total) || 0,
        nbMois:       parseInt(statsRetours.nb_mois) || 0,
        montantMois:  parseFloat(statsRetours.montant_mois) || 0,
        nbEnAttente:  parseInt(statsRetours.nb_en_attente) || 0,
      },
      retoursParMois,
      statsAvoirs: {
        nbActifs:            parseInt(statsAvoirs.nb_actifs) || 0,
        nbClotures:          parseInt(statsAvoirs.nb_clotures) || 0,
        totalDepotsInitiaux: parseFloat(statsAvoirs.total_depots_initiaux) || 0,
        soldesDisponibles:   parseFloat(statsAvoirs.soldes_disponibles) || 0,
        totalRecharges:      parseFloat(statsAvoirsTx.total_recharges) || 0,
        totalAchats:         parseFloat(statsAvoirsTx.total_achats) || 0,
        nbAchats:            parseInt(statsAvoirsTx.nb_achats) || 0,
      },
      avoirsParMois
    }
  }
}

module.exports = StatistiquesDAO
