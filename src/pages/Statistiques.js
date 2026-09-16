import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Typography, Card, Row, Col, Statistic, Table, Button,
  Space, Tag, Badge, Divider, Empty, Alert
} from 'antd'
import {
  Area, Bar, Pie, Cell, PieChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ComposedChart
} from 'recharts'
import {
  ShoppingCartOutlined, TeamOutlined, RiseOutlined,
  ShoppingOutlined, ReloadOutlined, FireOutlined,
  ArrowUpOutlined, ArrowDownOutlined, DollarOutlined,
  WarningOutlined, CreditCardOutlined, CheckCircleOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const ipcRenderer = window.ipcRenderer

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2']

function Statistiques() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [periode, setPeriode] = useState('mois') // jour, semaine, mois

  const chargerStats = useCallback(async () => {
    if (!ipcRenderer) return
    setLoading(true)
    try {
      const data = await ipcRenderer.invoke('stats:getAll')
      setStats(data)
    } catch (err) {
      console.error('Erreur stats:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    chargerStats()
    
    // Auto-refresh toutes les 30 secondes
    const interval = setInterval(chargerStats, 30000)
    
    // Écouter les événements de nouvelle vente
    if (ipcRenderer && ipcRenderer.on) {
      ipcRenderer.on('vente:created', () => {
        console.log('Nouvelle vente détectée, rafraîchissement...')
        chargerStats()
      })
      
      ipcRenderer.on('vente:updated', () => {
        console.log('Vente mise à jour, rafraîchissement...')
        chargerStats()
      })
      
      ipcRenderer.on('vente:deleted', () => {
        console.log('Vente supprimée, rafraîchissement...')
        chargerStats()
      })
    }
    
    return () => {
      clearInterval(interval)
      if (ipcRenderer && ipcRenderer.removeAllListeners) {
        ipcRenderer.removeAllListeners('vente:created')
        ipcRenderer.removeAllListeners('vente:updated')
        ipcRenderer.removeAllListeners('vente:deleted')
      }
    }
  }, [chargerStats])

  // ✅ Données selon la période sélectionnée
  const donneesGraphique = useMemo(() => {
    if (!stats) return []
    if (periode === 'jour') {
      return (stats.ventesParJour || []).map(d => ({
        label: dayjs(d.jour).format('DD/MM'),
        total: d.total || 0,
        nb: d.nb_ventes || 0
      }))
    }
    if (periode === 'semaine') {
      return (stats.ventesParSemaine || []).map((d, i) => ({
        label: `S${d.semaine}`,
        total: d.total || 0,
        nb: d.nb_ventes || 0
      }))
    }
    return (stats.ventesParMois || []).map(d => ({
      label: d.mois,
      total: d.total || 0,
      nb: d.nb_ventes || 0
    }))
  }, [stats, periode])

  // ✅ Données paiement pour le pie chart
  const donneesPaiement = useMemo(() => {
    if (!stats?.statsParPaiement) return []
    return stats.statsParPaiement.map(p => ({
      name: p.mode_paiement === 'especes' ? '💵 Espèces'
        : p.mode_paiement === 'wave' ? '🌊 Wave'
        : p.mode_paiement === 'orange_money' ? '🟠 Orange Money'
        : p.mode_paiement === 'cheque' ? '📝 Chèque'
        : p.mode_paiement === 'pret' ? '📋 Crédit'
        : p.mode_paiement,
      value: p.total || 0,
      nb: p.nb || 0
    }))
  }, [stats])

  // ✅ Calcul croissance
  const croissance = useMemo(() => {
    if (!stats?.ventesParMois || stats.ventesParMois.length < 2) return 0
    const mois = stats.ventesParMois
    const actuel = mois[mois.length - 1]?.total || 0
    const precedent = mois[mois.length - 2]?.total || 1
    return Math.round(((actuel - precedent) / precedent) * 100)
  }, [stats])

  if (loading && !stats) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <ReloadOutlined spin style={{ fontSize: 48, color: '#1890ff' }} />
        <p style={{ marginTop: 16, color: '#888' }}>Chargement des statistiques...</p>
      </div>
    )
  }

  if (!stats) return null

  const colonnesTop = [
    {
      title: 'Rang',
      key: 'rang',
      render: (_, __, index) => (
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: index === 0 ? '#faad14' : index === 1 ? '#888' : index === 2 ? '#cd7f32' : '#f0f0f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: index < 3 ? 'white' : '#666', fontWeight: 'bold', fontSize: 12
        }}>
          {index + 1}
        </div>
      ),
      width: 60
    },
    {
      title: 'Produit',
      dataIndex: 'nom',
      key: 'nom',
      render: (val, _, index) => (
        <Space>
          {index === 0 && <FireOutlined style={{ color: '#ff4d4f' }} />}
          <Text strong>{val}</Text>
        </Space>
      )
    },
    {
      title: 'Quantité',
      dataIndex: 'total_quantite',
      key: 'total_quantite',
      render: (val) => <Tag color="blue">{val} unités</Tag>,
      sorter: (a, b) => a.total_quantite - b.total_quantite
    },
    {
      title: 'Chiffre d\'Affaires',
      dataIndex: 'total_ca',
      key: 'total_ca',
      render: (val) => (
        <Text strong style={{ color: '#52c41a' }}>
          {(val || 0).toLocaleString()} FCFA
        </Text>
      ),
      sorter: (a, b) => a.total_ca - b.total_ca
    }
  ]

  const colonnesClients = [
    {
      title: 'Client',
      dataIndex: 'nom',
      key: 'nom',
      render: (val) => (
        <Space>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1890ff, #722ed1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 'bold', fontSize: 12
          }}>
            {val?.[0]?.toUpperCase()}
          </div>
          <Text strong>{val}</Text>
        </Space>
      )
    },
    {
      title: 'Achats',
      dataIndex: 'nb_achats',
      key: 'nb_achats',
      render: (val) => <Tag color="purple">{val} achat(s)</Tag>
    },
    {
      title: 'CA Total',
      dataIndex: 'total_ca',
      key: 'total_ca',
      render: (val) => (
        <Text strong style={{ color: '#52c41a' }}>
          {(val || 0).toLocaleString()} FCFA
        </Text>
      )
    }
  ]

  return (
    <div style={{ paddingBottom: 24 }}>

      {/* ✅ En-tête */}
      <div style={{
        background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
        borderRadius: 16, padding: '20px 28px', marginBottom: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <Title level={2} style={{ color: 'white', margin: 0 }}>
            📊 Statistiques & Analyses
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
            Données en temps réel — Mis à jour automatiquement
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={chargerStats} loading={loading}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: 'white', borderRadius: 8
          }}>
          Actualiser
        </Button>
      </div>

      {/* ✅ KPI Période rapide */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={8}>
          <Card style={{
            borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #1890ff, #096dd9)',
            boxShadow: '0 4px 20px rgba(24,144,255,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
                  📅 Aujourd'hui
                </Text>
                <div style={{ color: 'white', fontSize: 22, fontWeight: 'bold', marginTop: 4 }}>
                  {(stats.ventesAujourdhui?.total || 0).toLocaleString()} FCFA
                </div>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                  {stats.ventesAujourdhui?.nb || 0} vente(s)
                </Text>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.2)',
                borderRadius: 12, padding: 12, fontSize: 24
              }}>
                📅
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card style={{
            borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #52c41a, #389e0d)',
            boxShadow: '0 4px 20px rgba(82,196,26,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
                  📆 Cette semaine
                </Text>
                <div style={{ color: 'white', fontSize: 22, fontWeight: 'bold', marginTop: 4 }}>
                  {(stats.ventesSemaine?.total || 0).toLocaleString()} FCFA
                </div>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                  {stats.ventesSemaine?.nb || 0} vente(s)
                </Text>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.2)',
                borderRadius: 12, padding: 12, fontSize: 24
              }}>
                📆
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card style={{
            borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, #faad14, #d48806)',
            boxShadow: '0 4px 20px rgba(250,173,20,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
                  🗓️ Ce mois
                </Text>
                <div style={{ color: 'white', fontSize: 22, fontWeight: 'bold', marginTop: 4 }}>
                  {(stats.ventesMois?.total || 0).toLocaleString()} FCFA
                </div>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                  {stats.ventesMois?.nb || 0} vente(s)
                </Text>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.2)',
                borderRadius: 12, padding: 12, fontSize: 24
              }}>
                🗓️
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ✅ KPI Globaux */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          {
            titre: 'Total Ventes',
            valeur: stats.totalVentes,
            suffix: '',
            icone: <ShoppingCartOutlined />,
            couleur: '#1890ff',
            bg: '#e6f7ff'
          },
          {
            titre: "Chiffre d'Affaires",
            valeur: stats.chiffreAffaire,
            suffix: 'FCFA',
            icone: <RiseOutlined />,
            couleur: '#52c41a',
            bg: '#f6ffed'
          },
          {
            titre: 'Panier Moyen',
            valeur: stats.panierMoyen,
            suffix: 'FCFA',
            icone: <DollarOutlined />,
            couleur: '#722ed1',
            bg: '#f9f0ff'
          },
          {
            titre: 'Total Clients',
            valeur: stats.totalClients,
            suffix: '',
            icone: <TeamOutlined />,
            couleur: '#faad14',
            bg: '#fffbe6'
          },
          {
            titre: 'Total Produits',
            valeur: stats.totalProduits,
            suffix: '',
            icone: <ShoppingOutlined />,
            couleur: '#ff4d4f',
            bg: '#fff2f0'
          },
          {
            titre: 'Croissance',
            valeur: Math.abs(croissance),
            suffix: '%',
            icone: croissance >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />,
            couleur: croissance >= 0 ? '#52c41a' : '#ff4d4f',
            bg: croissance >= 0 ? '#f6ffed' : '#fff2f0'
          }
        ].map((kpi, i) => (
          <Col xs={12} sm={8} md={4} key={i}>
            <Card style={{ borderRadius: 12, border: 'none', background: kpi.bg }}
              bodyStyle={{ padding: '16px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, color: kpi.couleur, marginBottom: 4 }}>
                  {kpi.icone}
                </div>
                <Text style={{ color: '#888', fontSize: 11, display: 'block' }}>
                  {kpi.titre}
                </Text>
                <div style={{ fontSize: 18, fontWeight: 'bold', color: kpi.couleur, marginTop: 4 }}>
                  {(kpi.valeur || 0).toLocaleString()}
                  {kpi.suffix && <span style={{ fontSize: 11 }}> {kpi.suffix}</span>}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ✅ Stats Crédits */}
      {stats.statsCredits && (
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24}>
            <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <Row gutter={16} align="middle">
                <Col xs={0} sm={1}>
                  <CreditCardOutlined style={{ fontSize: 24, color: '#faad14' }} />
                </Col>
                <Col xs={12} sm={5}>
                  <Statistic title="📋 Ventes à Crédit"
                    value={stats.statsCredits.total_prets || 0}
                    suffix="vente(s)"
                    valueStyle={{ color: '#faad14', fontSize: 18 }} />
                </Col>
                <Col xs={12} sm={5}>
                  <Statistic title="⚠️ Paiements Partiels"
                    value={stats.statsCredits.total_partiels || 0}
                    suffix="vente(s)"
                    valueStyle={{ color: '#ff4d4f', fontSize: 18 }} />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic title="💰 Montant Crédits"
                    value={stats.statsCredits.montant_prets || 0}
                    suffix="FCFA"
                    valueStyle={{ color: '#faad14', fontSize: 18 }} />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic title="❌ Total Montant Dû"
                    value={stats.statsCredits.total_du || 0}
                    suffix="FCFA"
                    valueStyle={{ color: '#ff4d4f', fontSize: 18 }} />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      )}

      {/* ✅ Graphique principal avec filtres période */}
      <Card
        style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 20 }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RiseOutlined style={{ color: '#1890ff' }} />
            <span>Évolution du Chiffre d'Affaires</span>
          </div>
        }
        extra={
          <Space>
            {[
              { key: 'jour', label: '📅 Par Jour' },
              { key: 'semaine', label: '📆 Par Semaine' },
              { key: 'mois', label: '🗓️ Par Mois' }
            ].map(p => (
              <Button key={p.key} size="small"
                type={periode === p.key ? 'primary' : 'default'}
                onClick={() => setPeriode(p.key)}
                style={{ borderRadius: 16 }}>
                {p.label}
              </Button>
            ))}
          </Space>
        }
      >
        {donneesGraphique.length === 0 ? (
          <Empty description="Aucune vente enregistrée" style={{ padding: 40 }} />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={donneesGraphique} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                <defs>
                  <linearGradient id="colorCA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1890ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }}
                  angle={donneesGraphique.length > 15 ? -45 : 0}
                  textAnchor={donneesGraphique.length > 15 ? 'end' : 'middle'}
                  height={donneesGraphique.length > 15 ? 60 : 30} />
                <YAxis tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(val, name) => [
                    name === 'total' ? `${val.toLocaleString()} FCFA` : `${val} vente(s)`,
                    name === 'total' ? 'Chiffre d\'Affaires' : 'Nb Ventes'
                  ]}
                  contentStyle={{ borderRadius: 8, border: '1px solid #f0f0f0' }} />
                <Legend />
                <Area type="monotone" dataKey="total" name="CA"
                  stroke="#1890ff" fill="url(#colorCA)" strokeWidth={2} />
                <Bar dataKey="nb" name="Ventes" fill="#722ed1" opacity={0.6}
                  radius={[4, 4, 0, 0]} yAxisId={0} />
              </ComposedChart>
            </ResponsiveContainer>

            <Divider />
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8}>
                <Card size="small" style={{ background: '#f0f5ff', border: '1px solid #1890ff', borderRadius: 8 }}>
                  <Statistic
                    title={`Total (${periode === 'jour' ? '30J' : periode === 'semaine' ? '52S' : '12M'})`}
                    value={donneesGraphique.reduce((acc, d) => acc + d.total, 0)}
                    suffix="FCFA"
                    valueStyle={{ color: '#1890ff', fontSize: 16 }} />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card size="small" style={{ background: '#f6ffed', border: '1px solid #52c41a', borderRadius: 8 }}>
                  <Statistic
                    title="Moyenne par période"
                    value={Math.round(donneesGraphique.reduce((acc, d) => acc + d.total, 0) / (donneesGraphique.length || 1))}
                    suffix="FCFA"
                    valueStyle={{ color: '#52c41a', fontSize: 16 }} />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card size="small" style={{
                  background: croissance >= 0 ? '#f6ffed' : '#fff2f0',
                  border: `1px solid ${croissance >= 0 ? '#52c41a' : '#ff4d4f'}`,
                  borderRadius: 8
                }}>
                  <Statistic
                    title="Croissance (vs mois précédent)"
                    value={Math.abs(croissance)}
                    suffix="%"
                    prefix={croissance >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                    valueStyle={{ color: croissance >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 16 }} />
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {/* ✅ Pie Chart Modes de Paiement */}
        <Col xs={24} md={10}>
          <Card title="💳 Répartition par Mode de Paiement"
            style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%' }}>
            {donneesPaiement.length === 0 ? (
              <Empty description="Aucune donnée" style={{ padding: 40 }} />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={donneesPaiement} innerRadius={60} outerRadius={100}
                      paddingAngle={5} dataKey="value"
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                      {donneesPaiement.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val) => `${val.toLocaleString()} FCFA`} />
                  </PieChart>
                </ResponsiveContainer>
                <Divider />
                {donneesPaiement.map((p, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between',
                    marginBottom: 8, alignItems: 'center'
                  }}>
                    <Space>
                      <div style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: COLORS[i % COLORS.length]
                      }} />
                      <Text>{p.name}</Text>
                    </Space>
                    <Space>
                      <Tag color="blue">{p.nb} vente(s)</Tag>
                      <Text strong style={{ color: '#52c41a' }}>
                        {p.value.toLocaleString()} FCFA
                      </Text>
                    </Space>
                  </div>
                ))}
              </>
            )}
          </Card>
        </Col>

        {/* ✅ Top Clients */}
        <Col xs={24} md={14}>
          <Card title="👑 Top 5 Clients"
            style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%' }}>
            {!stats.topClients || stats.topClients.length === 0 ? (
              <Empty description="Aucun client avec ventes" style={{ padding: 40 }} />
            ) : (
              <Table
                dataSource={stats.topClients}
                columns={colonnesClients}
                rowKey="nom"
                pagination={false}
                size="small"
                scroll={{ x: 'max-content' }} />
            )}
          </Card>
        </Col>
      </Row>

      {/* ✅ Top Sous-Catégories */}
      {stats.topSousCategories && stats.topSousCategories.length > 0 && (
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🔖</span>
              <span>Top Sous-Catégories</span>
              <Badge count={stats.topSousCategories.length} style={{ background: '#722ed1' }} />
            </div>
          }
          style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 20 }}
        >
          <Row gutter={[12, 12]}>
            {stats.topSousCategories.map((sc, i) => {
              const maxCA = stats.topSousCategories[0]?.ca || 1
              const pct = Math.round((sc.ca / maxCA) * 100)
              const couleurs = ['#1890ff','#722ed1','#52c41a','#faad14','#ff4d4f','#13c2c2','#fa8c16','#eb2f96','#2f54eb','#08979c']
              return (
                <Col xs={24} sm={12} key={sc.nom}>
                  <div style={{
                    background: '#fafafa', borderRadius: 10,
                    padding: '12px 16px', border: '1px solid #f0f0f0'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Space>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: couleurs[i % couleurs.length],
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontWeight: 'bold', fontSize: 12
                        }}>{i + 1}</div>
                        <Text strong style={{ fontSize: 13 }}>🔖 {sc.nom}</Text>
                      </Space>
                      <Space size={4}>
                        <Tag color="purple" style={{ borderRadius: 10 }}>{sc.total_vendu} vendus</Tag>
                        <Text strong style={{ color: couleurs[i % couleurs.length] }}>
                          {(sc.ca || 0).toLocaleString('fr-FR')} FCFA
                        </Text>
                      </Space>
                    </div>
                    <div style={{
                      height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: `linear-gradient(90deg, ${couleurs[i % couleurs.length]}, ${couleurs[(i+1) % couleurs.length]})`,
                        borderRadius: 3, transition: 'width 0.5s'
                      }} />
                    </div>
                  </div>
                </Col>
              )
            })}
          </Row>
        </Card>
      )}

      {/* ✅ Top Produits */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FireOutlined style={{ color: '#ff4d4f' }} />
            <span>Top 10 Produits Vendus</span>
            <Badge count={stats.topProduits?.length || 0} style={{ background: '#1890ff' }} />
          </div>
        }
        style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 20 }}
      >
        {!stats.topProduits || stats.topProduits.length === 0 ? (
          <Empty description="Aucune vente enregistrée" style={{ padding: 40 }} />
        ) : (
          <Table
            dataSource={stats.topProduits}
            columns={colonnesTop}
            rowKey="nom"
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            size="small" />
        )}
      </Card>

      {/* ✅ Alertes Stock */}
      {stats.alertesStock && stats.alertesStock.length > 0 && (
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <WarningOutlined style={{ color: '#ff4d4f' }} />
              <span>⚠️ Alertes Stock Faible</span>
              <Badge count={stats.alertesStock.length} style={{ background: '#ff4d4f' }} />
            </div>
          }
          style={{ borderRadius: 12, border: '2px solid #ff4d4f', marginBottom: 20 }}
        >
          <Row gutter={[16, 16]}>
            {stats.alertesStock.map(p => (
              <Col xs={24} sm={12} md={6} key={p.id}>
                <Alert
                  message={<Text strong>{p.nom}</Text>}
                  description={
                    <div>
                      <div>Stock: <Tag color="red">{p.stock_actuel} unités</Tag></div>
                      <div>Minimum: <Tag color="orange">{p.stock_minimum} unités</Tag></div>
                    </div>
                  }
                  type="error"
                  showIcon
                  icon={<WarningOutlined />}
                  style={{ borderRadius: 8 }}
                />
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* ✅ Message si pas de ventes */}
      {stats.totalVentes === 0 && (
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: 40 }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
          <Title level={4} style={{ color: '#888', marginTop: 16 }}>
            Aucune vente enregistrée
          </Title>
          <Text style={{ color: '#aaa' }}>
            Commencez par enregistrer des ventes pour voir les statistiques !
          </Text>
        </Card>
      )}
    </div>
  )
}

export default Statistiques