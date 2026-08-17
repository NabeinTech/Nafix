import React from 'react'

function FacturePDF({ facture, parametres }) {
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
        width: '210mm',
        minHeight: '297mm',
        padding: '15mm 20mm',
        background: 'white',
        fontFamily: '"Segoe UI", Arial, sans-serif',
        color: '#2c3e50',
        fontSize: '11px',
        lineHeight: '1.6'
      }}
    >
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* EN-TÊTE PROFESSIONNEL */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottom: '3px solid #1890ff',
        paddingBottom: '20px',
        marginBottom: '30px'
      }}>
        {/* Logo/Entreprise */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '26px',
            fontWeight: 'bold',
            color: '#1890ff',
            marginBottom: '4px',
            letterSpacing: '0.5px'
          }}>
            {parametres?.nom_entreprise || 'NAFIMAX TECHNOLOGY'}
          </div>
          <div style={{
            fontSize: '13px',
            color: '#888',
            fontStyle: 'italic',
            marginBottom: '12px'
          }}>
            {parametres?.slogan || 'Votre partenaire de confiance'}
          </div>
          
          <div style={{ fontSize: '10px', color: '#666', lineHeight: '1.8' }}>
            {(() => {
              const acts = (() => { try { return JSON.parse(parametres?.activites || '[]') } catch { return [] } })()
              const sacts = (() => { try { return JSON.parse(parametres?.sous_activites || '[]') } catch { return [] } })()
              return (
                <>
                  {acts.length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ fontWeight: 'bold', color: '#1890ff' }}>💼 </span>
                      {acts.join(' • ')}
                    </div>
                  )}
                  {sacts.length > 0 && (
                    <div style={{ marginBottom: 6, color: '#888', fontSize: 9 }}>
                      🔖 {sacts.join(' • ')}
                    </div>
                  )}
                </>
              )
            })()}
            <div>📍 {parametres?.adresse || 'Adresse non configurée'}</div>
            <div>📞 {parametres?.telephone || 'Téléphone 1 non configuré'}</div>
            {parametres?.telephone_secondaire && <div>📞 {parametres.telephone_secondaire}</div>}
            <div>✉️ {parametres?.email || 'Email non configuré'}</div>
             <div>🏢 RC: {parametres?.registre_commerce || 'Non configuré'}</div> 
            <div>🏛️ NINEA: {parametres?.ninea || 'Non configuré'}</div> 
          </div>
        </div>

        {/* Numéro facture */}
        <div style={{ textAlign: 'right', minWidth: '150px' }}>
          <div style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#1890ff',
            marginBottom: '8px'
          }}>
            {numero}
          </div>
          <div style={{
            fontSize: '11px',
            color: '#666',
            background: '#f0f5ff',
            padding: '8px 12px',
            borderRadius: '4px',
            marginBottom: '8px'
          }}>
            <div><strong>Date :</strong> {date}</div>
            <div style={{ marginTop: '4px' }}><strong>Mode :</strong> {facture.mode_paiement}</div>
            {facture.vendeur && (
              <div style={{ marginTop: '4px', borderTop: '1px solid #d6e4ff', paddingTop: '4px' }}>
                <strong>Vendeur :</strong> {facture.vendeur}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* INFORMATIONS CLIENT */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        marginBottom: '30px',
        padding: '16px',
        background: '#f9f9f9',
        borderRadius: '6px',
        border: '1px solid #efefef'
      }}>
        <div>
          <div style={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#1890ff',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Client Facturé
          </div>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#2c3e50' }}>
            {facture.client_nom || 'CLIENT ANONYME'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#1890ff',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Statut
          </div>
          {facture.est_pret === 1 ? (
            <div style={{
              display: 'inline-block',
              background: '#fff7e6',
              color: '#ff7a45',
              padding: '4px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              📋 CRÉDIT CLIENT
            </div>
          ) : facture.montant_du > 0 ? (
            <div style={{
              display: 'inline-block',
              background: '#fff2f0',
              color: '#ff4d4f',
              padding: '4px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              ⚠️ PAIEMENT PARTIEL
            </div>
          ) : (
            <div style={{
              display: 'inline-block',
              background: '#f6ffed',
              color: '#52c41a',
              padding: '4px 12px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              ✅ PAYÉE
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TABLEAU PRODUITS/SERVICES */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '30px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <thead>
          <tr style={{
            background: '#1890ff',
            color: 'white'
          }}>
            <th style={{
              padding: '12px',
              textAlign: 'left',
              fontWeight: 'bold',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.3px'
            }}>
              Désignation
            </th>
            <th style={{
              padding: '12px',
              textAlign: 'center',
              fontWeight: 'bold',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              width: '60px'
            }}>
              Qté
            </th>
            <th style={{
              padding: '12px',
              textAlign: 'right',
              fontWeight: 'bold',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              width: '90px'
            }}>
              P.U.
            </th>
            <th style={{
              padding: '12px',
              textAlign: 'right',
              fontWeight: 'bold',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              width: '100px'
            }}>
              Montant
            </th>
          </tr>
        </thead>
        <tbody>
          {panier.map((item, i) => (
            <tr
              key={i}
              style={{
                background: i % 2 === 0 ? '#ffffff' : '#f9f9f9',
                borderBottom: '1px solid #efefef',
                height: '40px',
                verticalAlign: 'middle'
              }}
            >
              <td style={{ padding: '12px' }}>
                <strong>{item.nom}</strong>
              </td>
              <td style={{
                padding: '12px',
                textAlign: 'center',
                color: '#666'
              }}>
                {item.quantite}
              </td>
              <td style={{
                padding: '12px',
                textAlign: 'right',
                color: '#666'
              }}>
                {item.prix_unitaire?.toLocaleString()} FCFA
              </td>
              <td style={{
                padding: '12px',
                textAlign: 'right',
                fontWeight: '500',
                color: '#1890ff'
              }}>
                {item.total?.toLocaleString()} FCFA
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* RÉSUMÉ FINANCIER */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '40px' }}>
        <div style={{ width: '320px' }}>
          {/* Ligne HT */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '10px 0',
            borderBottom: '1px solid #efefef',
            fontSize: '11px'
          }}>
            <span>Montant HT :</span>
            <span style={{ fontWeight: 'bold', minWidth: '100px', textAlign: 'right' }}>
              {montantHT.toLocaleString()} FCFA
            </span>
          </div>

          {/* Ligne TVA */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '10px 0',
            borderBottom: '2px solid #1890ff',
            fontSize: '11px'
          }}>
            <span>TVA ({parametres?.tva_taux || 18}%) :</span>
            <span style={{ fontWeight: 'bold', minWidth: '100px', textAlign: 'right' }}>
              {montantTVA.toLocaleString()} FCFA
            </span>
          </div>

          {/* TOTAL TTC - BIG */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            background: '#1890ff',
            color: 'white',
            borderRadius: '4px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '13px',
            fontWeight: 'bold'
          }}>
            <span>TOTAL TTC :</span>
            <span style={{ minWidth: '100px', textAlign: 'right' }}>
              {facture.montant_total?.toLocaleString()} FCFA
            </span>
          </div>

          {/* PAIEMENTS */}
          <div style={{
            background: '#f0f5ff',
            padding: '12px',
            borderRadius: '4px',
            border: '1px solid #d6e4ff'
          }}>
            <div style={{
              fontSize: '10px', fontWeight: 'bold', color: '#1890ff',
              marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.3px'
            }}>
              Détail du Paiement
            </div>

            {/* Montant total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '11px' }}>
              <span>🧾 Total facture :</span>
              <span style={{ fontWeight: 'bold', color: '#1890ff', minWidth: '100px', textAlign: 'right' }}>
                {(facture.montant_total || 0).toLocaleString('fr-FR')} FCFA
              </span>
            </div>

            {/* Montant remis (si différent du total) */}
            {(facture.montant_recu || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '11px' }}>
                <span>💵 Remis par le client :</span>
                <span style={{ fontWeight: 'bold', color: '#262626', minWidth: '100px', textAlign: 'right' }}>
                  {(facture.montant_recu || 0).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            )}

            {/* Monnaie rendue */}
            {(facture.montant_recu || 0) > (facture.montant_total || 0) && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', padding: '6px 8px',
                fontSize: '12px', background: '#f6ffed', borderRadius: '4px',
                border: '1px solid #b7eb8f', marginTop: '4px'
              }}>
                <span style={{ fontWeight: 'bold', color: '#389e0d' }}>💚 Monnaie rendue :</span>
                <span style={{ fontWeight: 'bold', color: '#389e0d', minWidth: '100px', textAlign: 'right' }}>
                  {((facture.montant_recu || 0) - (facture.montant_total || 0)).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            )}

            {/* Montant payé (si partiel) */}
            {(facture.montant_du || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '11px' }}>
                <span>✅ Montant réglé :</span>
                <span style={{ fontWeight: 'bold', color: '#52c41a', minWidth: '100px', textAlign: 'right' }}>
                  {(facture.montant_paye || 0).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            )}

            {/* Montant dû */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', padding: '6px 0',
              fontSize: '11px', borderTop: '1px solid #d6e4ff', marginTop: '6px', paddingTop: '8px'
            }}>
              <span>{(facture.montant_du || 0) > 0 ? '❗ Reste à payer :' : '✅ Solde :'}</span>
              <span style={{
                fontWeight: 'bold',
                color: (facture.montant_du || 0) > 0 ? '#ff4d4f' : '#52c41a',
                minWidth: '100px', textAlign: 'right'
              }}>
                {(facture.montant_du || 0) > 0
                  ? `${(facture.montant_du || 0).toLocaleString('fr-FR')} FCFA`
                  : 'Payée intégralement'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PIED DE PAGE */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div style={{
        borderTop: '2px solid #1890ff',
        paddingTop: '16px',
        marginTop: '40px',
        color: '#888',
        fontSize: '9px',
        textAlign: 'center',
        fontStyle: 'italic'
      }}>
        <div style={{ marginBottom: '8px' }}>
          {parametres?.mention_facture || 'Merci pour votre confiance ! Nous apprécions votre business.'}
        </div>
        <div style={{ color: '#aaa', fontSize: '8px' }}>
          Facture générée le {date} • {parametres?.nom_entreprise || 'Nafimax'} © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}

export default FacturePDF