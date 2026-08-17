import React from 'react'

const fmt = (n) =>
  Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 }) + ' FCFA'

const fmtDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function FactureAvoir({ transaction, avoir, client, parametres, id }) {
  if (!transaction || !avoir || !client) return null

  const p = parametres || {}
  const panier = (() => {
    try { return JSON.parse(transaction.panier || '[]') } catch { return [] }
  })()

  const isAchat = transaction.type === 'achat'
  const txDate  = new Date(transaction.created_at || Date.now())

  const styles = {
    page: {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#1a1a1a',
      width: '210mm',
      minHeight: '297mm',
      margin: '0 auto',
      padding: '20mm 18mm',
      background: '#fff',
      boxSizing: 'border-box',
    },
    headerRow: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      marginBottom: '12px',
    },
    logo: {
      fontSize: '22px', fontWeight: 'bold', color: '#1565C0', letterSpacing: '1px'
    },
    badge: {
      display: 'inline-block',
      padding: '6px 18px',
      borderRadius: '4px',
      fontWeight: 'bold',
      fontSize: '15px',
      background: isAchat ? '#E3F2FD' : '#E8F5E9',
      color: isAchat ? '#1565C0' : '#2E7D32',
      border: `2px solid ${isAchat ? '#1565C0' : '#2E7D32'}`,
    },
    sectionTitle: {
      fontSize: '10px',
      fontWeight: 'bold',
      color: '#888',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      marginBottom: '4px',
    },
    divider: { borderTop: '2px solid #1565C0', margin: '10px 0' },
    thinDivider: { borderTop: '1px solid #e0e0e0', margin: '8px 0' },
    table: { width: '100%', borderCollapse: 'collapse', marginTop: '8px' },
    th: {
      background: '#1565C0', color: '#fff', padding: '8px 10px',
      fontSize: '11px', textAlign: 'left',
    },
    thR: {
      background: '#1565C0', color: '#fff', padding: '8px 10px',
      fontSize: '11px', textAlign: 'right',
    },
    td: { padding: '7px 10px', fontSize: '11px', borderBottom: '1px solid #f0f0f0' },
    tdR: { padding: '7px 10px', fontSize: '11px', borderBottom: '1px solid #f0f0f0', textAlign: 'right' },
    summaryBox: {
      background: '#F5F9FF', border: '1.5px solid #BBDEFB', borderRadius: '6px',
      padding: '14px 18px', marginTop: '16px',
    },
    summaryRow: {
      display: 'flex', justifyContent: 'space-between',
      padding: '4px 0', fontSize: '12px',
    },
    summaryRowTotal: {
      display: 'flex', justifyContent: 'space-between',
      padding: '8px 0 0', fontSize: '15px', fontWeight: 'bold',
      borderTop: '1.5px solid #90CAF9', marginTop: '4px',
    },
    alertBox: {
      background: '#FFF3E0', border: '1px solid #FF9800',
      borderRadius: '4px', padding: '8px 14px',
      marginTop: '12px', fontSize: '11px', color: '#E65100',
    },
    footer: {
      marginTop: '24px', textAlign: 'center',
      fontSize: '10px', color: '#888', borderTop: '1px solid #e0e0e0', paddingTop: '10px',
    },
  }

  return (
    <div id={id || 'facture-avoir-preview'} style={styles.page}>

      {/* ── En-tête ── */}
      <div style={styles.headerRow}>
        <div>
          <div style={styles.logo}>{p.nom_entreprise || 'NAFIX'}</div>
          {p.adresse   && <div style={{ fontSize: '11px', color: '#555', marginTop: '3px' }}>{p.adresse}</div>}
          {p.telephone && <div style={{ fontSize: '11px', color: '#555' }}>Tél : {p.telephone}</div>}
          {p.email     && <div style={{ fontSize: '11px', color: '#555' }}>Email : {p.email}</div>}
          {p.ninea     && <div style={{ fontSize: '11px', color: '#555' }}>NINEA : {p.ninea}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={styles.badge}>
            {isAchat ? 'FACTURE PRÉPAYÉE' : 'REÇU DE DÉPÔT'}
          </div>
          <div style={{ fontSize: '11px', marginTop: '8px', color: '#555' }}>
            Réf. transaction : <b>TXN-{String(transaction.id).padStart(6, '0')}</b>
          </div>
          <div style={{ fontSize: '11px', color: '#555' }}>
            Réf. compte : <b>{avoir.reference}</b>
          </div>
          <div style={{ fontSize: '11px', color: '#555' }}>
            Date : <b>{fmtDate(transaction.created_at)}</b>
          </div>
        </div>
      </div>

      <div style={styles.divider} />

      {/* ── Infos client + compte ── */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={styles.sectionTitle}>Client</div>
          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{client.nom}</div>
          {client.telephone && <div style={{ color: '#555', fontSize: '11px' }}>Tél : {client.telephone}</div>}
          {client.email     && <div style={{ color: '#555', fontSize: '11px' }}>Email : {client.email}</div>}
          {client.adresse   && <div style={{ color: '#555', fontSize: '11px' }}>Adresse : {client.adresse}</div>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={styles.sectionTitle}>Compte Prépayé</div>
          <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{avoir.reference}</div>
          <div style={{ color: '#555', fontSize: '11px' }}>
            Dépôt initial : <b>{fmt(avoir.montant_initial)}</b>
          </div>
          <div style={{ color: '#555', fontSize: '11px' }}>
            Ouvert le : {fmtDate(avoir.created_at)}
          </div>
          {avoir.description && (
            <div style={{ color: '#555', fontSize: '11px' }}>Note : {avoir.description}</div>
          )}
        </div>
      </div>

      <div style={styles.thinDivider} />

      {/* ── Libellé de la transaction ── */}
      <div style={{ marginBottom: '12px' }}>
        <div style={styles.sectionTitle}>Objet</div>
        <div style={{ fontSize: '13px' }}>{transaction.libelle || (isAchat ? 'Achat sur compte prépayé' : 'Dépôt sur compte prépayé')}</div>
      </div>

      {/* ── Détail panier (si achat avec articles) ── */}
      {isAchat && panier.length > 0 && (
        <>
          <div style={styles.sectionTitle}>Détail des articles</div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Désignation</th>
                <th style={{ ...styles.thR, width: '80px' }}>Qté</th>
                <th style={{ ...styles.thR, width: '130px' }}>Prix unit.</th>
                <th style={{ ...styles.thR, width: '130px' }}>Sous-total</th>
              </tr>
            </thead>
            <tbody>
              {panier.map((item, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  <td style={styles.td}>{item.nom || item.designation || '—'}</td>
                  <td style={styles.tdR}>{item.quantite || 1}</td>
                  <td style={styles.tdR}>{fmt(item.prix_unitaire || item.prix)}</td>
                  <td style={styles.tdR}>{fmt((item.prix_unitaire || item.prix || 0) * (item.quantite || 1))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── Résumé financier ── */}
      <div style={styles.summaryBox}>
        <div style={styles.sectionTitle}>Récapitulatif du compte</div>
        <div style={styles.summaryRow}>
          <span>Solde avant cette opération</span>
          <span>{fmt(transaction.solde_avant)}</span>
        </div>
        <div style={styles.summaryRow}>
          <span style={{ color: isAchat ? '#C62828' : '#2E7D32' }}>
            {isAchat ? '— Montant débité' : '+ Montant crédité'}
          </span>
          <span style={{ fontWeight: 'bold', color: isAchat ? '#C62828' : '#2E7D32' }}>
            {isAchat ? '- ' : '+ '}{fmt(transaction.montant)}
          </span>
        </div>
        <div style={styles.summaryRowTotal}>
          <span>Solde restant</span>
          <span style={{ color: '#1565C0' }}>{fmt(transaction.solde_apres)}</span>
        </div>
      </div>

      {/* ── Alerte solde bas ── */}
      {avoir.seuil_alerte > 0 && transaction.solde_apres <= avoir.seuil_alerte && (
        <div style={styles.alertBox}>
          ⚠️ Le solde du compte ({fmt(transaction.solde_apres)}) est inférieur ou égal au seuil d'alerte défini ({fmt(avoir.seuil_alerte)}).
          Pensez à recharger votre compte.
        </div>
      )}

      {/* ── Signature ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '36px' }}>
        <div style={{ textAlign: 'center', minWidth: '160px' }}>
          <div style={{ borderTop: '1px solid #333', paddingTop: '6px', fontSize: '11px', color: '#555' }}>
            Signature client
          </div>
        </div>
        <div style={{ textAlign: 'center', minWidth: '160px' }}>
          <div style={{ borderTop: '1px solid #333', paddingTop: '6px', fontSize: '11px', color: '#555' }}>
            Cachet & Signature
          </div>
        </div>
      </div>

      {/* ── Pied de page ── */}
      <div style={styles.footer}>
        {p.nom_entreprise || 'NAFIX'} — Document généré le {txDate.toLocaleDateString('fr-FR')}
        {p.telephone ? ` — Tél : ${p.telephone}` : ''}
        {p.email ? ` — ${p.email}` : ''}
        {p.adresse ? ` — ${p.adresse}` : ''}
      </div>

    </div>
  )
}
