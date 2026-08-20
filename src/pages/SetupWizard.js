import React, { useState } from 'react'
import { Typography, Button, Input, Spin, Alert, Card } from 'antd'
import {
  DatabaseOutlined, DesktopOutlined, ApiOutlined, ShopOutlined,
  CheckCircleOutlined, LoadingOutlined
} from '@ant-design/icons'

const { Title, Text } = Typography
const ipcRenderer = typeof window !== 'undefined' ? window.ipcRenderer : null

function SetupWizard() {
  // choix | local-encours | local-ok | client-form | client-encours
  const [etape, setEtape] = useState('choix')
  const [erreur, setErreur] = useState('')
  const [ipLocale, setIpLocale] = useState('')
  const [motDePasseServeur, setMotDePasseServeur] = useState('')
  const [parefeuOk, setParefeuOk] = useState(true)
  const [parefeuEnCours, setParefeuEnCours] = useState(false)
  const [hostSaisi, setHostSaisi] = useState('')
  const [passwordSaisi, setPasswordSaisi] = useState('')
  const [testEnCours, setTestEnCours] = useState(false)
  const [testResultat, setTestResultat] = useState(null) // null | true | false

  const choisirLocal = async (reseauOuvert) => {
    setErreur('')
    setEtape('local-encours')
    const res = await ipcRenderer.invoke('setup:configurerLocal', { reseauOuvert })
    if (res.erreur) {
      setErreur(res.erreur)
      setEtape('choix')
      return
    }
    if (reseauOuvert) {
      setIpLocale(res.ipLocale)
      setMotDePasseServeur(res.password || '')
      setParefeuOk(!!res.parefeuOk)
      setEtape('local-ok')
    } else {
      await ipcRenderer.invoke('setup:terminerConfiguration')
    }
  }

  const reessayerParefeu = async () => {
    setParefeuEnCours(true)
    const res = await ipcRenderer.invoke('setup:reessayerParefeu')
    setParefeuEnCours(false)
    setParefeuOk(!!res.succes)
  }

  const terminer = async () => {
    await ipcRenderer.invoke('setup:terminerConfiguration')
  }

  const testerConnexion = async () => {
    if (!hostSaisi.trim()) return
    setTestEnCours(true)
    setTestResultat(null)
    const res = await ipcRenderer.invoke('setup:testConnection', { host: hostSaisi.trim() })
    setTestEnCours(false)
    setTestResultat(!!res.succes)
  }

  const validerClient = async () => {
    if (!hostSaisi.trim() || !passwordSaisi) return
    setErreur('')
    setEtape('client-encours')
    const res = await ipcRenderer.invoke('setup:configurerConnexion', { host: hostSaisi.trim(), password: passwordSaisi })
    if (res.erreur) {
      setErreur(res.erreur)
      setEtape('client-form')
      return
    }
    // Le process principal relance l'application automatiquement.
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#f0f2f5' }}>
      {/* Panneau gauche — Branding */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 48, color: 'white'
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 24
        }}>
          <DatabaseOutlined style={{ fontSize: 32 }} />
        </div>
        <Title level={3} style={{ color: 'white', margin: '0 0 8px', textAlign: 'center' }}>
          Configuration initiale
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, textAlign: 'center', maxWidth: 360 }}>
          Première utilisation de Nafix sur ce poste — quelques secondes suffisent, aucune compétence technique requise.
        </Text>
      </div>

      {/* Panneau droit */}
      <div style={{
        width: 520, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 48, background: 'white', boxShadow: '-4px 0 24px rgba(0,0,0,0.08)'
      }}>
        {erreur && (
          <Alert type="error" showIcon message={erreur} style={{ width: '100%', marginBottom: 24 }} />
        )}

        {etape === 'choix' && (
          <div style={{ width: '100%' }}>
            <Title level={3} style={{ marginBottom: 24, textAlign: 'center' }}>
              Comment ce PC va-t-il fonctionner ?
            </Title>
            <Card
              hoverable
              onClick={() => choisirLocal(false)}
              style={{ marginBottom: 12, borderRadius: 12 }}
              styles={{ body: { padding: 20, display: 'flex', alignItems: 'center', gap: 16 } }}
            >
              <DesktopOutlined style={{ fontSize: 32, color: '#1890ff' }} />
              <div>
                <Text strong style={{ fontSize: 16, display: 'block' }}>Un seul poste (mono-poste)</Text>
                <Text style={{ color: '#888' }}>Nafix et sa base de données restent uniquement sur ce PC.</Text>
              </div>
            </Card>
            <Card
              hoverable
              onClick={() => choisirLocal(true)}
              style={{ marginBottom: 12, borderRadius: 12 }}
              styles={{ body: { padding: 20, display: 'flex', alignItems: 'center', gap: 16 } }}
            >
              <ShopOutlined style={{ fontSize: 32, color: '#1890ff' }} />
              <div>
                <Text strong style={{ fontSize: 16, display: 'block' }}>Ce PC est le serveur principal</Text>
                <Text style={{ color: '#888' }}>D'autres postes de la boutique se connecteront à celui-ci.</Text>
              </div>
            </Card>
            <Card
              hoverable
              onClick={() => setEtape('client-form')}
              style={{ borderRadius: 12 }}
              styles={{ body: { padding: 20, display: 'flex', alignItems: 'center', gap: 16 } }}
            >
              <ApiOutlined style={{ fontSize: 32, color: '#722ed1' }} />
              <div>
                <Text strong style={{ fontSize: 16, display: 'block' }}>Se connecter à un serveur existant</Text>
                <Text style={{ color: '#888' }}>Un autre PC de la boutique héberge déjà la base de données.</Text>
              </div>
            </Card>
          </div>
        )}

        {etape === 'local-encours' && (
          <div style={{ textAlign: 'center' }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 40 }} spin />} />
            <Title level={4} style={{ marginTop: 24 }}>Configuration en cours…</Title>
            <Text style={{ color: '#888' }}>
              Une fenêtre de confirmation Windows peut apparaître — acceptez-la pour continuer.
            </Text>
          </div>
        )}

        {etape === 'local-ok' && (
          <div style={{ textAlign: 'center', width: '100%' }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
            <Title level={4} style={{ marginTop: 16 }}>Serveur prêt !</Title>
            <Text style={{ display: 'block', marginBottom: 16 }}>
              Sur les autres postes, indiquez cette adresse et ce mot de passe lors de leur configuration :
            </Text>
            <Card style={{ background: '#f6ffed', border: '1px solid #b7eb8f', marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Adresse</Text>
              <Text strong style={{ fontSize: 24, color: '#389e0d' }}>{ipLocale}</Text>
            </Card>
            <Card style={{ background: '#f6ffed', border: '1px solid #b7eb8f', marginBottom: 16 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Mot de passe (notez-le, il ne sera plus réaffiché)</Text>
              <Text strong copyable style={{ fontSize: 16, color: '#389e0d', fontFamily: 'monospace' }}>{motDePasseServeur}</Text>
            </Card>

            {!parefeuOk && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16, textAlign: 'left' }}
                message="Le pare-feu n'a pas pu être ouvert automatiquement"
                description="La fenêtre d'autorisation Windows a peut-être été refusée ou fermée. Sans cette étape, les autres postes ne pourront pas se connecter à ce PC. Cliquez sur « Réessayer » et acceptez la fenêtre Windows qui apparaît."
              />
            )}

            {!parefeuOk && (
              <Button
                onClick={reessayerParefeu}
                loading={parefeuEnCours}
                style={{ width: '100%', marginBottom: 12 }}
              >
                Réessayer l'ouverture du pare-feu
              </Button>
            )}

            <Button type="primary" size="large" onClick={terminer} style={{ width: '100%' }}>
              {parefeuOk ? 'Continuer' : 'Continuer quand même'}
            </Button>
          </div>
        )}

        {etape === 'client-form' && (
          <div style={{ width: '100%' }}>
            <Title level={4} style={{ marginBottom: 8 }}>Adresse du serveur</Title>
            <Text style={{ color: '#888', display: 'block', marginBottom: 16 }}>
              Demandez cette adresse à la personne qui a configuré le PC serveur.
            </Text>
            <Input
              size="large"
              placeholder="Ex : 192.168.1.19"
              value={hostSaisi}
              onChange={e => { setHostSaisi(e.target.value); setTestResultat(null) }}
              style={{ marginBottom: 12 }}
            />
            <Button
              icon={<ApiOutlined />}
              onClick={testerConnexion}
              loading={testEnCours}
              disabled={!hostSaisi.trim()}
              style={{ width: '100%', marginBottom: 12 }}
            >
              Tester la connexion
            </Button>
            {testResultat === true && (
              <Alert type="success" showIcon message="Connexion réussie !" style={{ marginBottom: 12 }} />
            )}
            {testResultat === false && (
              <Alert type="warning" showIcon message="Serveur injoignable à cette adresse." style={{ marginBottom: 12 }} />
            )}
            <Text style={{ color: '#888', display: 'block', marginBottom: 8 }}>
              Mot de passe communiqué par le PC serveur :
            </Text>
            <Input.Password
              size="large"
              placeholder="Mot de passe du serveur"
              value={passwordSaisi}
              onChange={e => setPasswordSaisi(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <Button
              type="primary" size="large"
              onClick={validerClient}
              disabled={!hostSaisi.trim() || !passwordSaisi}
              style={{ width: '100%' }}
            >
              Valider
            </Button>
            <Button type="link" onClick={() => setEtape('choix')} style={{ marginTop: 8 }}>
              ← Retour
            </Button>
          </div>
        )}

        {etape === 'client-encours' && (
          <div style={{ textAlign: 'center' }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 40 }} spin />} />
            <Title level={4} style={{ marginTop: 24 }}>Connexion en cours…</Title>
          </div>
        )}
      </div>
    </div>
  )
}

export default SetupWizard
