import React from 'react'

// Format facture BTP / Quincaillerie — demi-feuille A4 en portrait (format A5,
// 148mm × 210mm) : deux factures s'impriment sur une seule feuille A4, moins
// de gaspillage de papier qu'une facture pleine page pour un bon de vente
// comptoir. Mise en page épurée noir & blanc (encadrés fins, sections
// FACTURÉ PAR / FACTURÉ À, tableau d'articles, détails paiement + totaux)
// inspirée des modèles de facture classiques — volontairement sans couleurs
// vives : plus sobre pour un document imprimé ou joint à un dossier de chantier.
function FactureBTP({ facture, parametres }) {
  const date = new Date(facture.created_at || Date.now()).toLocaleDateString('fr-FR')
  const numero = `F-${String(facture.id).padStart(4, '0')}`
  const panier = JSON.parse(facture.panier || '[]')
  const notes = (() => { try { return JSON.parse(facture.notes || '{}') } catch { return {} } })()
  const tva = parseFloat(parametres?.tva_taux || 18) / 100
  const montantHT = facture.montant_total / (1 + tva)
  const montantTVA = facture.montant_total - montantHT

  const modeLabel = {
    especes: 'Espèces', wave: 'Wave', orange_money: 'Orange Money',
    cheque: 'Chèque', pret: 'Crédit'
  }[facture.mode_paiement] || facture.mode_paiement

  const bordure = '1px solid #1a1a1a'
  const boxTitle = {
    fontSize: '7.5px', fontWeight: 'bold', letterSpacing: '0.4px',
    textTransform: 'uppercase', padding: '4px 7px',
    borderBottom: bordure, background: '#f2f2f2'
  }
  const th = (extra = {}) => ({
    padding: '5px 6px', textAlign: 'left', fontWeight: 'bold',
    fontSize: '7.5px', textTransform: 'uppercase', letterSpacing: '0.3px',
    border: bordure, background: '#f2f2f2', ...extra
  })
  const td = (extra = {}) => ({
    padding: '4px 6px', fontSize: '8px', border: bordure, ...extra
  })

  // Sur une demi-page, la place est comptée — on ne remplit que ce qu'il
  // faut pour respirer un minimum, jamais au point de déborder sur une 2e page.
  const lignesVides = Math.max(0, Math.min(3, 5 - panier.length))

  return (
    <div
      id="facture-pdf"
      style={{
        width: '148mm',
        minHeight: '210mm',
        padding: '8mm 9mm',
        background: 'white',
        fontFamily: '"Segoe UI", Arial, sans-serif',
        color: '#1a1a1a',
        fontSize: '8px',
        lineHeight: '1.4'
      }}
    >
      {/* ══════════════ EN-TÊTE ══════════════ */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '12px'
      }}>
        {/* Logo / identité */}
        <div style={{
          border: '1.5px solid #1a1a1a', borderRadius: '50%',
          width: '46px', height: '46px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', fontSize: '6.5px', fontWeight: 'bold',
          textTransform: 'uppercase', lineHeight: 1.2, padding: 3
        }}>
          {parametres?.nom_entreprise
            ? parametres.nom_entreprise.split(' ').slice(0, 2).join(' ')
            : 'Nafix Store'}
        </div>

        {/* Titre */}
        <div style={{ flex: 1, textAlign: 'center', paddingTop: 4 }}>
          <div style={{ fontSize: '17px', fontWeight: 900, letterSpacing: '2px' }}>
            FACTURE
          </div>
          <div style={{ fontSize: '6.5px', color: '#666', letterSpacing: '0.6px', marginTop: 1 }}>
            QUINCAILLERIE · MATÉRIAUX BTP
          </div>
        </div>

        {/* Référence */}
        <div style={{ minWidth: '92px', fontSize: '7px', textAlign: 'right' }}>
          <div style={{ marginBottom: 2 }}><strong>N° :</strong> {numero}</div>
          <div style={{ marginBottom: 2 }}><strong>Date :</strong> {date}</div>
          <div><strong>Paiement :</strong> {modeLabel}</div>
        </div>
      </div>

      {/* ══════════════ FACTURÉ PAR / FACTURÉ À ══════════════ */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        marginBottom: '12px'
      }}>
        <div style={{ border: bordure, borderRight: 'none' }}>
          <div style={boxTitle}>Facturé par</div>
          <div style={{ padding: '6px 7px', fontSize: '7.5px', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 'bold', fontSize: '8.5px', marginBottom: 1 }}>
              {parametres?.nom_entreprise || 'Nafix Store'}
            </div>
            <div>{parametres?.adresse || 'Adresse non configurée'}</div>
            <div>{parametres?.telephone || 'Tél. non configuré'}</div>
            {parametres?.ninea && <div>NINEA : {parametres.ninea}</div>}
          </div>
        </div>
        <div style={{ border: bordure }}>
          <div style={boxTitle}>Facturé à</div>
          <div style={{ padding: '6px 7px', fontSize: '7.5px', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 'bold', fontSize: '8.5px', marginBottom: 1 }}>
              {facture.client_nom || 'Client anonyme'}
            </div>
            <div>Bon N° : {numero}</div>
            <div>Date : {date}</div>
            {notes.chantier && <div>Chantier : {notes.chantier}</div>}
          </div>
        </div>
      </div>

      {/* ══════════════ TABLEAU ARTICLES ══════════════ */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
        <thead>
          <tr>
            <th style={th()}>Désignation</th>
            <th style={th({ textAlign: 'center', width: '30px' })}>Qté</th>
            <th style={th({ textAlign: 'right', width: '52px' })}>Prix U.</th>
            <th style={th({ textAlign: 'right', width: '58px' })}>Total</th>
          </tr>
        </thead>
        <tbody>
          {panier.map((item, i) => (
            <tr key={i}>
              <td style={td()}><strong>{item.nom}</strong>{item.unite ? <span style={{ color: '#666' }}> ({item.unite})</span> : null}</td>
              <td style={td({ textAlign: 'center', fontWeight: 'bold' })}>{item.quantite}</td>
              <td style={td({ textAlign: 'right' })}>{item.prix_unitaire?.toLocaleString()}</td>
              <td style={td({ textAlign: 'right', fontWeight: 'bold' })}>{item.total?.toLocaleString()}</td>
            </tr>
          ))}
          {[...Array(lignesVides)].map((_, i) => (
            <tr key={`empty-${i}`}>
              <td style={td()}>&nbsp;</td>
              <td style={td()}></td>
              <td style={td()}></td>
              <td style={td()}></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ══════════════ DÉTAILS PAIEMENT + TOTAUX ══════════════ */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 130px',
        gap: '8px', marginBottom: '12px', alignItems: 'start'
      }}>
        {/* Détails paiement */}
        <div style={{ border: bordure }}>
          <div style={boxTitle}>Paiement</div>
          <div style={{ padding: '6px 7px', fontSize: '7.5px', lineHeight: 1.7 }}>
            <div>Statut : <strong>{
              facture.est_pret === 1 ? 'Crédit'
                : facture.montant_du > 0 ? 'Partiel'
                : 'Payé'
            }</strong></div>
            <div>Payé : <strong>{(facture.montant_paye || 0).toLocaleString()} F</strong></div>
            <div>Reliquat : <strong>{(facture.montant_du || 0).toLocaleString()} F</strong></div>
          </div>
        </div>

        {/* Totaux */}
        <div style={{ border: bordure }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '4px 7px', borderBottom: bordure, fontSize: '7.5px'
          }}>
            <span>Sous-total</span>
            <span>{Math.round(montantHT).toLocaleString()}</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '4px 7px', borderBottom: bordure, fontSize: '7.5px'
          }}>
            <span>TVA ({parametres?.tva_taux || 18}%)</span>
            <span>{Math.round(montantTVA).toLocaleString()}</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '6px 7px', background: '#1a1a1a', color: 'white',
            fontSize: '9.5px', fontWeight: 'bold'
          }}>
            <span>TOTAL</span>
            <span>{facture.montant_total?.toLocaleString()} F</span>
          </div>
        </div>
      </div>

      {/* ══════════════ NOTES ══════════════ */}
      <div style={{ border: bordure, marginBottom: '14px' }}>
        <div style={boxTitle}>Notes</div>
        <div style={{ padding: '6px 7px', fontSize: '6.5px', color: '#444', lineHeight: 1.7 }}>
          <div>• Marchandises vérifiées à la livraison — aucun retour sans bon de livraison.</div>
          <div>• Règlement à réception de facture, sauf accord de crédit client.</div>
        </div>
      </div>

      {/* Signature */}
      <div style={{ marginBottom: 16, fontSize: 7 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 16 }}>Signature et cachet</div>
        <div style={{ borderBottom: bordure, width: '55%' }} />
      </div>

      {/* ══════════════ PIED DE PAGE ══════════════ */}
      <div style={{ textAlign: 'center', borderTop: bordure, paddingTop: 8 }}>
        <div style={{ fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
          {parametres?.mention_facture || 'MERCI POUR VOTRE CONFIANCE'}
        </div>
        <div style={{ color: '#888', fontSize: '6px', marginTop: 3 }}>
          {date} · {parametres?.nom_entreprise || 'Nafix Store'} © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}

export default FactureBTP
