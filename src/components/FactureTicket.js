import React from 'react'
import { montantEnLettresFCFA } from '../utils/nombreEnLettres'

// Format ticket thermique (72mm) — même identité visuelle "premium" que
// FacturePDF.js/FactureA5.js/FactureBTP.js (en-tête sombre, bandeau teal,
// tableau à en-tête foncé), demande explicite malgré le risque qu'une
// imprimante thermique réellement monochrome rende les aplats de couleur en
// noir plein (l'impression noir & blanc forcée, voir main.js/ipc-shim.js
// impression:imprimerHTML, ne s'applique qu'aux formats facture — jamais au
// ticket, laissé en couleur ici par choix explicite).
//
// Conserve les champs propres au ticket (heure, caissier, table/type de
// service) — pas de bloc signature ni de tableau vide de complément : un
// ticket de caisse reste court, jamais artificiellement rallongé.
const COULEUR_SOMBRE = '#132743'
const COULEUR_ACCENT = '#0d9488'
const COULEUR_LABEL = '#2f6fed'
const COULEUR_TEXTE = '#000000'
const COULEUR_TEXTE_ATTENUE = '#1c1c1c'

function FactureTicket({ facture, parametres }) {
  const dateFacture = new Date(facture.created_at || Date.now())
  const heure = dateFacture.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const date = dateFacture.toLocaleDateString('fr-FR')
  const numero = `T-${String(facture.id).padStart(4, '0')}`
  const panier = JSON.parse(facture.panier || '[]')
  const tva = parseFloat(parametres?.tva_taux || 18) / 100
  const montantHT = Math.round(facture.montant_total / (1 + tva))
  const montantTVA = Math.round(facture.montant_total - montantHT)
  const montantRecu = facture.montant_recu || facture.montant_paye || 0
  const monnaie = Math.max(0, montantRecu - (facture.montant_total || 0))
  const notes = (() => { try { return JSON.parse(facture.notes || '{}') } catch { return {} } })()
  const typeLabel = { sur_place: 'Sur place', emporter: 'À emporter', livraison: 'Livraison' }
  const modeLabel = {
    especes: 'Espèces', wave: 'Wave', orange_money: 'Orange Money',
    cheque: 'Chèque', pret: 'Crédit'
  }[facture.mode_paiement] || facture.mode_paiement

  const activites = (() => { try { return JSON.parse(parametres?.activites || '[]') } catch { return [] } })()

  const ligneSeparation = (couleur = '#e5e7eb', epaisseur = '1px', marge = '6px 0') => (
    <div style={{ borderTop: `${epaisseur} solid ${couleur}`, margin: marge }} />
  )

  const ligne = (gauche, droite, bold = false, size = 10) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: size, fontWeight: bold ? 700 : 400, marginBottom: 2 }}>
      <span>{gauche}</span>
      <span>{droite}</span>
    </div>
  )

  const statut = facture.est_pret === 1
    ? { texte: '📋 CRÉDIT', fond: '#fff7e6', couleur: '#ff7a45' }
    : facture.montant_du > 0
      ? { texte: '⚠️ PARTIEL', fond: '#fff2f0', couleur: '#ff4d4f' }
      : { texte: '✅ PAYÉ', fond: '#f0fdfa', couleur: COULEUR_ACCENT }

  return (
    <div
      id="facture-pdf"
      style={{
        width: '72mm',
        background: 'white',
        boxSizing: 'border-box',
        fontFamily: '"Segoe UI", Arial, sans-serif',
        color: COULEUR_TEXTE,
        fontSize: '11px',
        lineHeight: '1.5'
      }}
    >
      {/* ── En-tête sombre pleine largeur ── */}
      <div style={{ background: COULEUR_SOMBRE, color: 'white', padding: '9px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.3px' }}>
          {(parametres?.nom_entreprise || 'NAFIX STORE').toUpperCase()}
        </div>
        {parametres?.slogan && (
          <div style={{ fontSize: '8px', color: '#b8c4d9', marginTop: 2 }}>{parametres.slogan}</div>
        )}
        {activites.length > 0 && (
          <div style={{ fontSize: '8px', color: '#dce3f0', marginTop: 2 }}>{activites.join(' · ')}</div>
        )}
        <div style={{ fontSize: '8px', color: '#dce3f0', marginTop: 3, lineHeight: '1.6' }}>
          {parametres?.adresse && <div>{parametres.adresse}</div>}
          <div>{parametres?.telephone || ''}{parametres?.telephone_secondaire ? ` / ${parametres.telephone_secondaire}` : ''}</div>
          {parametres?.ninea && <div>NINEA : {parametres.ninea}</div>}
        </div>
      </div>

      {/* ── Bandeau d'accent ── */}
      <div style={{ height: '3px', background: COULEUR_ACCENT }} />

      <div style={{ padding: '8px 8px 10px' }}>
        {/* ── Infos ticket ── */}
        <div style={{ border: '1px solid #d1d5db', borderRadius: '5px', padding: '6px 8px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: '11px', fontWeight: 700 }}>N° {numero}</span>
            <span style={{ background: statut.fond, color: statut.couleur, padding: '2px 7px', borderRadius: '10px', fontSize: '9px', fontWeight: 700, border: `1px solid ${statut.couleur}` }}>
              {statut.texte}
            </span>
          </div>
          {ligne('Date :', `${date} ${heure}`)}
          {facture.vendeur && ligne('Caissier :', facture.vendeur)}
          {notes.table && ligne('Table :', notes.table === 'comptoir' ? 'Comptoir' : notes.table === 'terrasse' ? 'Terrasse' : notes.table === 'vip' ? 'Salon VIP' : `Table ${notes.table}`)}
          {notes.type && ligne('Type :', typeLabel[notes.type] || notes.type)}
          {facture.client_nom && facture.client_nom !== 'Client anonyme' && ligne('Client :', facture.client_nom)}
          {ligne('Paiement :', modeLabel)}
        </div>

        {/* ── Articles, tableau encadré avec ligne de séparation nette
             entre chaque article ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db' }}>
          <thead>
            <tr style={{ background: COULEUR_SOMBRE, color: 'white' }}>
              <th style={{ padding: '4px 6px', textAlign: 'left', fontSize: '8.5px', textTransform: 'uppercase' }}>Article</th>
              <th style={{ padding: '4px 6px', textAlign: 'right', fontSize: '8.5px' }}>Qté</th>
              <th style={{ padding: '4px 6px', textAlign: 'right', fontSize: '8.5px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {panier.map((item, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f6f8fb', borderBottom: '1px solid #cbd5e1' }}>
                <td style={{ padding: '4px 6px', fontWeight: 700, fontSize: '10px' }}>
                  {item.nom}
                  <div style={{ fontWeight: 400, color: COULEUR_TEXTE_ATTENUE, fontSize: '8.5px' }}>
                    {item.quantite} {item.unite || 'pcs'} × {item.prix_unitaire?.toLocaleString()} F
                  </div>
                </td>
                <td style={{ padding: '4px 6px', textAlign: 'right', color: COULEUR_TEXTE, fontWeight: 600, fontSize: '10px', verticalAlign: 'top' }}>{item.quantite}</td>
                <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700, color: COULEUR_SOMBRE, fontSize: '10px', verticalAlign: 'top' }}>{item.total?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {ligneSeparation('#e5e7eb', '1px', '7px 0')}

        {/* ── Totaux, encadré ── */}
        <div style={{ border: '1px solid #ececec', borderRadius: '5px', padding: '5px 8px' }}>
          {ligne('Sous-total HT :', `${montantHT.toLocaleString()} F`)}
          {ligne(`TVA (${parametres?.tva_taux || 18}%) :`, `${montantTVA.toLocaleString()} F`)}

          <div style={{
            display: 'flex', justifyContent: 'space-between', background: COULEUR_ACCENT, color: 'white',
            borderRadius: '5px', padding: '7px 9px', margin: '7px 0 5px', fontSize: '13px', fontWeight: 800
          }}>
            <span>TOTAL TTC</span>
            <span>{facture.montant_total?.toLocaleString()} FCFA</span>
          </div>

          {montantRecu > 0 && ligne('Remis :', `${montantRecu.toLocaleString('fr-FR')} F`, false, 9.5)}
          {monnaie > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', padding: '4px 7px', fontSize: '10px',
              background: '#f0fdfa', borderRadius: '5px', border: '1px solid #99f6e4', marginTop: 4
            }}>
              <span style={{ fontWeight: 700, color: '#0f766e' }}>💚 Monnaie :</span>
              <span style={{ fontWeight: 700, color: '#0f766e' }}>{monnaie.toLocaleString('fr-FR')} FCFA</span>
            </div>
          )}
          {facture.montant_du > 0 && facture.est_pret !== 1 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', padding: '5px 0 0', marginTop: 4,
              borderTop: '1px solid #fecaca', paddingTop: 6, fontSize: '10px'
            }}>
              <span>❗ Reste dû :</span>
              <span style={{ fontWeight: 800, color: '#dc2626' }}>{facture.montant_du?.toLocaleString()} FCFA</span>
            </div>
          )}
        </div>

        {/* ── Arrêtée à la somme de ── */}
        <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: '5px', padding: '6px 8px', margin: '8px 0' }}>
          <div style={{ fontSize: '7.5px', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', marginBottom: 2 }}>
            Arrêtée à la somme de
          </div>
          <div style={{ fontSize: '9.5px', fontWeight: 600, fontStyle: 'italic' }}>
            {montantEnLettresFCFA(facture.montant_total || 0)}
          </div>
        </div>

        {/* Barre d'accent en pied de page, symétrique du bandeau sous
            l'en-tête. */}
        {ligneSeparation(COULEUR_ACCENT, '2px', '8px 0 6px 0')}

        {/* ── Pied de page ── */}
        <div style={{ textAlign: 'center', fontSize: '9px' }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>
            {parametres?.mention_facture || 'Merci pour votre visite !'}
          </div>
          <div style={{ color: COULEUR_TEXTE_ATTENUE, fontSize: '8px' }}>
            {date} {heure} · {parametres?.nom_entreprise || 'Nafix'}
          </div>
          <div style={{ marginTop: 6, letterSpacing: 3, fontSize: 18 }}>||||||||||||||||</div>
          <div style={{ fontSize: '8px', color: COULEUR_TEXTE_ATTENUE, marginTop: 2 }}>{numero}</div>
        </div>
      </div>
    </div>
  )
}

export default FactureTicket
