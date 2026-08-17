import React, { useState, useEffect, useMemo } from 'react'
import {
  Typography, Card, Row, Col, Table, Tag, Button,
  Space, Progress, Alert, Tabs, Empty
} from 'antd'
import {
  ReloadOutlined, BulbOutlined,
  RiseOutlined, WarningOutlined, TeamOutlined,
  TrophyOutlined, ThunderboltOutlined
} from '@ant-design/icons'
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
  Area, AreaChart, Cell, Legend
} from 'recharts'
import {
  predire, segmenterClientsRFM,
  predireRuptureStock, detecterAnomalies,
  scorerRentabilite
} from '../utils/mlEngine'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const ipcRenderer = window.ipcRenderer

function NafixAI() {
  const [ventes, setVentes] = useState([])
  const [produits, setProduits] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('prediction')

  const chargerDonnees = async () => {
    if (!ipcRenderer) return
    setLoading(true)
    try {
      setVentes(await ipcRenderer.invoke('ventes:getAll') || [])
      setProduits(await ipcRenderer.invoke('produits:getAll') || [])
    } catch(e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { chargerDonnees() }, [])

  // ============================================================
  // 🔮 PRÉDICTIONS CA
  // ============================================================
  const predictionCA = useMemo(() => {
    if (ventes.length === 0) return null

    // Grouper par mois
    const parMois = {}
    ventes.forEach(v => {
      const mois = dayjs(v.created_at).format('MM/YYYY')
      parMois[mois] = (parMois[mois] || 0) + (v.montant_total || 0)
    })

    const series = Object.values(parMois)
    if (series.length < 2) return null

    const { predictions, r2, tendance } = predire(series, 3)
    const moisKeys = Object.keys(parMois)

    // Données graphique historique + prédictions
    const donnees = series.map((val, i) => ({
      label: moisKeys[i], reel: val, prediction: null, type: 'historique'
    }))

    // Générer labels futurs
    const dernierMois = dayjs(moisKeys[moisKeys.length - 1], 'MM/YYYY')
    predictions.forEach((p, i) => {
      donnees.push({
        label: dernierMois.add(i + 1, 'month').format('MM/YYYY'),
        reel: null,
        prediction: p.valeur,
        type: 'prediction'
      })
    })

    const anomalies = detecterAnomalies(series)

    return { donnees, predictions, r2, tendance, anomalies, series }
  }, [ventes])

  // ============================================================
  // ⚠️ RUPTURES STOCK
  // ============================================================
  const rupturesStock = useMemo(() => {
    return predireRuptureStock(produits, ventes)
  }, [produits, ventes])

  // ============================================================
  // 👥 SEGMENTATION CLIENTS RFM
  // ============================================================
  const segmentationRFM = useMemo(() => {
    return segmenterClientsRFM(ventes)
  }, [ventes])

  const statsSegments = useMemo(() => {
    const map = {}
    segmentationRFM.forEach(c => {
      map[c.segment] = (map[c.segment] || 0) + 1
    })
    return Object.entries(map).map(([segment, count]) => ({ segment, count }))
  }, [segmentationRFM])

  // ============================================================
  // 🏆 RENTABILITÉ PRODUITS
  // ============================================================
  const rentabilite = useMemo(() => {
    return scorerRentabilite(produits, ventes)
  }, [produits, ventes])

  // ============================================================
  // 💡 RECOMMANDATIONS INTELLIGENTES
  // ============================================================
  const recommandations = useMemo(() => {
    const recs = []

    // Ruptures critiques
    const critiques = rupturesStock.filter(p => p.risque === 'critique')
    if (critiques.length > 0) {
      recs.push({
        type: 'danger',
        icone: '🚨',
        titre: 'Rupture imminente !',
        message: `${critiques.map(p => p.nom).join(', ')} seront en rupture dans moins de 3 jours.`,
        action: 'Réapprovisionner immédiatement'
      })
    }

    // Tendance ventes
    if (predictionCA?.tendance === 'hausse') {
      recs.push({
        type: 'success',
        icone: '📈',
        titre: 'Croissance détectée !',
        message: `Vos ventes sont en hausse. Prédiction CA prochain mois : ${predictionCA.predictions[0]?.valeur?.toLocaleString()} FCFA`,
        action: 'Augmenter le stock des best-sellers'
      })
    } else if (predictionCA?.tendance === 'baisse') {
      recs.push({
        type: 'warning',
        icone: '📉',
        titre: 'Baisse des ventes',
        message: 'Vos ventes montrent une tendance à la baisse.',
        action: 'Envisager des promotions pour relancer les ventes'
      })
    }

    // Clients dormants
    const dormants = segmentationRFM.filter(c => c.segment.includes('Dormant') || c.segment.includes('Perdu'))
    if (dormants.length > 0) {
      recs.push({
        type: 'warning',
        icone: '😴',
        titre: `${dormants.length} client(s) inactif(s)`,
        message: `${dormants.map(c => c.nom).slice(0, 3).join(', ')} n'ont pas acheté récemment.`,
        action: 'Lancer une campagne de réactivation'
      })
    }

    // Produits non rentables
    const nonRentables = rentabilite.filter(p => p.grade.includes('D'))
    if (nonRentables.length > 0) {
      recs.push({
        type: 'error',
        icone: '💸',
        titre: 'Produits non rentables',
        message: `${nonRentables.map(p => p.nom).slice(0, 2).join(', ')} ont un score de rentabilité très bas.`,
        action: 'Revoir la stratégie de prix ou arrêter la vente'
      })
    }

    return recs
  }, [rupturesStock, predictionCA, segmentationRFM, rentabilite])

  // ============================================================
  // 🎨 COLONNES TABLEAUX
  // ============================================================
  const colonnesRupture = [
    {
      title: 'Produit', dataIndex: 'nom', key: 'nom',
      render: (val) => <Text strong>{val}</Text>
    },
    {
      title: 'Stock actuel', dataIndex: 'stock_actuel', key: 'stock_actuel',
      render: (val, r) => <Tag color={r.couleur}>{val} unités</Tag>
    },
    {
      title: 'Conso/jour', dataIndex: 'consommationJour', key: 'consommationJour',
      render: (val) => <Text>{val} unités/jour</Text>
    },
    {
      title: 'Jours restants', dataIndex: 'joursRestants', key: 'joursRestants',
      render: (val, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ color: r.couleur }}>
            {val === Infinity ? '∞' : `${val} jours`}
          </Text>
          <Progress
            percent={Math.min(100, (val / 30) * 100)}
            showInfo={false}
            strokeColor={r.couleur}
            size="small"
            style={{ width: 80 }}
          />
        </Space>
      )
    },
    {
      title: 'Risque', dataIndex: 'risque', key: 'risque',
      render: (val, r) => (
        <Tag color={r.couleur} style={{ borderRadius: 12, fontWeight: 'bold' }}>
          {val === 'critique' ? '🚨' : val === 'élevé' ? '⚠️' : val === 'modéré' ? '🔶' : '✅'} {val}
        </Tag>
      )
    }
  ]

  const colonnesRFM = [
    {
      title: 'Client', dataIndex: 'nom', key: 'nom',
      render: (val, r) => (
        <Space>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: r.couleur,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 'bold', fontSize: 12
          }}>
            {val?.[0]?.toUpperCase()}
          </div>
          <div>
            <Text strong>{val}</Text>
            <Text style={{ display: 'block', fontSize: 11, color: '#888' }}>
              {r.description}
            </Text>
          </div>
        </Space>
      )
    },
    {
      title: 'Segment', dataIndex: 'segment', key: 'segment',
      render: (val, r) => (
        <Tag color={r.couleur} style={{ borderRadius: 12, fontWeight: 'bold' }}>{val}</Tag>
      )
    },
    {
      title: 'Score RFM', dataIndex: 'rfm', key: 'rfm',
      render: (val) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Progress type="circle" percent={Math.round((val / 15) * 100)}
            width={36} strokeColor="#1890ff"
            format={() => <span style={{ fontSize: 10 }}>{val}/15</span>} />
        </div>
      )
    },
    {
      title: 'Dernière visite', dataIndex: 'recence', key: 'recence',
      render: (val) => (
        <Tag color={val <= 7 ? 'green' : val <= 30 ? 'orange' : 'red'}>
          {val === 0 ? "Aujourd'hui" : `Il y a ${val}j`}
        </Tag>
      )
    },
    {
      title: 'Achats', dataIndex: 'nbAchats', key: 'nbAchats',
      render: (val) => <Tag color="blue">{val} achat(s)</Tag>
    },
    {
      title: 'CA Total', dataIndex: 'totalDepense', key: 'totalDepense',
      render: (val) => (
        <Text strong style={{ color: '#52c41a' }}>{val.toLocaleString()} FCFA</Text>
      )
    }
  ]

  const colonnesRentabilite = [
    {
      title: 'Grade', dataIndex: 'grade', key: 'grade',
      render: (val) => <Text strong style={{ fontSize: 16 }}>{val}</Text>,
      width: 80
    },
    {
      title: 'Produit', dataIndex: 'nom', key: 'nom',
      render: (val) => <Text strong>{val}</Text>
    },
    {
      title: 'Marge %', dataIndex: 'margePct', key: 'margePct',
      render: (val) => (
        <Tag color={val > 30 ? 'green' : val > 15 ? 'orange' : 'red'}>
          {val}%
        </Tag>
      )
    },
    {
      title: 'Score', dataIndex: 'score', key: 'score',
      render: (val) => (
        <Progress percent={Math.min(100, val)} strokeColor={
          val >= 60 ? '#52c41a' : val >= 40 ? '#faad14' : '#ff4d4f'
        } size="small" />
      )
    },
    {
      title: 'CA Généré', dataIndex: 'ca', key: 'ca',
      render: (val) => (
        <Text strong style={{ color: '#52c41a' }}>{(val || 0).toLocaleString()} FCFA</Text>
      )
    },
    {
      title: 'Vendu', dataIndex: 'quantiteVendue', key: 'quantiteVendue',
      render: (val) => <Tag color="blue">{val || 0} unités</Tag>
    }
  ]

  const tabs = [
    {
      key: 'prediction',
      label: <Space><RiseOutlined />Prédictions CA</Space>,
      children: (
        <div>
          {!predictionCA ? (
            <Alert message="Pas assez de données" description="Enregistrez au moins 2 mois de ventes pour activer les prédictions." type="info" showIcon />
          ) : (
            <>
              {/* Métriques prédiction */}
              <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                {predictionCA.predictions.map((p, i) => (
                  <Col span={8} key={i}>
                    <Card style={{
                      borderRadius: 12,
                      background: i === 0
                        ? 'linear-gradient(135deg, #1890ff, #722ed1)'
                        : i === 1
                          ? 'linear-gradient(135deg, #52c41a, #389e0d)'
                          : 'linear-gradient(135deg, #faad14, #d48806)',
                      border: 'none'
                    }}>
                      <div style={{ color: 'white' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
                          🔮 Prédiction Mois +{i + 1}
                        </Text>
                        <div style={{ fontSize: 26, fontWeight: 'bold', marginTop: 4 }}>
                          {p.valeur.toLocaleString()} FCFA
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                            Confiance: {p.confiance}%
                          </Text>
                          <Progress
                            percent={p.confiance}
                            showInfo={false}
                            strokeColor="rgba(255,255,255,0.9)"
                            trailColor="rgba(255,255,255,0.3)"
                            size="small"
                            style={{ marginTop: 4 }}
                          />
                        </div>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>

              {/* Graphique */}
              <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Space>
                    <Text strong style={{ fontSize: 15 }}>📈 Historique + Prédictions</Text>
                    <Tag color={predictionCA.tendance === 'hausse' ? 'green' : predictionCA.tendance === 'baisse' ? 'red' : 'blue'}>
                      {predictionCA.tendance === 'hausse' ? '↑' : predictionCA.tendance === 'baisse' ? '↓' : '→'} {predictionCA.tendance}
                    </Tag>
                  </Space>
                  <Tag color="purple">
                    R² = {(predictionCA.r2 * 100).toFixed(0)}% de précision
                  </Tag>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={predictionCA.donnees}>
                    <defs>
                      <linearGradient id="colorReel" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1890ff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorPred" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#722ed1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#722ed1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <RTooltip formatter={(val) => val ? `${val.toLocaleString()} FCFA` : '-'} />
                    <Legend />
                    <Area type="monotone" dataKey="reel" name="Réel" stroke="#1890ff" fill="url(#colorReel)" strokeWidth={2} connectNulls={false} />
                    <Area type="monotone" dataKey="prediction" name="Prédiction IA" stroke="#722ed1" fill="url(#colorPred)" strokeWidth={2} strokeDasharray="6 3" connectNulls={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              {/* Anomalies */}
              {predictionCA.anomalies.filter(a => a.anomalie).length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  icon={<ThunderboltOutlined />}
                  message={`${predictionCA.anomalies.filter(a => a.anomalie).length} anomalie(s) détectée(s) dans l'historique`}
                  description={predictionCA.anomalies
                    .filter(a => a.anomalie)
                    .map((a, i) => `Mois ${a.index + 1}: ${a.type === 'pic' ? 'Pic' : 'Creux'} inhabituel (${a.valeur.toLocaleString()} FCFA)`)
                    .join(' | ')}
                  style={{ borderRadius: 8 }}
                />
              )}
            </>
          )}
        </div>
      )
    },
    {
      key: 'stock',
      label: <Space><WarningOutlined />Alertes Stock IA</Space>,
      children: (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {['critique', 'élevé', 'modéré', 'faible'].map((risque, i) => {
              const count = rupturesStock.filter(p => p.risque === risque).length
              const couleurs = ['#ff4d4f', '#ff7a45', '#faad14', '#52c41a']
              const icones = ['🚨', '⚠️', '🔶', '✅']
              return (
                <Col span={6} key={risque}>
                  <Card style={{ borderRadius: 12, border: `2px solid ${couleurs[i]}`, textAlign: 'center' }}>
                    <div style={{ fontSize: 28 }}>{icones[i]}</div>
                    <Title level={2} style={{ color: couleurs[i], margin: '4px 0' }}>{count}</Title>
                    <Text style={{ color: couleurs[i], fontWeight: 'bold', textTransform: 'capitalize' }}>
                      Risque {risque}
                    </Text>
                  </Card>
                </Col>
              )
            })}
          </Row>

          {rupturesStock.length === 0 ? (
            <Empty description="Pas assez de données de ventes pour prédire les ruptures" />
          ) : (
            <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <Table
                dataSource={rupturesStock}
                columns={colonnesRupture}
                rowKey="id"
                pagination={{ pageSize: 8 }}
                size="small"
                rowClassName={(r) => r.risque === 'critique' ? 'row-critique' : ''}
              />
            </Card>
          )}
        </div>
      )
    },
    {
      key: 'clients',
      label: <Space><TeamOutlined />Segmentation RFM</Space>,
      children: (
        <div>
          {/* Stats segments */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {statsSegments.map((s, i) => (
              <Col span={Math.floor(24 / Math.max(statsSegments.length, 1))} key={i}>
                <Card style={{ borderRadius: 12, border: 'none', background: '#fafbfc', textAlign: 'center' }}>
                  <div style={{ fontSize: 24 }}>{s.segment.split(' ')[0]}</div>
                  <Title level={3} style={{ margin: '4px 0' }}>{s.count}</Title>
                  <Text style={{ color: '#888', fontSize: 12 }}>{s.segment}</Text>
                </Card>
              </Col>
            ))}
          </Row>

          {segmentationRFM.length === 0 ? (
            <Alert message="Pas de clients avec achats enregistrés" type="info" showIcon />
          ) : (
            <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <Table
                dataSource={segmentationRFM}
                columns={colonnesRFM}
                rowKey="id"
                pagination={{ pageSize: 8 }}
                size="small"
              />
            </Card>
          )}
        </div>
      )
    },
    {
      key: 'rentabilite',
      label: <Space><TrophyOutlined />Score Rentabilité</Space>,
      children: (
        <div>
          {/* Graphique barres rentabilité */}
          {rentabilite.length > 0 && (
            <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 16 }}>
              <Text strong style={{ fontSize: 15 }}>🏆 Score Rentabilité par Produit</Text>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={rentabilite.slice(0, 10)} margin={{ top: 20, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="nom" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={80} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RTooltip formatter={(val) => `Score: ${val}`} />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                    {rentabilite.slice(0, 10).map((r, i) => (
                      <Cell key={i} fill={
                        r.score >= 60 ? '#52c41a' : r.score >= 40 ? '#faad14' : '#ff4d4f'
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Table
              dataSource={rentabilite}
              columns={colonnesRentabilite}
              rowKey="id"
              pagination={{ pageSize: 8 }}
              size="small"
            />
          </Card>
        </div>
      )
    },
    {
      key: 'recommandations',
      label: <Space><BulbOutlined />Recommandations</Space>,
      children: (
        <div>
          {recommandations.length === 0 ? (
            <Alert
              message="✅ Tout va bien !"
              description="Aucune recommandation urgente. Votre business est en bonne santé !"
              type="success"
              showIcon
              style={{ borderRadius: 12 }}
            />
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              {recommandations.map((rec, i) => (
                <Alert
                  key={i}
                  type={rec.type}
                  showIcon
                  message={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space>
                        <span style={{ fontSize: 18 }}>{rec.icone}</span>
                        <Text strong>{rec.titre}</Text>
                      </Space>
                      <Tag color="blue" style={{ borderRadius: 12 }}>
                        💡 {rec.action}
                      </Tag>
                    </div>
                  }
                  description={rec.message}
                  style={{ borderRadius: 12 }}
                />
              ))}
            </Space>
          )}
        </div>
      )
    }
  ]

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* En-tête */}
      <div style={{
        background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
        borderRadius: 16, padding: '24px 32px', marginBottom: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <Space align="center" style={{ marginBottom: 8 }}>
            <div style={{
              background: 'linear-gradient(135deg, #1890ff, #722ed1)',
              borderRadius: 12, padding: '8px 12px', fontSize: 24
            }}>
              🤖
            </div>
            <Title level={2} style={{ color: 'white', margin: 0 }}>
              Nafix AI
            </Title>
            <Tag color="purple" style={{ borderRadius: 12, fontSize: 11 }}>
              ✨ Intelligence Artificielle
            </Tag>
          </Space>
          <Text style={{ color: 'rgba(255,255,255,0.7)' }}>
            Prédictions ML • Segmentation RFM • Score Rentabilité • Recommandations
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={chargerDonnees} loading={loading}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white', borderRadius: 8
          }}>
          Recalculer
        </Button>
      </div>

      {/* Résumé rapide */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { label: 'Prédiction mois +1', value: predictionCA?.predictions[0]?.valeur ? `${predictionCA.predictions[0].valeur.toLocaleString()} FCFA` : 'N/A', icone: '🔮', couleur: '#722ed1', bg: '#f9f0ff' },
          { label: 'Risques rupture', value: rupturesStock.filter(p => p.risque !== 'faible').length, icone: '⚠️', couleur: '#ff4d4f', bg: '#fff2f0' },
          { label: 'Clients Champions', value: segmentationRFM.filter(c => c.segment.includes('Champion')).length, icone: '⭐', couleur: '#faad14', bg: '#fffbe6' },
          { label: 'Recommandations', value: recommandations.length, icone: '💡', couleur: '#1890ff', bg: '#e6f7ff' }
        ].map((item, i) => (
          <Col span={6} key={i}>
            <Card style={{ borderRadius: 12, border: 'none', background: item.bg }}
              bodyStyle={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text style={{ color: '#888', fontSize: 12, display: 'block' }}>{item.label}</Text>
                  <Text strong style={{ fontSize: 20, color: item.couleur }}>{item.value}</Text>
                </div>
                <span style={{ fontSize: 28 }}>{item.icone}</span>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Tabs ML */}
      <Card style={{ borderRadius: 16, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabs}
          size="large"
          type="card"
        />
      </Card>
    </div>
  )
}

export default NafixAI