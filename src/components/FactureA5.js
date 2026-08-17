import React from 'react'

// Format A5 (148mm × 210mm) — plus compact que l'A4, pensé pour les
// commerces qui veulent un document plus détaillé qu'un ticket thermique
// sans consommer une feuille A4 entière.
function FactureA5({ facture, parametres }) {
  const date = new Date(facture.created_at || Date.now()).toLocaleDateString('fr-FR')
  const numero = `F-${String(facture.id).padStart(4, '0')}`
  const panier = JSON.parse(facture.panier || '[]')
  const tva = parseFloat(parametres?.tva_taux || 18) / 100
  const montantHT = facture.montant_total / (1 + tva)
  const montantTVA = facture.montant_total - montantHT

  return (
    <div
      id="facture-pdf"
      style={{
        width: '148mm',
        minHeight: '210mm',
        padding: '8mm 10mm',
        background: 'white',
        fontFamily: '"Segoe UI", Arial, sans-serif',
        color: '#2c3e50',
        fontSize: '9px',
        lineHeight: '1.5'
      }}
    >
      {/* En-tête */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        borderBottom: '2px solid #1890ff', paddingBottom: '10px', marginBottom: '14px'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1890ff', marginBottom: '2px' }}>
            {parametres?.nom_entreprise || 'NAFIMAX TECHNOLOGY'}
          </div>
          {parametres?.slogan && (
            <div style={{ fontSize: '9px', color: '#888', fontStyle: 'italic', marginBottom: '6px' }}>
              {parametres.slogan}
            </div>
          )}
          <div style={{ fontSize: '8px', color: '#666', lineHeight: '1.6' }}>
            <div>📍 {parametres?.adresse || 'Adresse non configurée'}</div>
            <div>📞 {parametres?.telephone || 'Non configuré'}{parametres?.telephone_secondaire ? ` / ${parametres.telephone_secondaire}` : ''}</div>
            {parametres?.ninea && <div>🏛️ NINEA: {parametres.ninea}</div>}
            {parametres?.registre_commerce && <div>🏢 RC: {parametres.registre_commerce}</div>}
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: '90px' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1890ff', marginBottom: '4px' }}>
            {numero}
          </div>
          <div style={{ fontSize: '8px', color: '#666', background: '#f0f5ff', padding: '5px 8px', borderRadius: '4px' }}>
            <div><strong>Date :</strong> {date}</div>
            <div><strong>Mode :</strong> {facture.mode_paiement}</div>
            {facture.vendeur && <div><strong>Vendeur :</strong> {facture.vendeur}</div>}
          </div>
        </div>
      </div>

      {/* Client + statut */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', marginBottom: '12px',
        padding: '8px 10px', background: '#f9f9f9', borderRadius: '4px', border: '1px solid #efefef'
      }}>
        <div>
          <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#1890ff', textTransform: 'uppercase' }}>Client</div>
          <div style={{ fontSize: '10px', fontWeight: 'bold' }}>{facture.client_nom || 'CLIENT ANONYME'}</div>
        </div>
        <div>
          {facture.est_pret === 1 ? (
            <span style={{ background: '#fff7e6', color: '#ff7a45', padding: '3px 8px', borderRadius: '4px', fontSize: '8px', fontWeight: 'bold' }}>📋 CRÉDIT</span>
          ) : facture.montant_du > 0 ? (
            <span style={{ background: '#fff2f0', color: '#ff4d4f', padding: '3px 8px', borderRadius: '4px', fontSize: '8px', fontWeight: 'bold' }}>⚠️ PARTIEL</span>
          ) : (
            <span style={{ background: '#f6ffed', color: '#52c41a', padding: '3px 8px', borderRadius: '4px', fontSize: '8px', fontWeight: 'bold' }}>✅ PAYÉE</span>
          )}
        </div>
      </div>

      {/* Articles */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px' }}>
        <thead>
          <tr style={{ background: '#1890ff', color: 'white' }}>
            <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: '8px', textTransform: 'uppercase' }}>Désignation</th>
            <th style={{ padding: '6px 8px', textAlign: 'center', fontSize: '8px', width: '32px' }}>Qté</th>
            <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '8px', width: '55px' }}>P.U.</th>
            <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: '8px', width: '60px' }}>Montant</th>
          </tr>
        </thead>
        <tbody>
          {panier.map((item, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9', borderBottom: '1px solid #efefef' }}>
              <td style={{ padding: '5px 8px', fontWeight: 'bold' }}>{item.nom}</td>
              <td style={{ padding: '5px 8px', textAlign: 'center', color: '#666' }}>{item.quantite}</td>
              <td style={{ padding: '5px 8px', textAlign: 'right', color: '#666' }}>{item.prix_unitaire?.toLocaleString()}</td>
              <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 500, color: '#1890ff' }}>{item.total?.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totaux */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #efefef', fontSize: '9px' }}>
            <span>Montant HT :</span>
            <span style={{ fontWeight: 'bold' }}>{montantHT.toLocaleString()} FCFA</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '2px solid #1890ff', fontSize: '9px' }}>
            <span>TVA ({parametres?.tva_taux || 18}%) :</span>
            <span style={{ fontWeight: 'bold' }}>{montantTVA.toLocaleString()} FCFA</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', background: '#1890ff', color: 'white',
            borderRadius: '4px', padding: '8px 10px', margin: '8px 0', fontSize: '11px', fontWeight: 'bold'
          }}>
            <span>TOTAL TTC :</span>
            <span>{facture.montant_total?.toLocaleString()} FCFA</span>
          </div>

          {(facture.montant_recu || 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '9px' }}>
              <span>💵 Remis :</span>
              <span style={{ fontWeight: 'bold' }}>{(facture.montant_recu || 0).toLocaleString('fr-FR')} FCFA</span>
            </div>
          )}
          {(facture.montant_recu || 0) > (facture.montant_total || 0) && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', padding: '4px 6px', fontSize: '9px',
              background: '#f6ffed', borderRadius: '4px', border: '1px solid #b7eb8f', marginTop: '3px'
            }}>
              <span style={{ fontWeight: 'bold', color: '#389e0d' }}>💚 Monnaie :</span>
              <span style={{ fontWeight: 'bold', color: '#389e0d' }}>
                {((facture.montant_recu || 0) - (facture.montant_total || 0)).toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          )}
          {(facture.montant_du || 0) > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', padding: '4px 6px', fontSize: '9px',
              marginTop: '4px', borderTop: '1px solid #d6e4ff', paddingTop: '6px'
            }}>
              <span>❗ Reste à payer :</span>
              <span style={{ fontWeight: 'bold', color: '#ff4d4f' }}>{(facture.montant_du || 0).toLocaleString('fr-FR')} FCFA</span>
            </div>
          )}
        </div>
      </div>

      {/* Pied de page */}
      <div style={{
        borderTop: '2px solid #1890ff', paddingTop: '10px', color: '#888',
        fontSize: '7px', textAlign: 'center', fontStyle: 'italic'
      }}>
        <div style={{ marginBottom: '4px' }}>
          {parametres?.mention_facture || 'Merci pour votre confiance !'}
        </div>
        <div style={{ color: '#aaa' }}>
          {date} • {parametres?.nom_entreprise || 'Nafimax'} © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}

export default FactureA5
