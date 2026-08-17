import React from 'react'

function FactureTicket({ facture, parametres }) {
  const dateFacture = new Date(facture.created_at || Date.now())
  const heure = dateFacture.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const date = dateFacture.toLocaleDateString('fr-FR')
  const numero = `T-${String(facture.id).padStart(4, '0')}`
  const panier = JSON.parse(facture.panier || '[]')
  const tva = parseFloat(parametres?.tva_taux || 18) / 100
  const montantHT = facture.montant_total / (1 + tva)
  const montantTVA = facture.montant_total - montantHT
  const montantRecu = facture.montant_recu || facture.montant_paye || 0
  const monnaie = Math.max(0, montantRecu - (facture.montant_total || 0))
  const notes = (() => { try { return JSON.parse(facture.notes || '{}') } catch { return {} } })()
  const typeLabel = { sur_place: 'Sur place', emporter: 'À emporter', livraison: 'Livraison' }

  const sep = (style = 'dashed') => (
    <div style={{ borderTop: `1px ${style} #000`, margin: '6px 0' }} />
  )

  const ligne = (gauche, droite, bold = false, size = 11) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      fontSize: size, fontWeight: bold ? 'bold' : 'normal',
      marginBottom: 2
    }}>
      <span>{gauche}</span>
      <span>{droite}</span>
    </div>
  )

  return (
    <div
      id="facture-pdf"
      style={{
        width: '72mm',
        padding: '4mm 5mm',
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '11px',
        color: '#000',
        background: 'white',
        lineHeight: '1.5'
      }}
    >
      {/* ══════════════════════════════ */}
      {/* EN-TÊTE TICKET */}
      {/* ══════════════════════════════ */}
      <div style={{ textAlign: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 17, fontWeight: 'bold', letterSpacing: 1 }}>
          {parametres?.nom_entreprise || 'NAFIX STORE'}
        </div>
        {parametres?.slogan && (
          <div style={{ fontSize: 9, fontStyle: 'italic', color: '#444', marginTop: 2 }}>
            {parametres.slogan}
          </div>
        )}
        {(() => {
          const acts = (() => { try { return JSON.parse(parametres?.activites || '[]') } catch { return [] } })()
          return acts.length > 0 ? (
            <div style={{ fontSize: 9, color: '#555', marginTop: 2 }}>
              {acts.join(' · ')}
            </div>
          ) : null
        })()}
        <div style={{ fontSize: 9, marginTop: 4 }}>
          {parametres?.adresse || ''}
        </div>
        <div style={{ fontSize: 9 }}>
          {parametres?.telephone || ''}
          {parametres?.telephone_secondaire ? ` / ${parametres.telephone_secondaire}` : ''}
        </div>
        {parametres?.ninea && (
          <div style={{ fontSize: 8, color: '#555' }}>NINEA: {parametres.ninea}</div>
        )}
        {parametres?.registre_commerce && (
          <div style={{ fontSize: 8, color: '#555' }}>RC: {parametres.registre_commerce}</div>
        )}
      </div>

      {sep('solid')}

      {/* ══════════════════════════════ */}
      {/* INFOS TICKET */}
      {/* ══════════════════════════════ */}
      <div style={{ fontSize: 10, marginBottom: 4 }}>
        {ligne('Ticket:', numero)}
        {ligne('Date:', date)}
        {ligne('Heure:', heure)}
        {facture.vendeur && ligne('Caissier:', facture.vendeur)}
        {notes.table && ligne('Table:', notes.table === 'comptoir' ? 'Comptoir' : notes.table === 'terrasse' ? 'Terrasse' : notes.table === 'vip' ? 'Salon VIP' : `Table ${notes.table}`)}
        {notes.type && ligne('Type:', typeLabel[notes.type] || notes.type)}
        {facture.client_nom && facture.client_nom !== 'Client anonyme' && (
          ligne('Client:', facture.client_nom)
        )}
        {ligne('Paiement:', facture.mode_paiement === 'especes' ? 'Espèces'
          : facture.mode_paiement === 'wave' ? 'Wave'
          : facture.mode_paiement === 'orange_money' ? 'Orange Money'
          : facture.mode_paiement === 'cheque' ? 'Chèque'
          : facture.mode_paiement === 'pret' ? 'Crédit' : facture.mode_paiement)}
      </div>

      {sep()}

      {/* ══════════════════════════════ */}
      {/* ARTICLES */}
      {/* ══════════════════════════════ */}
      <div style={{ marginBottom: 4 }}>
        {panier.map((item, i) => (
          <div key={i} style={{ marginBottom: 5 }}>
            <div style={{ fontWeight: 'bold', fontSize: 11 }}>
              {item.nom}
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 10, paddingLeft: 8, color: '#222'
            }}>
              <span>
                {item.quantite} {item.unite || 'pcs'}
                {' × '}{item.prix_unitaire?.toLocaleString()} F
              </span>
              <span style={{ fontWeight: 'bold' }}>
                {item.total?.toLocaleString()} F
              </span>
            </div>
          </div>
        ))}
      </div>

      {sep('solid')}

      {/* ══════════════════════════════ */}
      {/* TOTAUX */}
      {/* ══════════════════════════════ */}
      <div style={{ fontSize: 10, marginBottom: 4 }}>
        {ligne('Sous-total HT:', `${Math.round(montantHT).toLocaleString()} F`)}
        {ligne(`TVA (${parametres?.tva_taux || 18}%):`, `${Math.round(montantTVA).toLocaleString()} F`)}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        borderTop: '2px solid #000', borderBottom: '2px solid #000',
        padding: '5px 0', margin: '4px 0',
        fontSize: 15, fontWeight: 'bold'
      }}>
        <span>TOTAL TTC</span>
        <span>{facture.montant_total?.toLocaleString()} FCFA</span>
      </div>

      {/* ══════════════════════════════ */}
      {/* PAIEMENT */}
      {/* ══════════════════════════════ */}
      <div style={{ fontSize: 10, marginTop: 4 }}>
        {montantRecu > 0 && ligne('Total:', `${(facture.montant_total || 0).toLocaleString('fr-FR')} F`)}
        {montantRecu > 0 && ligne('Remis:', `${montantRecu.toLocaleString('fr-FR')} F`)}
        {monnaie > 0 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontWeight: 'bold', fontSize: 13, marginTop: 3, color: '#000'
          }}>
            <span>MONNAIE:</span>
            <span>{monnaie.toLocaleString('fr-FR')} FCFA</span>
          </div>
        )}
        {facture.montant_du > 0 && facture.est_pret !== 1 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontWeight: 'bold', fontSize: 12, marginTop: 3,
            padding: '3px 0', borderTop: '1px dashed #000'
          }}>
            <span>RESTE DÛ:</span>
            <span>{facture.montant_du?.toLocaleString()} FCFA</span>
          </div>
        )}
        {facture.est_pret === 1 && (
          <div style={{
            textAlign: 'center', fontWeight: 'bold', fontSize: 11,
            marginTop: 4, padding: '3px', border: '1px solid #000'
          }}>
            ⚠ CRÉDIT — Dû: {facture.montant_du?.toLocaleString()} FCFA
          </div>
        )}
      </div>

      {sep()}

      {/* ══════════════════════════════ */}
      {/* PIED DE PAGE */}
      {/* ══════════════════════════════ */}
      <div style={{ textAlign: 'center', fontSize: 9 }}>
        <div style={{ fontWeight: 'bold', fontSize: 10, marginBottom: 3 }}>
          {parametres?.mention_facture || 'Merci pour votre visite !'}
        </div>
        <div style={{ color: '#555' }}>
          {date} {heure} · {parametres?.nom_entreprise || 'Nafix'}
        </div>
        <div style={{ marginTop: 6, letterSpacing: 3, fontSize: 20 }}>
          ||||||||||||||||
        </div>
        <div style={{ fontSize: 8, color: '#888', marginTop: 2 }}>
          {numero}
        </div>
      </div>
    </div>
  )
}

export default FactureTicket
