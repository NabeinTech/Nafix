import React from 'react'
import { montantEnLettresFCFA } from '../utils/nombreEnLettres'

// Design "premium" — en-tete sombre pleine largeur, bandeau d'accent,
// tableau a en-tete fonce, ligne "arretee a la somme de" en toutes lettres,
// bloc signatures. Modele fourni par l'utilisateur (facture_premium_
// creative_nafimax_senegal.pdf), adapte pour des donnees reelles (pas de
// blancs a remplir a la main) et notre logique de calcul existante.
const COULEUR_SOMBRE = '#132743'
const COULEUR_ACCENT = '#0d9488'
const COULEUR_LABEL = '#2f6fed'
const COULEUR_TEXTE = '#111827'
const COULEUR_TEXTE_ATTENUE = '#374151'
// Demande explicite de l'utilisateur : le tableau des articles garde
// toujours un minimum de lignes (comme un carnet de factures pre-imprime),
// meme si seuls 1-3 articles sont reellement enregistres — complete avec
// des lignes vides plutot que de laisser un tableau visuellement tronque.
const LIGNES_MINIMUM_ARTICLES = 6

function FacturePDF({ facture, parametres }) {
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
    ? { texte: '📋 CRÉDIT CLIENT', fond: '#fff7e6', couleur: '#ff7a45' }
    : facture.montant_du > 0
      ? { texte: '⚠️ PARTIELLEMENT PAYÉE', fond: '#fff2f0', couleur: '#ff4d4f' }
      : { texte: '✅ PAYÉE', fond: '#f0fdfa', couleur: COULEUR_ACCENT }

  return (
    <div
      id="facture-pdf"
      style={{
        width: '210mm',
        minHeight: '297mm',
        background: 'white',
        boxSizing: 'border-box',
        fontFamily: '"Segoe UI", Arial, sans-serif',
        color: COULEUR_TEXTE,
        fontSize: '13px',
        lineHeight: '1.6'
      }}
    >
      {/* ── En-tête sombre pleine largeur ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch' }}>
        <div style={{ background: COULEUR_SOMBRE, color: 'white', padding: '18px 30px', flex: '0 0 60%' }}>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '2px' }}>
            {(parametres?.nom_entreprise || 'NAFIMAX TECHNOLOGY').toUpperCase()}
          </div>
          {parametres?.slogan && (
            <div style={{ fontSize: '12.5px', color: '#b8c4d9', marginBottom: '14px', letterSpacing: '0.3px' }}>
              {parametres.slogan}
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#dce3f0', lineHeight: '1.6' }}>
            {parametres?.adresse && <div>📍 {parametres.adresse}</div>}
            <div>
              📞 {parametres?.telephone || 'Non configuré'}
              {parametres?.telephone_secondaire ? ` • ${parametres.telephone_secondaire}` : ''}
            </div>
            {parametres?.email && <div>✉️ {parametres.email}</div>}
          </div>
        </div>
        <div style={{ flex: 1, padding: '18px 30px', textAlign: 'right' }}>
          <div style={{ fontSize: '32px', fontWeight: 800, color: COULEUR_SOMBRE, letterSpacing: '1px' }}>FACTURE</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: COULEUR_LABEL, marginTop: '6px' }}>N° {numero}</div>
          <div style={{ fontSize: '11.5px', color: COULEUR_TEXTE_ATTENUE, marginTop: '4px' }}>Émise le {date}</div>
          <div style={{ fontSize: '11.5px', color: COULEUR_TEXTE_ATTENUE }}>Mode de paiement : {facture.mode_paiement}</div>
        </div>
      </div>

      {/* ── Bandeau d'accent ── */}
      <div style={{ height: '6px', background: COULEUR_ACCENT }} />

      <div style={{ padding: '18px 30px' }}>
        {/* ── Client + détails ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '30px', marginBottom: '4px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: COULEUR_LABEL, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>
              Facturé à
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>
              {facture.client_nom || 'CLIENT ANONYME'}
            </div>
            {facture.vendeur && (
              <div style={{ fontSize: '12px', color: COULEUR_TEXTE_ATTENUE }}>Servi par {facture.vendeur}</div>
            )}
          </div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: COULEUR_LABEL, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>
              Informations légales
            </div>
            <div style={{ fontSize: '12px', color: COULEUR_TEXTE, lineHeight: '1.8' }}>
              {parametres?.ninea && <div><strong>NINEA :</strong> {parametres.ninea}</div>}
              {parametres?.registre_commerce && <div><strong>RC :</strong> {parametres.registre_commerce}</div>}
              <div><strong>Devise :</strong> Franc CFA (XOF)</div>
            </div>
          </div>
        </div>

        {ligneSeparation()}

        {/* ── Statut ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <span style={{ background: statut.fond, color: statut.couleur, padding: '6px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
            {statut.texte}
          </span>
        </div>

        {/* ── Articles ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4px' }}>
          <thead>
            <tr style={{ background: COULEUR_SOMBRE, color: 'white' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Désignation</th>
              <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: '11.5px', width: '70px' }}>Qté</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: '11.5px', width: '110px' }}>Prix unitaire</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: '11.5px', width: '120px' }}>Montant</th>
            </tr>
          </thead>
          <tbody>
            {panier.map((item, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f6f8fb', borderBottom: '1px solid #ececec' }}>
                <td style={{ padding: '8px 14px', fontWeight: 700, fontSize: '13px' }}>{item.nom}</td>
                <td style={{ padding: '8px 14px', textAlign: 'center', color: COULEUR_TEXTE_ATTENUE }}>{item.quantite}</td>
                <td style={{ padding: '8px 14px', textAlign: 'right', color: COULEUR_TEXTE_ATTENUE }}>{item.prix_unitaire?.toLocaleString()} FCFA</td>
                <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: COULEUR_SOMBRE }}>{item.total?.toLocaleString()} FCFA</td>
              </tr>
            ))}
            {Array.from({ length: nombreLignesVides }).map((_, i) => (
              <tr key={`vide-${i}`} style={{ background: (panier.length + i) % 2 === 0 ? '#ffffff' : '#f6f8fb', borderBottom: '1px solid #ececec' }}>
                <td style={{ padding: '8px 14px' }}>&nbsp;</td>
                <td style={{ padding: '8px 14px' }}>&nbsp;</td>
                <td style={{ padding: '8px 14px' }}>&nbsp;</td>
                <td style={{ padding: '8px 14px' }}>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Note de paiement + Totaux ── */}
        <div style={{ display: 'flex', gap: '24px', marginTop: '12px' }}>
          <div style={{ flex: 1, background: '#f6f8fb', borderRadius: '8px', padding: '12px 18px', border: '1px solid #ececec' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: COULEUR_LABEL, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Note de paiement
            </div>
            <div style={{ fontSize: '12px', color: COULEUR_TEXTE, marginBottom: '10px' }}>
              Merci de rappeler le numéro de facture lors de votre règlement.
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>Modes acceptés</div>
            <div style={{ fontSize: '11.5px', color: COULEUR_TEXTE_ATTENUE }}>
              Espèces • Wave • Orange Money • Virement • Chèque
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '12.5px' }}>
              <span>Montant HT :</span>
              <span style={{ fontWeight: 700 }}>{montantHT.toLocaleString()} FCFA</span>
            </div>
            {ligneSeparation('#e5e7eb', '1px', '0')}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '12.5px' }}>
              <span>TVA ({parametres?.tva_taux || 18}%) :</span>
              <span style={{ fontWeight: 700 }}>{montantTVA.toLocaleString()} FCFA</span>
            </div>
            {ligneSeparation(COULEUR_ACCENT, '2px', '0 0 12px 0')}
            <div style={{
              display: 'flex', justifyContent: 'space-between', background: COULEUR_ACCENT, color: 'white',
              borderRadius: '8px', padding: '13px 16px', fontSize: '17px', fontWeight: 800
            }}>
              <span>TOTAL À PAYER</span>
              <span>{facture.montant_total?.toLocaleString()} FCFA</span>
            </div>

            {(facture.montant_recu || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0 0', fontSize: '12px' }}>
                <span>💵 Remis par le client :</span>
                <span style={{ fontWeight: 700 }}>{(facture.montant_recu || 0).toLocaleString('fr-FR')} FCFA</span>
              </div>
            )}
            {(facture.montant_recu || 0) > (facture.montant_total || 0) && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', padding: '7px 10px', fontSize: '12px',
                background: '#f0fdfa', borderRadius: '6px', border: '1px solid #99f6e4', marginTop: '6px'
              }}>
                <span style={{ fontWeight: 700, color: '#0f766e' }}>💚 Monnaie rendue :</span>
                <span style={{ fontWeight: 700, color: '#0f766e' }}>
                  {((facture.montant_recu || 0) - (facture.montant_total || 0)).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            )}
            {(facture.montant_du || 0) > 0 && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', padding: '9px 0 0 0', marginTop: '6px',
                borderTop: '1px solid #fecaca', paddingTop: '9px', fontSize: '13px'
              }}>
                <span>❗ Reste à payer :</span>
                <span style={{ fontWeight: 800, color: '#dc2626' }}>{(facture.montant_du || 0).toLocaleString('fr-FR')} FCFA</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Arrêtée à la somme de ── */}
        <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: '8px', padding: '10px 18px', margin: '12px 0' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>
            Arrêtée à la somme de
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, fontStyle: 'italic' }}>
            {montantEnLettresFCFA(facture.montant_total || 0)}
          </div>
        </div>

        {/* ── Signatures ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '18px', paddingTop: '6px' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: COULEUR_TEXTE_ATTENUE, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Le client
            </div>
            <div style={{ borderTop: '1px solid #d1d5db', width: '160px', margin: '24px auto 0' }} />
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: COULEUR_TEXTE_ATTENUE, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Pour {parametres?.nom_entreprise || 'Nafimax'}
            </div>
            <div style={{ borderTop: '1px solid #d1d5db', width: '160px', margin: '24px auto 0' }} />
          </div>
        </div>

        {ligneSeparation('#e5e7eb', '1px', '12px 0 8px 0')}

        {/* ── Pied de page ── */}
        <div style={{ textAlign: 'center', fontSize: '10.5px', color: COULEUR_TEXTE_ATTENUE, fontStyle: 'italic' }}>
          {parametres?.mention_facture || 'Merci pour votre confiance !'}
        </div>
      </div>
    </div>
  )
}

export default FacturePDF
