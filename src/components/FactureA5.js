import React from 'react'
import { montantEnLettresFCFA } from '../utils/nombreEnLettres'

// Format A5 (148mm × 210mm) — plus compact que l'A4, pensé pour les
// commerces qui veulent un document plus détaillé qu'un ticket thermique
// sans consommer une feuille A4 entière.
//
// Meme identite visuelle "premium" que FacturePDF.js (en-tete sombre,
// bandeau d'accent, tableau a en-tete fonce, "arretee a la somme de" en
// toutes lettres), densifiee pour tenir dans les 148mm de large.
const COULEUR_SOMBRE = '#132743'
const COULEUR_ACCENT = '#0d9488'
const COULEUR_LABEL = '#2f6fed'
const COULEUR_TEXTE = '#111827'
const COULEUR_TEXTE_ATTENUE = '#374151'
// Demande explicite de l'utilisateur : le tableau des articles garde
// toujours un minimum de lignes (comme un carnet de factures pre-imprime),
// meme si seuls 1-3 articles sont reellement enregistres.
const LIGNES_MINIMUM_ARTICLES = 6

function FactureA5({ facture, parametres }) {
  const date = new Date(facture.created_at || Date.now()).toLocaleDateString('fr-FR')
  const numero = `F-${String(facture.id).padStart(4, '0')}`
  const panier = JSON.parse(facture.panier || '[]')
  const nombreLignesVides = Math.max(0, LIGNES_MINIMUM_ARTICLES - panier.length)
  const tva = parseFloat(parametres?.tva_taux || 18) / 100
  const montantHT = Math.round(facture.montant_total / (1 + tva))
  const montantTVA = Math.round(facture.montant_total - montantHT)

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
          {parametres?.slogan && (
            <div style={{ fontSize: '9.5px', color: '#b8c4d9', marginBottom: '8px' }}>{parametres.slogan}</div>
          )}
          <div style={{ fontSize: '9.5px', color: '#dce3f0', lineHeight: '1.8' }}>
            {parametres?.adresse && <div>📍 {parametres.adresse}</div>}
            <div>📞 {parametres?.telephone || 'Non configuré'}{parametres?.telephone_secondaire ? ` / ${parametres.telephone_secondaire}` : ''}</div>
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
        {/* ── Client + statut ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '9px', fontWeight: 700, color: COULEUR_LABEL, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Facturé à</div>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>{facture.client_nom || 'CLIENT ANONYME'}</div>
            {facture.vendeur && <div style={{ fontSize: '10px', color: COULEUR_TEXTE_ATTENUE }}>Servi par {facture.vendeur}</div>}
          </div>
          <span style={{ background: statut.fond, color: statut.couleur, padding: '5px 11px', borderRadius: '5px', fontSize: '10px', fontWeight: 700 }}>
            {statut.texte}
          </span>
        </div>

        {ligneSeparation('#e5e7eb', '1px', '12px 0')}

        {/* ── Articles ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f6f8fb', borderBottom: '1px solid #ececec' }}>
                <td style={{ padding: '4px 9px', fontWeight: 700, fontSize: '11.5px' }}>{item.nom}</td>
                <td style={{ padding: '4px 9px', textAlign: 'center', color: COULEUR_TEXTE_ATTENUE, fontSize: '11px' }}>{item.quantite}</td>
                <td style={{ padding: '4px 9px', textAlign: 'right', color: COULEUR_TEXTE_ATTENUE, fontSize: '11px' }}>{item.prix_unitaire?.toLocaleString()}</td>
                <td style={{ padding: '4px 9px', textAlign: 'right', fontWeight: 700, color: COULEUR_SOMBRE, fontSize: '11px' }}>{item.total?.toLocaleString()}</td>
              </tr>
            ))}
            {Array.from({ length: nombreLignesVides }).map((_, i) => (
              <tr key={`vide-${i}`} style={{ background: (panier.length + i) % 2 === 0 ? '#fff' : '#f6f8fb', borderBottom: '1px solid #ececec' }}>
                <td style={{ padding: '4px 9px' }}>&nbsp;</td>
                <td style={{ padding: '4px 9px' }}>&nbsp;</td>
                <td style={{ padding: '4px 9px' }}>&nbsp;</td>
                <td style={{ padding: '4px 9px' }}>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        {ligneSeparation('#e5e7eb', '1px', '8px 0')}

        {/* ── Totaux ── */}
        <div>
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

          {(facture.montant_recu || 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '10.5px' }}>
              <span>💵 Remis :</span>
              <span style={{ fontWeight: 700 }}>{(facture.montant_recu || 0).toLocaleString('fr-FR')} FCFA</span>
            </div>
          )}
          {(facture.montant_recu || 0) > (facture.montant_total || 0) && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', padding: '5px 8px', fontSize: '10.5px',
              background: '#f0fdfa', borderRadius: '5px', border: '1px solid #99f6e4', marginTop: '4px'
            }}>
              <span style={{ fontWeight: 700, color: '#0f766e' }}>💚 Monnaie :</span>
              <span style={{ fontWeight: 700, color: '#0f766e' }}>
                {((facture.montant_recu || 0) - (facture.montant_total || 0)).toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          )}
          {(facture.montant_du || 0) > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', padding: '6px 0 0 0', marginTop: '5px',
              borderTop: '1px solid #fecaca', paddingTop: '7px', fontSize: '11px'
            }}>
              <span>❗ Reste à payer :</span>
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

        {ligneSeparation('#e5e7eb', '1px', '10px 0')}

        {/* ── Pied de page ── */}
        <div style={{ color: COULEUR_TEXTE_ATTENUE, fontSize: '9px', textAlign: 'center', fontStyle: 'italic' }}>
          {parametres?.mention_facture || 'Merci pour votre confiance !'}
        </div>
      </div>
    </div>
  )
}

export default FactureA5
