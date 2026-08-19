const pool = require('../db/pool')

const DashboardDAO = {
  async getAll(organisationId) {
    // Comptage total ventes
    const { rows: [cv] } = await pool.query('SELECT COUNT(*) as count FROM ventes WHERE organisation_id = $1', [organisationId])

    // CA global : toutes ventes incluses
    const { rows: [ca] } = await pool.query(`
      SELECT COALESCE(SUM(montant_total),0) as brut,
             COALESCE(SUM(COALESCE(montant_retourne,0)),0) as retourne,
             COALESCE(SUM(CASE WHEN mode_paiement='avoir' THEN montant_total ELSE 0 END),0) as avoir
      FROM ventes WHERE organisation_id = $1
    `, [organisationId])

    const { rows: [cc] } = await pool.query('SELECT COUNT(*) as count FROM clients WHERE organisation_id = $1', [organisationId])
    const { rows: [cp] } = await pool.query('SELECT COUNT(*) as count FROM produits WHERE organisation_id = $1', [organisationId])

    // Ventes du jour
    const { rows: [cvj] } = await pool.query(
      `SELECT COUNT(*) as count FROM ventes WHERE created_at::date = CURRENT_DATE AND organisation_id = $1`, [organisationId]
    )
    const { rows: [caj] } = await pool.query(`
      SELECT COALESCE(SUM(montant_total),0) as total,
             COALESCE(SUM(COALESCE(montant_retourne,0)),0) as retourne,
             COALESCE(SUM(CASE WHEN mode_paiement='avoir' THEN montant_total ELSE 0 END),0) as avoir
      FROM ventes WHERE created_at::date = CURRENT_DATE AND organisation_id = $1
    `, [organisationId])
    const { rows: [caj_paye] } = await pool.query(
      `SELECT COALESCE(SUM(montant_paye),0) as total,
              COALESCE(SUM(CASE WHEN mode_paiement!='avoir' THEN montant_paye ELSE 0 END),0) as cash
       FROM ventes WHERE created_at::date = CURRENT_DATE AND organisation_id = $1`, [organisationId]
    )

    const { rows: [retoursJour] } = await pool.query(
      "SELECT COUNT(*) as nb, COALESCE(SUM(montant_retour),0) as montant FROM retours WHERE statut='approuve' AND approuve_le::date = CURRENT_DATE AND organisation_id = $1", [organisationId]
    )
    const { rows: [retoursMois] } = await pool.query(
      "SELECT COUNT(*) as nb, COALESCE(SUM(montant_retour),0) as montant FROM retours WHERE statut='approuve' AND TO_CHAR(approuve_le,'YYYY-MM') = TO_CHAR(NOW(),'YYYY-MM') AND organisation_id = $1", [organisationId]
    )
    const { rows: [retoursTotal] } = await pool.query(
      "SELECT COUNT(*) as nb, COALESCE(SUM(montant_retour),0) as montant FROM retours WHERE statut='approuve' AND organisation_id = $1", [organisationId]
    )
    const { rows: [retoursEnAttente] } = await pool.query(
      "SELECT COUNT(*) as nb FROM retours WHERE statut='en_attente' AND organisation_id = $1", [organisationId]
    )

    const { rows: dernieresVentes } = await pool.query(`
      SELECT v.*, c.nom as client_nom
      FROM ventes v LEFT JOIN clients c ON v.client_id = c.id AND c.organisation_id = $1
      WHERE v.organisation_id = $1
      ORDER BY v.created_at DESC LIMIT 5
    `, [organisationId])
    const { rows: ventesAujourdhui } = await pool.query(`
      SELECT v.*, c.nom as client_nom
      FROM ventes v LEFT JOIN clients c ON v.client_id = c.id AND c.organisation_id = $1
      WHERE v.created_at::date = CURRENT_DATE AND v.organisation_id = $1
      ORDER BY v.created_at DESC
    `, [organisationId])

    const { rows: alertesStock } = await pool.query(
      'SELECT * FROM produits WHERE stock_actuel <= stock_minimum AND organisation_id = $1 ORDER BY stock_actuel ASC', [organisationId]
    )

    const { rows: [avoirActifs] } = await pool.query(
      "SELECT COUNT(*) as count, COALESCE(SUM(solde_restant), 0) as soldes FROM avoirs_clients WHERE actif = 1 AND organisation_id = $1", [organisationId]
    )
    const { rows: [avoirDepotsMois] } = await pool.query(`
      SELECT COALESCE(SUM(montant), 0) as total FROM transactions_avoir
      WHERE type = 'depot' AND TO_CHAR(created_at, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM') AND organisation_id = $1
    `, [organisationId])
    const { rows: [avoirAchatsMois] } = await pool.query(`
      SELECT COALESCE(SUM(montant), 0) as total, COUNT(*) as nb FROM transactions_avoir
      WHERE type = 'achat' AND TO_CHAR(created_at, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM') AND organisation_id = $1
    `, [organisationId])
    const { rows: [avoirDepotJour] } = await pool.query(`
      SELECT COALESCE(SUM(montant), 0) as total FROM transactions_avoir
      WHERE type = 'depot' AND created_at::date = CURRENT_DATE AND organisation_id = $1
    `, [organisationId])

    const caBrut       = parseFloat(ca.brut) || 0
    const caRetourne   = parseFloat(ca.retourne) || 0
    const caAvoir      = parseFloat(ca.avoir) || 0
    const caJourBrut   = parseFloat(caj.total) || 0
    const caJourRetour = parseFloat(caj.retourne) || 0
    const caJourAvoir  = parseFloat(caj.avoir) || 0

    return {
      totalVentes:         parseInt(cv.count),
      chiffreAffaire:      caBrut - caRetourne,
      chiffreAffaireBrut:  caBrut,
      chiffreAffaireAvoir: caAvoir,
      chiffreAffaireCash:  caBrut - caAvoir,
      totalRetournes:      caRetourne,
      totalClients:        parseInt(cc.count),
      totalProduits:       parseInt(cp.count),
      ventesJour:          parseInt(cvj.count) || 0,
      caJour:              caJourBrut - caJourRetour,
      caJourBrut,
      caJourAvoir,
      caJourCash:          caJourBrut - caJourAvoir,
      caJourPaye:          parseFloat(caj_paye.total) || 0,
      caJourPayeCash:      parseFloat(caj_paye.cash) || 0,
      retours: {
        jour:      { nb: parseInt(retoursJour.nb) || 0,     montant: parseFloat(retoursJour.montant) || 0 },
        mois:      { nb: parseInt(retoursMois.nb) || 0,     montant: parseFloat(retoursMois.montant) || 0 },
        total:     { nb: parseInt(retoursTotal.nb) || 0,    montant: parseFloat(retoursTotal.montant) || 0 },
        enAttente: parseInt(retoursEnAttente.nb) || 0,
      },
      dernieresVentes,
      ventesAujourdhui,
      alertesStock,
      avoirs: {
        nbActifs:     parseInt(avoirActifs.count) || 0,
        soldesTotaux: parseFloat(avoirActifs.soldes) || 0,
        depotsMois:   parseFloat(avoirDepotsMois.total) || 0,
        achatsMois:   parseFloat(avoirAchatsMois.total) || 0,
        nbAchatsMois: parseInt(avoirAchatsMois.nb) || 0,
        depotJour:    parseFloat(avoirDepotJour.total) || 0,
      }
    }
  }
}

module.exports = DashboardDAO
