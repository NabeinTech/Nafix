import React from 'react'
import { Button, Popconfirm, Tag } from 'antd'
import { LockOutlined } from '@ant-design/icons'

const LIBELLES_STATUT = {
  essai: 'Période d\'essai terminée',
  suspendu: 'Abonnement suspendu',
  annule: 'Abonnement annulé',
  impaye: 'Paiement en retard'
}

function EcranAbonnementBloque({ organisation, statutAbonnement, onLogout }) {
  const libelleStatut = LIBELLES_STATUT[statutAbonnement?.statut] || 'Abonnement inactif'

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
        Contactez votre administrateur pour régulariser votre abonnement.
      </p>
      {organisation?.nom && (
        <p style={{ margin: '4px 0' }}>
          Organisation : <strong>{organisation.nom}</strong>
        </p>
      )}
      <Tag color="red" style={{ borderRadius: 12, marginBottom: 24 }}>
        ● {statutAbonnement?.statut || 'inactif'}
      </Tag>
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
