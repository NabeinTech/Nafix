import React from 'react'

// Format A5 (148mm × 210mm) — plus compact que l'A4, pensé pour les
// commerces qui veulent un document plus détaillé qu'un ticket thermique
// sans consommer une feuille A4 entière.
//
// Revu pour la lisibilité à l'impression : les tailles de police d'origine
// (7-9px) sont trop petites une fois sur papier — corps de texte remonté à
// 12px, titres/montants agrandis, et une ligne de séparation nette entre
// chaque section (en-tête / client / articles / totaux / pied de page) au
// lieu de bordures ponctuelles sur certains blocs seulement.
function FactureA5({ facture, parametres }) {
  const date = new Date(facture.created_at || Date.now()).toLocaleDateString('fr-FR')
  const numero = `F-${String(facture.id).padStart(4, '0')}`
  const panier = JSON.parse(facture.panier || '[]')
  const tva = parseFloat(parametres?.tva_taux || 18) / 100
  const montantHT = facture.montant_total / (1 + tva)
  const montantTVA = facture.montant_total - montantHT

  const ligneSeparation = (couleur = '#e0e0e0', epaisseur = '1px', marge = '14px 0') => (
    <div style={{ borderTop: `${epaisseur} solid ${couleur}`, margin: marge }} />
  )

  return (
    <div
      id="facture-pdf"
      style={{
        width: '148mm',
        minHeight: '210mm',
        padding: '10mm 12mm',
        background: 'white',
        boxSizing: 'border-box',
        fontFamily: '"Segoe UI", Arial, sans-serif',
        color: '#2c2c2c',
        fontSize: '12px',
        lineHeight: '1.6'
      }}
    >
      {/* ── En-tête ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '21px', fontWeight: 800, color: '#1890ff', marginBottom: '3px', letterSpacing: '0.2px' }}>
            {parametres?.nom_entreprise || 'NAFIMAX TECHNOLOGY'}
          </div>
          {parametres?.slogan && (
            <div style={{ fontSize: '11px', color: '#888', fontStyle: 'italic', marginBottom: '8px' }}>
              {parametres.slogan}
            </div>
          )}
          <div style={{ fontSize: '10.5px', color: '#555', lineHeight: '1.75' }}>
            <div>📍 {parametres?.adresse || 'Adresse non configurée'}</div>
            <div>📞 {parametres?.telephone || 'Non configuré'}{parametres?.telephone_secondaire ? ` / ${parametres.telephone_secondaire}` : ''}</div>
            {parametres?.ninea && <div>🏛️ NINEA : {parametres.ninea}</div>}
            {parametres?.registre_commerce && <div>🏢 RC : {parametres.registre_commerce}</div>}
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: '100px' }}>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#1890ff', marginBottom: '6px' }}>
            {numero}
          </div>
          <div style={{ fontSize: '10.5px', color: '#555', background: '#f0f5ff', padding: '8px 10px', borderRadius: '6px', lineHeight: '1.7' }}>
            <div><strong>Date :</strong> {date}</div>
            <div><strong>Mode :</strong> {facture.mode_paiement}</div>
            {facture.vendeur && <div><strong>Vendeur :</strong> {facture.vendeur}</div>}
          </div>
        </div>
      </div>

      {ligneSeparation('#1890ff', '2px', '14px 0')}

      {/* ── Client + statut ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 12px', background: '#f9f9f9', borderRadius: '6px', border: '1px solid #ececec'
      }}>
        <div>
          <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#1890ff', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
            Client
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>{facture.client_nom || 'CLIENT ANONYME'}</div>
        </div>
        <div>
          {facture.est_pret === 1 ? (
            <span style={{ background: '#fff7e6', color: '#ff7a45', padding: '5px 12px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 700 }}>📋 CRÉDIT</span>
          ) : facture.montant_du > 0 ? (
            <span style={{ background: '#fff2f0', color: '#ff4d4f', padding: '5px 12px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 700 }}>⚠️ PARTIEL</span>
          ) : (
            <span style={{ background: '#f6ffed', color: '#52c41a', padding: '5px 12px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 700 }}>✅ PAYÉE</span>
          )}
        </div>
      </div>

      {ligneSeparation('#e0e0e0', '1px', '16px 0')}

      {/* ── Articles ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#1890ff', color: 'white' }}>
            <th style={{ padding: '9px 10px', textAlign: 'left', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Désignation</th>
            <th style={{ padding: '9px 10px', textAlign: 'center', fontSize: '10.5px', width: '42px' }}>Qté</th>
            <th style={{ padding: '9px 10px', textAlign: 'right', fontSize: '10.5px', width: '65px' }}>P.U.</th>
            <th style={{ padding: '9px 10px', textAlign: 'right', fontSize: '10.5px', width: '72px' }}>Montant</th>
          </tr>
        </thead>
        <tbody>
          {panier.map((item, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f7f9fc', borderBottom: '1px solid #ececec' }}>
              <td style={{ padding: '9px 10px', fontWeight: 700, fontSize: '12px' }}>{item.nom}</td>
              <td style={{ padding: '9px 10px', textAlign: 'center', color: '#555', fontSize: '11.5px' }}>{item.quantite}</td>
              <td style={{ padding: '9px 10px', textAlign: 'right', color: '#555', fontSize: '11.5px' }}>{item.prix_unitaire?.toLocaleString()}</td>
              <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: '#1890ff', fontSize: '11.5px' }}>{item.total?.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {ligneSeparation('#e0e0e0', '1px', '16px 0')}

      {/* ── Totaux ── */}
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '11.5px' }}>
          <span>Montant HT :</span>
          <span style={{ fontWeight: 700 }}>{Math.round(montantHT).toLocaleString()} FCFA</span>
        </div>

        {ligneSeparation('#e0e0e0', '1px', '0')}

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '11.5px' }}>
          <span>TVA ({parametres?.tva_taux || 18}%) :</span>
          <span style={{ fontWeight: 700 }}>{Math.round(montantTVA).toLocaleString()} FCFA</span>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', background: '#1890ff', color: 'white',
          borderRadius: '6px', padding: '11px 14px', margin: '10px 0', fontSize: '15px', fontWeight: 800
        }}>
          <span>TOTAL TTC :</span>
          <span>{facture.montant_total?.toLocaleString()} FCFA</span>
        </div>

        {(facture.montant_recu || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '11.5px' }}>
            <span>💵 Remis :</span>
            <span style={{ fontWeight: 700 }}>{(facture.montant_recu || 0).toLocaleString('fr-FR')} FCFA</span>
          </div>
        )}
        {(facture.montant_recu || 0) > (facture.montant_total || 0) && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: '11.5px',
            background: '#f6ffed', borderRadius: '6px', border: '1px solid #b7eb8f', marginTop: '6px'
          }}>
            <span style={{ fontWeight: 700, color: '#389e0d' }}>💚 Monnaie :</span>
            <span style={{ fontWeight: 700, color: '#389e0d' }}>
              {((facture.montant_recu || 0) - (facture.montant_total || 0)).toLocaleString('fr-FR')} FCFA
            </span>
          </div>
        )}
        {(facture.montant_du || 0) > 0 && (
          <>
            {ligneSeparation('#d6e4ff', '1px', '8px 0 0 0')}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0 0', fontSize: '12px' }}>
              <span>❗ Reste à payer :</span>
              <span style={{ fontWeight: 800, color: '#ff4d4f' }}>{(facture.montant_du || 0).toLocaleString('fr-FR')} FCFA</span>
            </div>
          </>
        )}
      </div>

      {ligneSeparation('#1890ff', '2px', '16px 0 10px 0')}

      {/* ── Pied de page ── */}
      <div style={{ color: '#888', fontSize: '9.5px', textAlign: 'center', fontStyle: 'italic' }}>
        <div style={{ marginBottom: '5px' }}>
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
