import React from 'react'

const ETAPE_CONFIG = {
  brouillon:    { label: 'BROUILLON',    color: '#8c8c8c' },
  commandé:     { label: 'COMMANDÉ',     color: '#1890ff' },
  en_livraison: { label: 'EN LIVRAISON', color: '#fa8c16' },
  reçu:         { label: 'REÇU',         color: '#13c2c2' },
  vérifié:      { label: 'VÉRIFIÉ',      color: '#52c41a' }
}

const PRIORITE_CONFIG = {
  basse:   { label: '↓ BASSE',   color: '#52c41a' },
  normale: { label: '→ NORMALE', color: '#1890ff' },
  haute:   { label: '↑ HAUTE',   color: '#faad14' },
  urgente: { label: '⚡ URGENTE', color: '#ff4d4f' }
}

const MODE_LABELS = {
  especes:      'Espèces',
  wave:         'Wave',
  orange_money: 'Orange Money',
  cheque:       'Chèque',
  virement:     'Virement bancaire',
  pret:         'Crédit'
}

function BonAchatPDF({ achat, fournisseur = {}, parametres = {} }) {
  const dateCommande = new Date(achat.date_achat || achat.created_at || Date.now())
    .toLocaleDateString('fr-FR')
  const dateLivraison = achat.date_livraison_prevue
    ? new Date(achat.date_livraison_prevue).toLocaleDateString('fr-FR')
    : null
  const dateGenere = new Date().toLocaleDateString('fr-FR')

  const numero   = achat.reference || `BC-${String(achat.id).padStart(4, '0')}`
  const panier   = (() => { try { return JSON.parse(achat.panier || '[]') } catch { return [] } })()
  const tva      = parseFloat(parametres?.tva_taux || 18) / 100
  const montantHT  = achat.montant_total / (1 + tva)
  const montantTVA = achat.montant_total - montantHT

  const etape    = ETAPE_CONFIG[achat.etape]    || ETAPE_CONFIG.commandé
  const priorite = PRIORITE_CONFIG[achat.priorite] || PRIORITE_CONFIG.normale

  const cellS = (extra = {}) => ({
    padding: '9px 8px', fontSize: '10px',
    borderBottom: '1px solid #efefef', verticalAlign: 'middle', ...extra
  })
  const thS = (extra = {}) => ({
    padding: '10px 8px', textAlign: 'left', fontWeight: 'bold',
    fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.4px',
    background: '#1890ff', color: 'white', ...extra
  })

  return (
    <div id="bon-achat-pdf" style={{
      width: '210mm', minHeight: '297mm',
      padding: '12mm 16mm',
      background: 'white',
      fontFamily: '"Segoe UI", Arial, sans-serif',
      color: '#1a1a2e', fontSize: '11px', lineHeight: 1.55
    }}>

      {/* ════════════ EN-TÊTE ════════════ */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        borderBottom: '3px solid #1890ff', paddingBottom: '16px', marginBottom: '22px'
      }}>
        {/* Entreprise */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1890ff', marginBottom: '3px' }}>
            {parametres?.nom_entreprise || 'NAFIMAX STORE'}
          </div>
          {parametres?.slogan && (
            <div style={{ fontSize: '10px', color: '#888', fontStyle: 'italic', marginBottom: '8px' }}>
              {parametres.slogan}
            </div>
          )}
          <div style={{ fontSize: '9px', color: '#555', lineHeight: '1.9' }}>
            {parametres?.adresse && <div>📍 {parametres.adresse}</div>}
            {parametres?.telephone && <div>📞 {parametres.telephone}</div>}
            {parametres?.email && <div>✉️ {parametres.email}</div>}
            {parametres?.ninea && <div>🏛️ NINEA : {parametres.ninea}</div>}
            {parametres?.registre_commerce && <div>🏢 RC : {parametres.registre_commerce}</div>}
          </div>
        </div>

        {/* Identité du document */}
        <div style={{ textAlign: 'right', minWidth: '195px' }}>
          <div style={{
            fontSize: '13px', fontWeight: 'bold', color: '#555',
            textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '4px'
          }}>
            Bon de Commande Fournisseur
          </div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1890ff', marginBottom: '8px' }}>
            {numero}
          </div>
          <div style={{
            fontSize: '10px', background: '#f0f5ff', padding: '8px 12px',
            borderRadius: '5px', border: '1px solid #d6e4ff', marginBottom: '8px', textAlign: 'left'
          }}>
            <div><strong>Date commande :</strong> {dateCommande}</div>
            {dateLivraison && (
              <div style={{ marginTop: '3px' }}><strong>Livraison souhaitée :</strong> {dateLivraison}</div>
            )}
            <div style={{ marginTop: '3px' }}>
              <strong>Mode paiement :</strong> {MODE_LABELS[achat.mode_paiement] || achat.mode_paiement}
            </div>
            {fournisseur?.conditions_paiement && (
              <div style={{ marginTop: '3px' }}>
                <strong>Conditions :</strong> {fournisseur.conditions_paiement}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <span style={{
              background: etape.color, color: 'white',
              padding: '3px 11px', borderRadius: '12px', fontSize: '9px', fontWeight: 'bold'
            }}>
              {etape.label}
            </span>
            <span style={{
              background: priorite.color, color: 'white',
              padding: '3px 11px', borderRadius: '12px', fontSize: '9px', fontWeight: 'bold'
            }}>
              {priorite.label}
            </span>
          </div>
        </div>
      </div>

      {/* ════════════ PARTIES ════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '22px' }}>
        {/* Fournisseur */}
        <div style={{
          padding: '12px 14px', background: '#fafafa',
          borderRadius: '6px', border: '1px solid #efefef', borderLeft: '4px solid #1890ff'
        }}>
          <div style={{
            fontSize: '9px', fontWeight: 'bold', color: '#1890ff',
            textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '7px'
          }}>
            Fournisseur / Vendeur
          </div>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1a1a2e', marginBottom: '5px' }}>
            {fournisseur?.nom || achat.fournisseur_nom || 'FOURNISSEUR DIRECT'}
          </div>
          <div style={{ fontSize: '10px', color: '#555', lineHeight: '1.8' }}>
            {fournisseur?.adresse && <div>📍 {fournisseur.adresse}</div>}
            {fournisseur?.telephone && <div>📞 {fournisseur.telephone}</div>}
            {fournisseur?.email && <div>✉️ {fournisseur.email}</div>}
            {fournisseur?.ninea && <div style={{ color: '#888' }}>NINEA : {fournisseur.ninea}</div>}
            {fournisseur?.registre_commerce && (
              <div style={{ color: '#888' }}>RC : {fournisseur.registre_commerce}</div>
            )}
            {fournisseur?.contact_nom && (
              <div style={{ color: '#888', marginTop: '3px' }}>
                Contact : {fournisseur.contact_nom}
              </div>
            )}
          </div>
        </div>

        {/* Récapitulatif commande */}
        <div style={{
          padding: '12px 14px', background: '#fafafa',
          borderRadius: '6px', border: '1px solid #efefef', borderLeft: '4px solid #52c41a'
        }}>
          <div style={{
            fontSize: '9px', fontWeight: 'bold', color: '#52c41a',
            textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '7px'
          }}>
            Récapitulatif commande
          </div>
          <div style={{ fontSize: '10px', color: '#555', lineHeight: '2' }}>
            <div>
              <span style={{ color: '#888', display: 'inline-block', minWidth: '130px' }}>Référence :</span>
              <strong>{numero}</strong>
            </div>
            <div>
              <span style={{ color: '#888', display: 'inline-block', minWidth: '130px' }}>Nb articles :</span>
              <strong>{panier.length} ligne{panier.length > 1 ? 's' : ''}</strong>
            </div>
            {fournisseur?.delai_livraison_jours && (
              <div>
                <span style={{ color: '#888', display: 'inline-block', minWidth: '130px' }}>Délai habituel :</span>
                <strong>{fournisseur.delai_livraison_jours} jours</strong>
              </div>
            )}
            {dateLivraison && (
              <div>
                <span style={{ color: '#888', display: 'inline-block', minWidth: '130px' }}>Livraison prévue :</span>
                <strong style={{ color: '#fa8c16' }}>{dateLivraison}</strong>
              </div>
            )}
            {achat.notes && (
              <div style={{ marginTop: '4px', fontStyle: 'italic', color: '#888', fontSize: '9px' }}>
                📝 {achat.notes}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════════════ TABLEAU ARTICLES ════════════ */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '22px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <thead>
          <tr>
            <th style={thS({ width: '28px', textAlign: 'center' })}>N°</th>
            <th style={thS({ width: '75px' })}>Référence</th>
            <th style={thS()}>Désignation</th>
            <th style={thS({ width: '52px', textAlign: 'center' })}>Unité</th>
            <th style={thS({ width: '50px', textAlign: 'right' })}>Qté</th>
            <th style={thS({ width: '95px', textAlign: 'right' })}>P.U. HT (FCFA)</th>
            <th style={thS({ width: '105px', textAlign: 'right', background: '#0050b3' })}>Total HT (FCFA)</th>
          </tr>
        </thead>
        <tbody>
          {panier.map((item, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#fafafa' }}>
              <td style={cellS({ textAlign: 'center', color: '#aaa', fontSize: '9px' })}>{i + 1}</td>
              <td style={cellS({ fontSize: '9px', color: '#888', fontFamily: 'monospace' })}>
                {item.reference || '—'}
              </td>
              <td style={cellS()}>
                <strong style={{ fontSize: '11px' }}>{item.nom}</strong>
              </td>
              <td style={cellS({ textAlign: 'center', color: '#666' })}>{item.unite || 'pcs'}</td>
              <td style={cellS({ textAlign: 'right', fontWeight: 'bold', fontSize: '12px' })}>
                {item.quantite}
              </td>
              <td style={cellS({ textAlign: 'right', color: '#555' })}>
                {item.prix_unitaire?.toLocaleString()}
              </td>
              <td style={cellS({ textAlign: 'right', fontWeight: 'bold', color: '#1890ff', fontSize: '12px' })}>
                {item.total?.toLocaleString()}
              </td>
            </tr>
          ))}
          {panier.length < 5 && [...Array(5 - panier.length)].map((_, i) => (
            <tr key={`e${i}`} style={{ height: '32px' }}>
              <td colSpan={7} style={{ borderBottom: '1px solid #f5f5f5' }} />
            </tr>
          ))}
        </tbody>
      </table>

      {/* ════════════ RÉSUMÉ FINANCIER ════════════ */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '22px' }}>
        <div style={{ width: '270px' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '8px 0', borderBottom: '1px solid #efefef', fontSize: '11px'
          }}>
            <span style={{ color: '#888' }}>Montant HT :</span>
            <span style={{ fontWeight: 'bold' }}>{Math.round(montantHT).toLocaleString()} FCFA</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '8px 0', borderBottom: '2px solid #1890ff', fontSize: '11px'
          }}>
            <span style={{ color: '#888' }}>TVA ({parametres?.tva_taux || 18}%) :</span>
            <span style={{ fontWeight: 'bold' }}>{Math.round(montantTVA).toLocaleString()} FCFA</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            background: '#1890ff', color: 'white', padding: '12px',
            borderRadius: '4px', margin: '10px 0 12px',
            fontSize: '14px', fontWeight: 'bold'
          }}>
            <span>TOTAL TTC :</span>
            <span>{achat.montant_total?.toLocaleString()} FCFA</span>
          </div>

          {/* Détail paiement */}
          <div style={{
            background: '#f0f5ff', padding: '10px 12px',
            borderRadius: '4px', border: '1px solid #d6e4ff'
          }}>
            <div style={{
              fontSize: '9px', fontWeight: 'bold', color: '#1890ff',
              textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px'
            }}>
              Règlement
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
              <span>✅ Versé :</span>
              <span style={{ fontWeight: 'bold', color: (achat.montant_paye || 0) > 0 ? '#52c41a' : '#999' }}>
                {(achat.montant_paye || 0).toLocaleString()} FCFA
              </span>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', fontSize: '11px',
              borderTop: '1px solid #d6e4ff', paddingTop: '6px', marginTop: '2px'
            }}>
              <span>❗ Reste dû :</span>
              <span style={{ fontWeight: 'bold', color: (achat.montant_du || 0) > 0 ? '#ff4d4f' : '#52c41a' }}>
                {(achat.montant_du || 0).toLocaleString()} FCFA
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════ SIGNATURES ════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {[
          { titre: 'VISA ACHETEUR', nom: parametres?.nom_entreprise || '' },
          { titre: 'VISA FOURNISSEUR', nom: fournisseur?.nom || '' }
        ].map((s, i) => (
          <div key={i} style={{ padding: '12px', border: '1px solid #efefef', borderRadius: '6px' }}>
            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#555', marginBottom: '8px' }}>
              {s.titre}
            </div>
            <div style={{ height: '50px', borderBottom: '1px solid #ccc' }} />
            <div style={{ fontSize: '9px', color: '#aaa', marginTop: '4px' }}>
              Signature et cachet {s.nom}
            </div>
          </div>
        ))}
      </div>

      {/* ════════════ PIED DE PAGE ════════════ */}
      <div style={{
        borderTop: '2px solid #1890ff', paddingTop: '12px',
        color: '#aaa', fontSize: '9px', textAlign: 'center', fontStyle: 'italic'
      }}>
        <div>
          Document généré le {dateGenere} · {parametres?.nom_entreprise || 'Nafimax'} · Bon de commande {numero}
        </div>
        <div style={{ fontSize: '8px', marginTop: '2px' }}>
          {parametres?.nom_entreprise || 'Nafimax'} © {new Date().getFullYear()} — Ce document est un bon de commande fournisseur officiel
        </div>
      </div>
    </div>
  )
}

export default BonAchatPDF
