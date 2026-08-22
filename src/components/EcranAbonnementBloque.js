import React, { useState } from 'react'
import { Button, Popconfirm, Tag, message } from 'antd'
import { LockOutlined } from '@ant-design/icons'

const ipcRenderer = typeof window !== 'undefined' ? window.ipcRenderer : null

const LIBELLES_STATUT = {
  essai: 'Période d\'essai terminée',
  suspendu: 'Abonnement suspendu',
  annule: 'Abonnement annulé',
  impaye: 'Paiement en retard'
}

function EcranAbonnementBloque({ organisation, statutAbonnement, utilisateur, onLogout }) {
  const [chargementPaiement, setChargementPaiement] = useState(false)
  const libelleStatut = LIBELLES_STATUT[statutAbonnement?.statut] || 'Abonnement inactif'
  const estAdministrateur = utilisateur?.role === 'administrateur'

  // Chantier PayDunya — cree une facture et redirige vers le paiement
  // hebergee. En Electron, main.js ouvre deja le navigateur systeme
  // (shell.openExternal) et renvoie juste {succes:true} ; en web, ipc-shim.js
  // renvoie {url} qu'il faut suivre nous-memes.
  async function payerMaintenant() {
    if (!ipcRenderer) return
    setChargementPaiement(true)
    try {
      const resultat = await ipcRenderer.invoke('abonnement:payer', { codePlan: statutAbonnement?.plan_code })
      if (resultat?.erreur) { message.error(`❌ ${resultat.erreur}`); return }
      if (resultat?.url) window.location.href = resultat.url
    } catch (e) {
      message.error('❌ Impossible de contacter le prestataire de paiement.')
    } finally {
      setChargementPaiement(false)
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '100vh', color: '#888', textAlign: 'center',
      background: '#f5f5f5'
    }}>
      <LockOutlined style={{ fontSize: 64, marginBottom: 16, color: '#cf1322' }} />
      <h2 style={{ color: '#333', marginBottom: 4 }}>{libelleStatut}</h2>
      <p style={{ maxWidth: 420 }}>
        {estAdministrateur
          ? 'Réglez votre abonnement pour retrouver l\'accès immédiatement.'
          : 'Contactez votre administrateur pour régulariser votre abonnement.'}
      </p>
      {organisation?.nom && (
        <p style={{ margin: '4px 0' }}>
          Organisation : <strong>{organisation.nom}</strong>
        </p>
      )}
      <Tag color="red" style={{ borderRadius: 12, marginBottom: 24 }}>
        ● {statutAbonnement?.statut || 'inactif'}
      </Tag>
      {estAdministrateur && (
        <Button
          type="primary"
          loading={chargementPaiement}
          onClick={payerMaintenant}
          style={{ marginBottom: 16 }}
        >
          Payer maintenant
        </Button>
      )}
      <Popconfirm
        title="Se déconnecter ?"
        description="Voulez-vous vraiment vous déconnecter ?"
        onConfirm={onLogout}
        okText="Oui"
        cancelText="Non"
      >
        <Button danger>Déconnexion</Button>
      </Popconfirm>
    </div>
  )
}

export default EcranAbonnementBloque
