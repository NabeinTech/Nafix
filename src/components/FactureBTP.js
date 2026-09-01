import React from 'react'
import { montantEnLettresFCFA } from '../utils/nombreEnLettres'

// Format facture BTP / Quincaillerie — demi-feuille A4 en portrait (format A5,
// 148mm × 210mm) : deux factures s'impriment sur une seule feuille A4, moins
// de gaspillage de papier qu'une facture pleine page pour un bon de vente
// comptoir.
//
// Même identité visuelle "premium" que FacturePDF.js / FactureA5.js (en-tête
// sombre, bandeau d'accent, tableau à en-tête foncé, "arrêtée à la somme de"
// en toutes lettres, signatures) — ce template restait le seul des 3 formats
// imprimables à ne pas l'avoir reçue. Conserve ses champs propres au métier
// BTP (Facturé par/à en deux colonnes, chantier, mentions livraison).
const COULEUR_SOMBRE = '#132743'
const COULEUR_ACCENT = '#0d9488'
const COULEUR_LABEL = '#2f6fed'
const COULEUR_TEXTE = '#000000'
const COULEUR_TEXTE_ATTENUE = '#1c1c1c'
// Plus bas que FactureA5.js (4 au lieu de 6) : ce format porte en plus le
// bloc Facturé par/à en deux colonnes, une notes et une signature que
// FactureA5.js n'a pas — sur la même demi-page 148×210mm, la place
// disponible pour les lignes d'articles est donc plus restreinte.
const LIGNES_MINIMUM_ARTICLES = 4

function FactureBTP({ facture, parametres }) {
  const date = new Date(facture.created_at || Date.now()).toLocaleDateString('fr-FR')
  const numero = `F-${String(facture.id).padStart(4, '0')}`
  const panier = JSON.parse(facture.panier || '[]')
  const notes = (() => { try { return JSON.parse(facture.notes || '{}') } catch { return {} } })()
  const nombreLignesVides = Math.max(0, LIGNES_MINIMUM_ARTICLES - panier.length)
  const tva = parseFloat(parametres?.tva_taux || 18) / 100
  const montantHT = Math.round(facture.montant_total / (1 + tva))
  const montantTVA = Math.round(facture.montant_total - montantHT)

  const modeLabel = {
    especes: 'Espèces', wave: 'Wave', orange_money: 'Orange Money',
    cheque: 'Chèque', pret: 'Crédit'
  }[facture.mode_paiement] || facture.mode_paiement

  const ligneSeparation = (couleur = '#e5e7eb', epaisseur = '1px', marge = '8px 0') => (
    <div style={{ borderTop: `${epaisseur} solid ${couleur}`, margin: marge }} />
  )

  const statut = facture.est_pret === 1
    ? { texte: '📋 CRÉDIT', fond: '#fff7e6', couleur: '#ff7a45' }
    : facture.montant_du > 0
      ? { texte: '⚠️ PARTIEL', fond: '#fff2f0', couleur: '#ff4d4f' }
      : { texte: '✅ PAYÉE', fond: '#f0fdfa', couleur: COULEUR_ACCENT }

  return (
    <div
      id="facture-pdf"
      style={{
        width: '148mm',
        minHeight: '210mm',
        background: 'white',
        boxSizing: 'border-box',
        fontFamily: '"Segoe UI", Arial, sans-serif',
        color: COULEUR_TEXTE,
        fontSize: '12px',
        lineHeight: '1.6'
      }}
    >
      {/* ── En-tête sombre pleine largeur ── */}
      <div style={{ background: COULEUR_SOMBRE, color: 'white', padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.3px', marginBottom: '3px' }}>
            {(parametres?.nom_entreprise || 'NAFIMAX TECHNOLOGY').toUpperCase()}
          </div>
          <div style={{ fontSize: '9.5px', color: '#b8c4d9', marginBottom: '8px' }}>Quincaillerie · Matériaux BTP</div>
          <div style={{ fontSize: '9.5px', color: '#dce3f0', lineHeight: '1.8' }}>
            {parametres?.adresse && <div>📍 {parametres.adresse}</div>}
            <div>📞 {parametres?.telephone || 'Non configuré'}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: '95px' }}>
          <div style={{ fontSize: '19px', fontWeight: 800, letterSpacing: '0.5px' }}>FACTURE</div>
          <div style={{ fontSize: '11px', fontWeight: 700, marginTop: '4px' }}>N° {numero}</div>
          <div style={{ fontSize: '9px', color: '#b8c4d9', marginTop: '3px' }}>{date}</div>
        </div>
      </div>

      {/* ── Bandeau d'accent ── */}
      <div style={{ height: '4px', background: COULEUR_ACCENT }} />

      <div style={{ padding: '10px 14px 12px' }}>
        {/* ── Facturé par / Facturé à, encadrés côte à côte ── */}
        <div style={{
          display: 'flex', border: '1px solid #d1d5db', borderRadius: '6px', overflow: 'hidden', marginBottom: '10px'
        }}>
          <div style={{ flex: 1, padding: '7px 10px', borderRight: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: COULEUR_LABEL, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px' }}>Facturé par</div>
            <div style={{ fontSize: '11.5px', fontWeight: 700 }}>{parametres?.nom_entreprise || 'Nafix Store'}</div>
            <div style={{ fontSize: '9.5px', color: COULEUR_TEXTE_ATTENUE }}>{parametres?.adresse || 'Adresse non configurée'}</div>
            <div style={{ fontSize: '9.5px', color: COULEUR_TEXTE_ATTENUE }}>{parametres?.telephone || 'Tél. non configuré'}</div>
            {parametres?.ninea && <div style={{ fontSize: '9.5px', color: COULEUR_TEXTE_ATTENUE }}>NINEA : {parametres.ninea}</div>}
          </div>
          <div style={{ flex: 1, padding: '7px 10px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: COULEUR_LABEL, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px' }}>Facturé à</div>
            <div style={{ fontSize: '11.5px', fontWeight: 700 }}>{facture.client_nom || 'CLIENT ANONYME'}</div>
            <div style={{ fontSize: '9.5px', color: COULEUR_TEXTE_ATTENUE }}>Bon N° : {numero}</div>
            {notes.chantier && <div style={{ fontSize: '9.5px', color: COULEUR_TEXTE_ATTENUE }}>Chantier : {notes.chantier}</div>}
          </div>
        </div>

        {/* ── Statut ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '10px', color: COULEUR_TEXTE_ATTENUE }}>Paiement : <strong>{modeLabel}</strong></span>
          <span style={{ background: statut.fond, color: statut.couleur, padding: '5px 11px', borderRadius: '5px', fontSize: '10px', fontWeight: 700, border: `1px solid ${statut.couleur}` }}>
            {statut.texte}
          </span>
        </div>

        {/* ── Articles, tableau encadré avec ligne de séparation nette
             entre chaque article ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db' }}>
          <thead>
            <tr style={{ background: COULEUR_SOMBRE, color: 'white' }}>
              <th style={{ padding: '5px 9px', textAlign: 'left', fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Désignation</th>
              <th style={{ padding: '5px 9px', textAlign: 'center', fontSize: '9.5px', width: '38px' }}>Qté</th>
              <th style={{ padding: '5px 9px', textAlign: 'right', fontSize: '9.5px', width: '58px' }}>P.U.</th>
              <th style={{ padding: '5px 9px', textAlign: 'right', fontSize: '9.5px', width: '66px' }}>Montant</th>
            </tr>
          </thead>
          <tbody>
            {panier.map((item, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f6f8fb', borderBottom: '1px solid #cbd5e1' }}>
                <td style={{ padding: '4px 9px', fontWeight: 700, fontSize: '11.5px' }}>
                  {item.nom}{item.unite ? <span style={{ color: COULEUR_TEXTE_ATTENUE, fontWeight: 400 }}> ({item.unite})</span> : null}
                </td>
                <td style={{ padding: '4px 9px', textAlign: 'center', color: COULEUR_TEXTE, fontWeight: 600, fontSize: '11px' }}>{item.quantite}</td>
                <td style={{ padding: '4px 9px', textAlign: 'right', color: COULEUR_TEXTE, fontWeight: 600, fontSize: '11px' }}>{item.prix_unitaire?.toLocaleString()}</td>
                <td style={{ padding: '4px 9px', textAlign: 'right', fontWeight: 700, color: COULEUR_SOMBRE, fontSize: '11px' }}>{item.total?.toLocaleString()}</td>
              </tr>
            ))}
            {Array.from({ length: nombreLignesVides }).map((_, i) => (
              <tr key={`vide-${i}`} style={{ background: (panier.length + i) % 2 === 0 ? '#fff' : '#f6f8fb', borderBottom: '1px solid #cbd5e1' }}>
                <td style={{ padding: '4px 9px' }}>&nbsp;</td>
                <td style={{ padding: '4px 9px' }}>&nbsp;</td>
                <td style={{ padding: '4px 9px' }}>&nbsp;</td>
                <td style={{ padding: '4px 9px' }}>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        {ligneSeparation('#e5e7eb', '1px', '8px 0')}

        {/* ── Totaux, encadré ── */}
        <div style={{ border: '1px solid #ececec', borderRadius: '6px', padding: '6px 10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '11px' }}>
            <span>Montant HT :</span>
            <span style={{ fontWeight: 700 }}>{montantHT.toLocaleString()} FCFA</span>
          </div>
          {ligneSeparation('#e5e7eb', '1px', '0')}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '11px' }}>
            <span>TVA ({parametres?.tva_taux || 18}%) :</span>
            <span style={{ fontWeight: 700 }}>{montantTVA.toLocaleString()} FCFA</span>
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between', background: COULEUR_ACCENT, color: 'white',
            borderRadius: '6px', padding: '10px 13px', margin: '9px 0', fontSize: '13.5px', fontWeight: 800
          }}>
            <span>TOTAL À PAYER</span>
            <span>{facture.montant_total?.toLocaleString()} FCFA</span>
          </div>

          {(facture.montant_paye || 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '10.5px' }}>
              <span>💵 Payé :</span>
              <span style={{ fontWeight: 700 }}>{(facture.montant_paye || 0).toLocaleString('fr-FR')} FCFA</span>
            </div>
          )}
          {(facture.montant_du || 0) > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', padding: '6px 0 0 0', marginTop: '5px',
              borderTop: '1px solid #fecaca', paddingTop: '7px', fontSize: '11px'
            }}>
              <span>❗ Reliquat :</span>
              <span style={{ fontWeight: 800, color: '#dc2626' }}>{(facture.montant_du || 0).toLocaleString('fr-FR')} FCFA</span>
            </div>
          )}
        </div>

        {/* ── Arrêtée à la somme de ── */}
        <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: '6px', padding: '8px 12px', margin: '8px 0' }}>
          <div style={{ fontSize: '8.5px', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '3px' }}>
            Arrêtée à la somme de
          </div>
          <div style={{ fontSize: '11px', fontWeight: 600, fontStyle: 'italic' }}>
            {montantEnLettresFCFA(facture.montant_total || 0)}
          </div>
        </div>

        {/* ── Notes + signature côte à côte : gagne une ligne complète de
             hauteur par rapport à deux blocs empilés, sur une demi-page où
             chaque ligne compte. ── */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
          <div style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: '6px', padding: '5px 9px' }}>
            <div style={{ fontSize: '8.5px', fontWeight: 700, color: COULEUR_LABEL, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>Notes</div>
            <div style={{ fontSize: '7.5px', color: COULEUR_TEXTE_ATTENUE, lineHeight: '1.5' }}>
              Marchandises vérifiées à la livraison, aucun retour sans bon. Règlement à réception, sauf crédit accordé.
            </div>
          </div>
          <div style={{ flex: '0 0 130px', textAlign: 'center', paddingTop: '4px' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, color: COULEUR_TEXTE_ATTENUE, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Signature
            </div>
            <div style={{ borderTop: '1px solid #d1d5db', margin: '12px 0 0' }} />
          </div>
        </div>

        {/* Barre d'accent en pied de page, symétrique du bandeau sous
            l'en-tête. */}
        {ligneSeparation(COULEUR_ACCENT, '2px', '10px 0 6px 0')}

        {/* ── Pied de page ── */}
        <div style={{ color: COULEUR_TEXTE_ATTENUE, fontSize: '9px', textAlign: 'center', fontStyle: 'italic' }}>
          {parametres?.mention_facture || 'Merci pour votre confiance !'}
        </div>
      </div>
    </div>
  )
}

export default FactureBTP
