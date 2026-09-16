import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Typography, Table, Tag, Progress, Badge, Alert } from 'antd'
import {
  ShoppingCartOutlined, TeamOutlined,
  ShoppingOutlined, RiseOutlined,
  WarningOutlined, CheckCircleOutlined,
  ArrowUpOutlined, ClockCircleOutlined, DollarOutlined, CalendarOutlined,
  WalletOutlined, BankOutlined, RollbackOutlined, FallOutlined
} from '@ant-design/icons'
import { getDomaine } from '../utils/domainConfig'

const { Title, Text } = Typography
const ipcRenderer = window.ipcRenderer

function Dashboard({ utilisateur }) {
  const role = utilisateur?.role || 'caissier'
  const estCaissier = role === 'caissier'

  const [stats, setStats] = useState({
    totalVentes: 0, chiffreAffaire: 0,
    totalClients: 0, totalProduits: 0,
    ventesJour: 0, caJour: 0, caJourPaye: 0,
    dernieresVentes: [], ventesAujourdhui: [], alertesStock: []
  })
  const [domaineActive, setDomaineActive] = useState(null)
  const [nomEntreprise, setNomEntreprise] = useState('Nafimax Store')
  const [logoPreview, setLogoPreview] = useState(null)

  const chargerDashboard = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('dashboard:getAll')
    setStats(data || {
      totalVentes: 0, chiffreAffaire: 0,
      totalClients: 0, totalProduits: 0,
      ventesJour: 0, caJour: 0, caJourPaye: 0,
      dernieresVentes: [], ventesAujourdhui: [], alertesStock: []
    })
  }

  const chargerDomaine = async () => {
    if (!ipcRenderer) return
    const domaine = await ipcRenderer.invoke('domaine:get')
    if (domaine?.type) setDomaineActive(domaine.type)
    const params = await ipcRenderer.invoke('parametres:get')
    if (params?.nom_entreprise) setNomEntreprise(params.nom_entreprise)
    if (params?.logo_base64) setLogoPreview(params.logo_base64)
  }

  useEffect(() => {
    chargerDashboard()
    chargerDomaine()

    // Rafraîchissement en temps réel sur événements ventes
    const rafraichir = () => chargerDashboard()
    if (ipcRenderer) {
      ipcRenderer.on('vente:created', rafraichir)
      ipcRenderer.on('vente:updated', rafraichir)
      ipcRenderer.on('vente:deleted', rafraichir)
    }

    // Fallback auto-refresh toutes les 30s
    const interval = setInterval(chargerDashboard, 30000)

    return () => {
      clearInterval(interval)
      if (ipcRenderer) {
        ipcRenderer.removeListener('vente:created', rafraichir)
        ipcRenderer.removeListener('vente:updated', rafraichir)
        ipcRenderer.removeListener('vente:deleted', rafraichir)
      }
    }
  }, [])

  const maintenant = new Date()
  const heure = maintenant.getHours()
  const salutation = heure < 12 ? 'Bonjour' : heure < 18 ? 'Bon après-midi' : 'Bonsoir'
  const prenom = utilisateur?.nom?.split(' ')[0] || ''

  const pctAvoir = stats.chiffreAffaireBrut > 0
    ? Math.round((stats.chiffreAffaireAvoir || 0) / stats.chiffreAffaireBrut * 100)
    : 0

  const cartes = [
    {
      titre: "CA Net",
      valeur: `${(stats.chiffreAffaire || 0).toLocaleString('fr-FR')} FCFA`,
      icone: <RiseOutlined />,
      bg: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
      sousTitre: stats.chiffreAffaireAvoir > 0
        ? `Espèces/mobile: ${(stats.chiffreAffaireCash || 0).toLocaleString('fr-FR')} · Prépayé: ${(stats.chiffreAffaireAvoir || 0).toLocaleString('fr-FR')} FCFA (${pctAvoir}%)`
        : stats.totalRetournes > 0
          ? `Brut: ${(stats.chiffreAffaireBrut || 0).toLocaleString('fr-FR')} — Retours: ${(stats.totalRetournes || 0).toLocaleString('fr-FR')} FCFA`
          : 'Total des ventes (après retours)'
    },
    {
      titre: 'Total Ventes',
      valeur: stats.totalVentes || 0,
      icone: <ShoppingCartOutlined />,
      bg: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
      sousTitre: 'Transactions effectuées'
    },
    {
      titre: 'Total Clients',
      valeur: stats.totalClients || 0,
      icone: <TeamOutlined />,
      bg: 'linear-gradient(135deg, #faad14 0%, #d48806 100%)',
      sousTitre: 'Clients enregistrés'
    },
    {
      titre: 'Total Produits',
      valeur: stats.totalProduits || 0,
      icone: <ShoppingOutlined />,
      bg: 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
      sousTitre: 'Articles en catalogue'
    }
  ]

  const couleurPaiement = (val) => {
    if (val === 'especes') return 'green'
    if (val === 'wave') return 'blue'
    if (val === 'orange_money') return 'orange'
    if (val === 'cheque') return 'purple'
    if (val === 'pret') return 'red'
    return 'gold'
  }

  const iconePaiement = (val) => {
    if (val === 'especes') return '💵'
    if (val === 'wave') return '🌊'
    if (val === 'orange_money') return '🟠'
    if (val === 'cheque') return '📝'
    if (val === 'pret') return '📋'
    return '💳'
  }

  const colonnesVentes = [
    {
      title: 'N°', dataIndex: 'id', key: 'id',
      render: (id) => (
        <Text strong style={{ color: '#1890ff' }}>
          V-{String(id).padStart(4, '0')}
        </Text>
      )
    },
    {
      title: 'Client', dataIndex: 'client_nom', key: 'client_nom',
      render: (val) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1890ff, #722ed1)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'white',
            fontSize: 12, fontWeight: 'bold', flexShrink: 0
          }}>
            {val ? val[0].toUpperCase() : 'A'}
          </div>
          <Text>{val || 'Anonyme'}</Text>
        </div>
      )
    },
    {
      title: 'Montant', dataIndex: 'montant_total', key: 'montant_total',
      render: (val) => (
        <Text strong style={{ color: '#52c41a' }}>
          {(val || 0).toLocaleString()} FCFA
        </Text>
      )
    },
    {
      title: 'Statut', key: 'statut',
      render: (_, record) => {
        if (record.est_pret) return <Tag color="orange" style={{ borderRadius: 12 }}>📋 Crédit</Tag>
        if (record.montant_du > 0) return <Tag color="red" style={{ borderRadius: 12 }}>⚠️ Partiel</Tag>
        return <Tag color="green" style={{ borderRadius: 12 }}>✅ Payée</Tag>
      }
    },
    {
      title: 'Paiement', dataIndex: 'mode_paiement', key: 'mode_paiement',
      render: (val) => (
        <Tag color={couleurPaiement(val)} style={{ borderRadius: 12 }}>
          {iconePaiement(val)} {val}
        </Tag>
      )
    }
  ]

  const colonnesStock = [
    {
      title: 'Produit', dataIndex: 'nom', key: 'nom',
      render: (val) => <Text strong>{val}</Text>
    },
    {
      title: 'Stock', dataIndex: 'stock_actuel', key: 'stock_actuel',
      render: (val, record) => {
        const pct = Math.min(Math.round((val / Math.max(record.stock_minimum * 3, 1)) * 100), 100)
        return (
          <div>
            <Tag color="red" style={{ borderRadius: 12 }}>{val} restants</Tag>
            <Progress percent={pct} size="small"
              strokeColor="#ff4d4f" showInfo={false}
              style={{ marginTop: 4, width: 80 }} />
          </div>
        )
      }
    }
  ]

  // ── En-tête commun ──────────────────────────────────────────
  const entete = (
    <div style={{
      background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
      borderRadius: 16, padding: '24px 32px', marginBottom: 24,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {logoPreview && (
          <img src={logoPreview} alt="Logo"
            style={{
              height: 56, width: 56, objectFit: 'contain',
              borderRadius: 10, background: 'rgba(255,255,255,0.15)',
              padding: 4, border: '1px solid rgba(255,255,255,0.3)'
            }} />
        )}
        <div>
          <Title level={2} style={{ color: 'white', margin: 0 }}>
            {salutation}{prenom ? `, ${prenom}` : ''} ! 👋
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15 }}>
            {domaineActive && getDomaine(domaineActive)
              ? <>{getDomaine(domaineActive)?.icone} {getDomaine(domaineActive)?.nom} — </>
              : null}
            {nomEntreprise}
          </Text>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 36, marginBottom: 4 }}>
          {domaineActive ? getDomaine(domaineActive)?.icone : '🖥️'}
        </div>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
          <ClockCircleOutlined /> {maintenant.toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          })}
        </Text>
      </div>
    </div>
  )

  // ── VUE CAISSIER ────────────────────────────────────────────
  const creditsJour = (stats.ventesAujourdhui || []).filter(v => v.est_pret).length
  const montantDuJour = (stats.ventesAujourdhui || []).reduce((acc, v) => acc + (v.montant_du || 0), 0)

  const colonnesCaissier = [
    {
      title: 'N°', dataIndex: 'id', key: 'id', width: 80,
      render: (id) => <Text strong style={{ color: '#1890ff' }}>V-{String(id).padStart(4, '0')}</Text>
    },
    {
      title: 'Client', dataIndex: 'client_nom', key: 'client_nom',
      render: (val) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1890ff, #722ed1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 11, fontWeight: 'bold', flexShrink: 0
          }}>
            {val ? val[0].toUpperCase() : 'A'}
          </div>
          <Text>{val || 'Anonyme'}</Text>
        </div>
      )
    },
    {
      title: 'Montant', dataIndex: 'montant_total', key: 'montant_total',
      render: (val) => <Text strong style={{ color: '#52c41a' }}>{(val || 0).toLocaleString()} FCFA</Text>
    },
    {
      title: 'Statut', key: 'statut',
      render: (_, r) => {
        if (r.est_pret) return <Tag color="orange" style={{ borderRadius: 12 }}>📋 Crédit</Tag>
        if (r.montant_du > 0) return <Tag color="red" style={{ borderRadius: 12 }}>⚠️ Partiel</Tag>
        return <Tag color="green" style={{ borderRadius: 12 }}>✅ Payée</Tag>
      }
    },
    {
      title: 'Paiement', dataIndex: 'mode_paiement', key: 'mode_paiement',
      render: (val) => (
        <Tag color={couleurPaiement(val)} style={{ borderRadius: 12 }}>
          {iconePaiement(val)} {val}
        </Tag>
      )
    },
    {
      title: 'Heure', dataIndex: 'created_at', key: 'heure',
      render: (val) => (
        <Text style={{ color: '#888', fontSize: 12 }}>
          {val ? new Date(val).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
        </Text>
      )
    }
  ]

  if (estCaissier) {
    return (
      <div style={{ paddingBottom: 24 }}>
        {entete}

        {/* 4 cartes chiffres du jour */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card style={{
              background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
              border: 'none', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.12)'
            }} bodyStyle={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, display: 'block', marginBottom: 6 }}>
                    CA Aujourd'hui
                  </Text>
                  <Title level={4} style={{ margin: 0, color: 'white', fontSize: 18 }}>
                    {(stats.caJour || 0).toLocaleString()} FCFA
                  </Title>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4, display: 'block' }}>
                    Espèces/mobile : {(stats.caJourCash || 0).toLocaleString('fr-FR')} FCFA
                    {stats.caJourAvoir > 0 && ` · Prépayé : ${(stats.caJourAvoir || 0).toLocaleString('fr-FR')} FCFA`}
                    {stats.retours?.jour?.montant > 0 && ` — Retours: ${stats.retours.jour.montant.toLocaleString('fr-FR')} FCFA`}
                  </Text>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 10, fontSize: 20, color: 'white' }}>
                  <DollarOutlined />
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{
              background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
              border: 'none', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.12)'
            }} bodyStyle={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, display: 'block', marginBottom: 6 }}>
                    Ventes Aujourd'hui
                  </Text>
                  <Title level={4} style={{ margin: 0, color: 'white', fontSize: 18 }}>
                    {stats.ventesJour || 0} transaction(s)
                  </Title>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4, display: 'block' }}>
                    Transactions du jour
                  </Text>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 10, fontSize: 20, color: 'white' }}>
                  <ShoppingCartOutlined />
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{
              background: 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
              border: 'none', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.12)'
            }} bodyStyle={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, display: 'block', marginBottom: 6 }}>
                    Panier Moyen
                  </Text>
                  <Title level={4} style={{ margin: 0, color: 'white', fontSize: 18 }}>
                    {stats.ventesJour > 0
                      ? Math.round(stats.caJour / stats.ventesJour).toLocaleString()
                      : 0} FCFA
                  </Title>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4, display: 'block' }}>
                    Valeur moyenne / vente
                  </Text>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 10, fontSize: 20, color: 'white' }}>
                  <CalendarOutlined />
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card style={{
              background: creditsJour > 0
                ? 'linear-gradient(135deg, #faad14 0%, #d48806 100%)'
                : 'linear-gradient(135deg, #13c2c2 0%, #08979c 100%)',
              border: 'none', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.12)'
            }} bodyStyle={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, display: 'block', marginBottom: 6 }}>
                    Crédits du jour
                  </Text>
                  <Title level={4} style={{ margin: 0, color: 'white', fontSize: 18 }}>
                    {creditsJour} crédit(s)
                  </Title>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4, display: 'block' }}>
                    Dû : {montantDuJour.toLocaleString()} FCFA
                  </Text>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 10, fontSize: 20, color: 'white' }}>
                  <ArrowUpOutlined />
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Tableau ventes du jour */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCartOutlined style={{ color: '#1890ff' }} />
              <span>Ventes du jour</span>
              <Badge count={stats.ventesAujourdhui?.length || 0} style={{ background: '#1890ff' }} />
            </div>
          }
          extra={
            stats.ventesAujourdhui?.length > 0 && (
              <Text style={{ color: '#52c41a', fontWeight: 'bold' }}>
                Total : {(stats.caJour || 0).toLocaleString()} FCFA
              </Text>
            )
          }
          style={{ borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
        >
          {!stats.ventesAujourdhui || stats.ventesAujourdhui.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
              <ShoppingCartOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
              <p style={{ marginTop: 12 }}>Aucune vente enregistrée aujourd'hui</p>
            </div>
          ) : (
            <Table dataSource={stats.ventesAujourdhui} columns={colonnesCaissier}
              rowKey="id" pagination={{ pageSize: 10, hideOnSinglePage: true }} size="small"
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={2}>
                    <Text strong>Total du jour</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2}>
                    <Text strong style={{ color: '#52c41a' }}>
                      {(stats.caJour || 0).toLocaleString()} FCFA
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} colSpan={3} />
                </Table.Summary.Row>
              )}
            />
          )}
        </Card>
      </div>
    )
  }

  // ── VUE GÉRANT / COMPTABLE / ADMIN ──────────────────────────
  return (
    <div style={{ paddingBottom: 24 }}>

      {!domaineActive && (
        <Alert type="info" showIcon style={{ marginBottom: 16, borderRadius: 10 }}
          message="💡 Domaine non configuré"
          description="Allez dans Paramètres → Domaine pour optimiser votre expérience Nafix." />
      )}

      {entete}

      {/* Chiffres du jour */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8}>
          <Card style={{
            background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
            border: 'none', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.12)'
          }} bodyStyle={{ padding: '18px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, display: 'block', marginBottom: 6 }}>
                  CA Aujourd'hui
                </Text>
                <Title level={4} style={{ margin: 0, color: 'white', fontSize: 18 }}>
                  {(stats.caJour || 0).toLocaleString()} FCFA
                </Title>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4, display: 'block' }}>
                  Espèces/mobile : {(stats.caJourCash || 0).toLocaleString('fr-FR')} FCFA
                  {stats.caJourAvoir > 0 && ` · Prépayé : ${(stats.caJourAvoir || 0).toLocaleString('fr-FR')} FCFA`}
                </Text>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 10, fontSize: 20, color: 'white' }}>
                <DollarOutlined />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card style={{
            background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
            border: 'none', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.12)'
          }} bodyStyle={{ padding: '18px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, display: 'block', marginBottom: 6 }}>
                  Ventes Aujourd'hui
                </Text>
                <Title level={4} style={{ margin: 0, color: 'white', fontSize: 18 }}>
                  {stats.ventesJour || 0} transaction(s)
                </Title>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4, display: 'block' }}>
                  Total : {stats.totalVentes || 0} ventes enregistrées
                </Text>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 10, fontSize: 20, color: 'white' }}>
                <ShoppingCartOutlined />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card style={{
            background: 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
            border: 'none', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.12)'
          }} bodyStyle={{ padding: '18px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, display: 'block', marginBottom: 6 }}>
                  Panier Moyen (jour)
                </Text>
                <Title level={4} style={{ margin: 0, color: 'white', fontSize: 18 }}>
                  {stats.ventesJour > 0
                    ? Math.round(stats.caJour / stats.ventesJour).toLocaleString()
                    : 0} FCFA
                </Title>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4, display: 'block' }}>
                  Global : {stats.totalVentes > 0 ? Math.round((stats.chiffreAffaire || 0) / stats.totalVentes).toLocaleString() : 0} FCFA
                </Text>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 10, fontSize: 20, color: 'white' }}>
                <CalendarOutlined />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Cartes KPI cumulatifs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {cartes.map((carte, i) => (
          <Col xs={24} sm={12} md={6} key={i}>
            <Card style={{
              background: carte.bg, border: 'none',
              borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.12)'
            }} bodyStyle={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, display: 'block', marginBottom: 8 }}>
                    {carte.titre}
                  </Text>
                  <Title level={3} style={{ margin: 0, color: 'white', fontSize: 20 }}>
                    {carte.valeur}
                  </Title>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4, display: 'block' }}>
                    {carte.sousTitre}
                  </Text>
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: 12, padding: 12, fontSize: 24, color: 'white'
                }}>
                  {carte.icone}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Comptes Prépayés ─────────────────────────────────── */}
      {/* ── Retours marchandises ─────────────────────────────── */}
      {(stats.retours?.total?.nb > 0) && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RollbackOutlined style={{ color: '#d32f2f' }} />
                  <span style={{ color: '#d32f2f', fontWeight: 700 }}>Retours & Remboursements</span>
                </div>
              }
              style={{ borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #FFCDD2' }}
              bodyStyle={{ padding: '16px 20px' }}
            >
              <Row gutter={[16, 0]}>
                {[
                  {
                    label: 'Retours aujourd\'hui',
                    value: stats.retours?.jour?.nb || 0,
                    suffix: `retour(s) — ${(stats.retours?.jour?.montant || 0).toLocaleString('fr-FR')} FCFA`,
                    icon: <RollbackOutlined />, color: '#c62828', bg: '#FFEBEE'
                  },
                  {
                    label: 'Retours ce mois',
                    value: stats.retours?.mois?.nb || 0,
                    suffix: `retour(s) — ${(stats.retours?.mois?.montant || 0).toLocaleString('fr-FR')} FCFA`,
                    icon: <FallOutlined />, color: '#e53935', bg: '#FFCDD2'
                  },
                  {
                    label: 'Total retours (cumulé)',
                    value: (stats.retours?.total?.montant || 0).toLocaleString('fr-FR'),
                    suffix: 'FCFA remboursés',
                    icon: <DollarOutlined />, color: '#b71c1c', bg: '#FFEBEE'
                  },
                  {
                    label: 'CA brut / CA net',
                    value: (stats.chiffreAffaireBrut || 0).toLocaleString('fr-FR'),
                    suffix: `→ net ${(stats.chiffreAffaire || 0).toLocaleString('fr-FR')} FCFA`,
                    icon: <RiseOutlined />, color: '#2e7d32', bg: '#E8F5E9'
                  }
                ].map((k, i) => (
                  <Col xs={24} sm={12} md={6} key={i}>
                    <div style={{
                      background: k.bg, borderRadius: 12, padding: '14px 16px',
                      display: 'flex', alignItems: 'center', gap: 12
                    }}>
                      <div style={{
                        background: k.color, color: 'white',
                        borderRadius: 10, padding: '8px 10px', fontSize: 18
                      }}>
                        {k.icon}
                      </div>
                      <div>
                        <div style={{ color: '#888', fontSize: 11, marginBottom: 2 }}>{k.label}</div>
                        <div style={{ color: k.color, fontWeight: 700, fontSize: 15 }}>
                          {k.value} <span style={{ fontSize: 11, fontWeight: 400 }}>{k.suffix}</span>
                        </div>
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        </Row>
      )}

      {(stats.avoirs?.nbActifs > 0 || stats.avoirs?.depotsMois > 0) && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <WalletOutlined style={{ color: '#1565C0' }} />
                  <span style={{ color: '#1565C0', fontWeight: 700 }}>Comptes Prépayés</span>
                </div>
              }
              style={{ borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #BBDEFB' }}
              bodyStyle={{ padding: '16px 20px' }}
            >
              <Row gutter={[16, 0]}>
                {[
                  {
                    label: 'Comptes actifs',
                    value: stats.avoirs?.nbActifs || 0,
                    suffix: 'compte(s)',
                    icon: <WalletOutlined />,
                    color: '#1565C0', bg: '#E3F2FD'
                  },
                  {
                    label: 'Soldes disponibles',
                    value: (stats.avoirs?.soldesTotaux || 0).toLocaleString('fr-FR'),
                    suffix: 'FCFA',
                    icon: <BankOutlined />,
                    color: '#0277BD', bg: '#E1F5FE'
                  },
                  {
                    label: 'Dépôts ce mois',
                    value: (stats.avoirs?.depotsMois || 0).toLocaleString('fr-FR'),
                    suffix: 'FCFA',
                    icon: <ArrowUpOutlined />,
                    color: '#2E7D32', bg: '#E8F5E9'
                  },
                  {
                    label: 'Achats prépayés ce mois',
                    value: (stats.avoirs?.achatsMois || 0).toLocaleString('fr-FR'),
                    suffix: `FCFA (${stats.avoirs?.nbAchatsMois || 0} achat(s))`,
                    icon: <ShoppingCartOutlined />,
                    color: '#E65100', bg: '#FFF3E0'
                  },
                  {
                    label: 'Dépôts aujourd\'hui',
                    value: (stats.avoirs?.depotJour || 0).toLocaleString('fr-FR'),
                    suffix: 'FCFA',
                    icon: <DollarOutlined />,
                    color: '#6A1B9A', bg: '#F3E5F5'
                  }
                ].map((k, i) => (
                  <Col xs={24} sm={12} md={Math.floor(24 / 5)} key={i}>
                    <div style={{
                      background: k.bg, borderRadius: 12, padding: '14px 16px',
                      display: 'flex', alignItems: 'center', gap: 12
                    }}>
                      <div style={{
                        background: k.color, color: 'white',
                        borderRadius: 10, padding: '8px 10px', fontSize: 18
                      }}>
                        {k.icon}
                      </div>
                      <div>
                        <div style={{ color: '#888', fontSize: 11, marginBottom: 2 }}>{k.label}</div>
                        <div style={{ color: k.color, fontWeight: 700, fontSize: 15 }}>
                          {k.value} <span style={{ fontSize: 11, fontWeight: 400 }}>{k.suffix}</span>
                        </div>
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]}>
        {/* Ventes du jour + dernières ventes */}
        <Col xs={24} md={15}>
          {/* Ventes du jour */}
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CalendarOutlined style={{ color: '#52c41a' }} />
                <span>Ventes du jour</span>
                <Badge count={stats.ventesAujourdhui?.length || 0} style={{ background: '#52c41a' }} />
              </div>
            }
            style={{ borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 16 }}
          >
            {!stats.ventesAujourdhui || stats.ventesAujourdhui.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#888' }}>
                <ShoppingCartOutlined style={{ fontSize: 36, color: '#d9d9d9' }} />
                <p style={{ marginTop: 8 }}>Aucune vente enregistrée aujourd'hui</p>
              </div>
            ) : (
              <Table dataSource={stats.ventesAujourdhui} columns={colonnesVentes}
                rowKey="id" pagination={{ pageSize: 5, hideOnSinglePage: true }} size="small" />
            )}
          </Card>

          {/* Dernières ventes (toutes périodes) */}
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingCartOutlined style={{ color: '#1890ff' }} />
                <span>Dernières Ventes</span>
                <Badge count={stats.dernieresVentes?.length || 0} style={{ background: '#1890ff' }} />
              </div>
            }
            extra={
              <Text style={{ color: '#1890ff', fontSize: 13 }}>
                <ArrowUpOutlined /> {stats.totalVentes} vente(s) au total
              </Text>
            }
            style={{ borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
          >
            {!stats.dernieresVentes || stats.dernieresVentes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#888' }}>
                <ShoppingCartOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                <p>Aucune vente enregistrée</p>
              </div>
            ) : (
              <Table dataSource={stats.dernieresVentes} columns={colonnesVentes}
                rowKey="id" pagination={false} size="small" />
            )}
          </Card>
        </Col>

        {/* Alertes stock + Résumé */}
        <Col xs={24} md={9}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <WarningOutlined style={{ color: stats.alertesStock?.length > 0 ? '#ff4d4f' : '#52c41a' }} />
                <span>Alertes Stock</span>
                {stats.alertesStock?.length > 0 && (
                  <Badge count={stats.alertesStock.length} style={{ background: '#ff4d4f' }} />
                )}
              </div>
            }
            style={{ borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 16 }}
          >
            {!stats.alertesStock || stats.alertesStock.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <CheckCircleOutlined style={{ fontSize: 40, color: '#52c41a' }} />
                <p style={{ color: '#52c41a', fontWeight: 'bold', marginTop: 8 }}>
                  Tous les stocks sont suffisants !
                </p>
              </div>
            ) : (
              <Table dataSource={stats.alertesStock} columns={colonnesStock}
                rowKey="id" pagination={{ pageSize: 4, hideOnSinglePage: true }}
                size="small" />
            )}
          </Card>

          {/* Astuce */}
          <Card style={{
            borderRadius: 16,
            background: 'linear-gradient(135deg, #fff7e6, #fffbe6)',
            border: '1px solid #ffe58f',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ fontSize: 32 }}>💡</div>
              <div>
                <Text strong style={{ color: '#d48806', display: 'block', marginBottom: 4 }}>
                  Astuce du jour
                </Text>
                <Text style={{ color: '#888', fontSize: 13, lineHeight: 1.6 }}>
                  {stats.alertesStock?.length > 0
                    ? `⚠️ ${stats.alertesStock.length} produit(s) en rupture imminente. Réapprovisionnez !`
                    : 'Utilisez Nafix AI pour prédire vos ventes du mois prochain ! 🤖'}
                </Text>
              </div>
            </div>
          </Card>

          {/* Résumé rapide */}
          <Card style={{
            borderRadius: 16,
            background: 'linear-gradient(135deg, #f0f5ff, #f9f0ff)',
            border: '1px solid #d6e4ff',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
          }}>
            <Text strong style={{ color: '#1890ff', display: 'block', marginBottom: 12 }}>
              📊 Résumé rapide
            </Text>
            {[
              {
                lbl: 'CA du jour',
                val: `${(stats.caJour || 0).toLocaleString()} FCFA`
              },
              ...(stats.caJourAvoir > 0 ? [{
                lbl: '↳ dont comptes prépayés',
                val: `${(stats.caJourAvoir || 0).toLocaleString('fr-FR')} FCFA`
              }] : []),
              {
                lbl: 'Panier moyen (global)',
                val: stats.totalVentes > 0
                  ? `${Math.round((stats.chiffreAffaire || 0) / stats.totalVentes).toLocaleString()} FCFA`
                  : '— FCFA'
              },
              { lbl: 'Produits en alerte', val: `${stats.alertesStock?.length || 0} produit(s)` },
              { lbl: 'Clients enregistrés', val: `${stats.totalClients || 0} client(s)` },
              { lbl: 'Comptes prépayés actifs', val: `${stats.avoirs?.nbActifs || 0} compte(s)` },
              { lbl: 'Soldes prépayés disponibles', val: `${(stats.avoirs?.soldesTotaux || 0).toLocaleString('fr-FR')} FCFA` },
              { lbl: 'Retours (total remboursé)', val: `${(stats.retours?.total?.montant || 0).toLocaleString('fr-FR')} FCFA` },
              { lbl: 'CA net après retours', val: `${(stats.chiffreAffaire || 0).toLocaleString('fr-FR')} FCFA` },
              ...(stats.chiffreAffaireAvoir > 0 ? [{
                lbl: '↳ dont ventes prépayées',
                val: `${(stats.chiffreAffaireAvoir || 0).toLocaleString('fr-FR')} FCFA (${pctAvoir}%)`
              }] : [])
            ].map((item, i, arr) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '6px 0',
                borderBottom: i < arr.length - 1 ? '1px solid #e6f0ff' : 'none'
              }}>
                <Text style={{ color: '#888', fontSize: 13 }}>{item.lbl}</Text>
                <Text strong style={{ color: '#1890ff', fontSize: 13 }}>{item.val}</Text>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard