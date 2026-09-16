import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Typography, Card, Row, Col, Statistic, Table, Button,
   Tag,  Divider, Empty, Alert, Tabs
} from 'antd'
import {
  Area, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  BrainOutlined, RiseOutlined, TrendingUpOutlined,
 
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const ipcRenderer = window.ipcRenderer

// ============================================
// 🧠 MOTEUR DE PRÉDICTIONS ET ANALYSES
// ============================================

class DataEngineAnalytics {
  constructor(data) {
    this.data = data
    this.stats = {}
  }

  // 📊 Analyse de tendance linéaire (Régression linéaire simple)
  regressionLineaire(donnees) {
    const n = donnees.length
    if (n < 2) return { pente: 0, intercept: 0, r2: 0 }

    const x = donnees.map((_, i) => i)
    const y = donnees.map(d => d.total)

    const moyX = x.reduce((a, b) => a + b) / n
    const moyY = y.reduce((a, b) => a + b) / n

    const numerateur = x.reduce((acc, xi, i) => acc + (xi - moyX) * (y[i] - moyY), 0)
    const denominateur = x.reduce((acc, xi) => acc + Math.pow(xi - moyX, 2), 0)

    const pente = denominateur === 0 ? 0 : numerateur / denominateur
    const intercept = moyY - pente * moyX

    // Coefficient R² (qualité du modèle)
    const ssRes = y.reduce((acc, yi, i) => acc + Math.pow(yi - (pente * x[i] + intercept), 2), 0)
    const ssTot = y.reduce((acc, yi) => acc + Math.pow(yi - moyY, 2), 0)
    const r2 = ssTot === 0 ? 0 : 1 - (ssRes / ssTot)

    return { pente, intercept, r2, moyY }
  }

  // 🔮 Prédiction des ventes futures (N jours/mois)
  predireVentes(historique, periodes = 3) {
    const { pente, intercept } = this.regressionLineaire(historique)
    const predictions = []
    const dernierIndex = historique.length - 1

    for (let i = 1; i <= periodes; i++) {
      const valeur = pente * (dernierIndex + i) + intercept
      predictions.push({
        periode: i,
        valeur: Math.max(0, Math.round(valeur)),
        confiance: this.calculerConfiance(historique)
      })
    }

    return predictions
  }

  // 🎯 Saisonnalité (détecte les patterns mensuels/trimestriels)
  detecterSaisonnalite(donnees) {
    if (donnees.length < 6) return { saisonnalite: false, pattern: [] }

    const moyennes = []
    const periodes = Math.min(3, Math.floor(donnees.length / 4))

    for (let i = 0; i < periodes; i++) {
      const slice = donnees.slice(i * Math.ceil(donnees.length / periodes), (i + 1) * Math.ceil(donnees.length / periodes))
      const moy = slice.reduce((a, b) => a + b.total, 0) / slice.length
      moyennes.push(moy)
    }

    const variance = moyennes.reduce((acc, m) => acc + Math.pow(m - (moyennes.reduce((a, b) => a + b) / moyennes.length), 2), 0) / moyennes.length
    const coeffVariation = Math.sqrt(variance) / (moyennes.reduce((a, b) => a + b) / moyennes.length)

    return {
      saisonnalite: coeffVariation > 0.15,
      pattern: moyennes,
      intensite: Math.round(coeffVariation * 100)
    }
  }

  // 📈 Analyse de croissance vs période précédente
  analyserCroissance(historique) {
    if (historique.length < 2) return { croissance: 0, tendance: 'stable' }

    const moitie = Math.ceil(historique.length / 2)
    const premierePartieMoy = historique.slice(0, moitie).reduce((a, b) => a + b.total, 0) / moitie
    const deuxiemePartieMoy = historique.slice(moitie).reduce((a, b) => a + b.total, 0) / (historique.length - moitie)

    const croissance = Math.round(((deuxiemePartieMoy - premierePartieMoy) / premierePartieMoy) * 100)
    const tendance = croissance > 10 ? 'croissance' : croissance < -10 ? 'decline' : 'stable'

    return { croissance, tendance }
  }

  // 🏆 Analyse ABC (produits/clients prioritaires)
  analyseABC(items, typeAnalyse = 'produits') {
    const sorted = items.sort((a, b) => (b.total_ca || b.total) - (a.total_ca || a.total))
    const total = sorted.reduce((acc, item) => acc + (item.total_ca || item.total), 0)

    let cumulatif = 0
    return sorted.map((item, idx) => {
      cumulatif += (item.total_ca || item.total)
      const pourcentage = (cumulatif / total) * 100

      let classe = 'C'
      if (pourcentage <= 80) classe = 'A'
      else if (pourcentage <= 95) classe = 'B'

      return {
        ...item,
        classe,
        pourcentageCumulatif: Math.round(pourcentage),
        impact: classe === 'A' ? 'Critique' : classe === 'B' ? 'Important' : 'Secondaire'
      }
    })
  }

  // ⚠️ Détection d'anomalies (écarts significatifs)
  detecterAnomalies(historique) {
    if (historique.length < 3) return []

    const moyennes = historique.map(d => d.total)
    const moy = moyennes.reduce((a, b) => a + b) / moyennes.length
    const ecartType = Math.sqrt(
      moyennes.reduce((acc, val) => acc + Math.pow(val - moy, 2), 0) / moyennes.length
    )

    return historique
      .map((item, idx) => {
        const zscore = Math.abs((item.total - moy) / (ecartType || 1))
        return {
          ...item,
          zscore,
          anomalie: zscore > 2.5,
          type: item.total > moy ? 'pic' : item.total < moy ? 'creux' : 'normal'
        }
      })
      .filter(item => item.anomalie)
  }

  // 💰 Segmentation clients (RFM - Recency, Frequency, Monetary)
  segmentationRFM(clients, dateRef = new Date()) {
    return clients.map(client => {
      const recency = Math.floor((dateRef - new Date(client.derniere_date)) / (1000 * 60 * 60 * 24))
      const frequency = client.nb_achats
      const monetary = client.total_ca

      // Score RFM (1-5 pour chaque)
      let rScore = 5
      if (recency > 90) rScore = 1
      else if (recency > 60) rScore = 2
      else if (recency > 30) rScore = 3
      else if (recency > 7) rScore = 4

      const fScore = frequency > 20 ? 5 : frequency > 10 ? 4 : frequency > 5 ? 3 : frequency > 1 ? 2 : 1
      const mScore = monetary > 100000 ? 5 : monetary > 50000 ? 4 : monetary > 10000 ? 3 : monetary > 5000 ? 2 : 1

      const rfmScore = rScore + fScore + mScore
      let segment = 'À risque'
      if (rfmScore >= 12) segment = '💰 VIP'
      else if (rfmScore >= 9) segment = '⭐ Précieux'
      else if (rfmScore >= 6) segment = '📈 Potentiel'
      else segment = '⚠️ À réactiver'

      return { ...client, rScore, fScore, mScore, rfmScore, segment }
    })
  }

  // 🎲 Prévision d'attrition client
  predireAttritionClients(clients, seuilInactivite = 60) {
    return clients
      .map(client => {
        const joursInactivite = Math.floor((new Date() - new Date(client.derniere_date)) / (1000 * 60 * 60 * 24))
        const riskScore = Math.min(100, Math.round((joursInactivite / seuilInactivite) * 100))
        const risque = riskScore > 80 ? '🔴 Critique' : riskScore > 50 ? '🟠 Élevé' : riskScore > 20 ? '🟡 Modéré' : '🟢 Faible'

        return { ...client, joursInactivite, riskScore, risque }
      })
      .filter(c => c.riskScore > 20)
      .sort((a, b) => b.riskScore - a.riskScore)
  }

  // 📊 Corrélation produit-client (association learning)
  analyserAssociations(ventes) {
    const associations = {}
    ventes.forEach(vente => {
      const cle = `${vente.client_id}_${vente.produit_id}`
      associations[cle] = (associations[cle] || 0) + 1
    })
    return Object.entries(associations)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }

  // 🎯 Recommandations intelligentes
  genererRecommandations(stats) {
    const recommandations = []

    // Recommandation 1: Produits lents
    const produitsLents = stats.topProduits
      ?.filter((_, idx) => idx > 5)
      .slice(0, 3)

    if (produitsLents?.length) {
      recommandations.push({
        id: 'produits-lents',
        titre: '⚠️ Produits à dynamiser',
        description: `${produitsLents.length} produit(s) peu vendus. Envisagez une promotion.`,
        impact: 'Moyen',
        action: 'Créer une promotion'
      })
    }

    // Recommandation 2: Clients à risque
    const clientsAuRisque = stats.topClients
      ?.filter(c => c.nb_achats === 1)
      .length

    if (clientsAuRisque > 0) {
      recommandations.push({
        id: 'clients-risque',
        titre: '👥 Clients uniques',
        description: `${clientsAuRisque} client(s) n'ont acheté qu'une seule fois. Fidélisez-les !`,
        impact: 'Élevé',
        action: 'Envoyer une offre spéciale'
      })
    }

    // Recommandation 3: Diversifier les paiements
    const paiementDominant = stats.statsParPaiement?.[0]
    if (paiementDominant && (paiementDominant.total / stats.chiffreAffaire) > 0.8) {
      recommandations.push({
        id: 'paiement-risque',
        titre: '💳 Moyens de paiement',
        description: `${paiementDominant.mode_paiement} représente >80% des ventes. Diversifiez !`,
        impact: 'Moyen',
        action: 'Promouvoir autres moyens'
      })
    }

    return recommandations
  }

  // 🔢 Confiance du modèle (0-100%)
  calculerConfiance(historique) {
    if (historique.length < 5) return 40
    if (historique.length < 12) return 60
    return 85
  }
}

// ============================================
// 🎨 COMPOSANT PRINCIPAL
// ============================================

function StatistiquesAvancees() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [engine, setEngine] = useState(null)
  const [selectedTab, setSelectedTab] = useState('predictions')

  const chargerStats = useCallback(async () => {
    if (!ipcRenderer) return
    setLoading(true)
    try {
      const data = await ipcRenderer.invoke('stats:getAll')
      setStats(data)
      setEngine(new DataEngineAnalytics(data))
    } catch (err) {
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    chargerStats()
    const interval = setInterval(chargerStats, 30000)
    return () => clearInterval(interval)
  }, [chargerStats])

  const predictions = useMemo(() => {
    if (!engine || !stats?.ventesParMois) return []
    return engine.predireVentes(stats.ventesParMois, 3)
  }, [engine, stats])

  const saisonnalite = useMemo(() => {
    if (!engine || !stats?.ventesParMois) return null
    return engine.detecterSaisonnalite(stats.ventesParMois)
  }, [engine, stats])

  const croissance = useMemo(() => {
    if (!engine || !stats?.ventesParMois) return { croissance: 0, tendance: 'stable' }
    return engine.analyserCroissance(stats.ventesParMois)
  }, [engine, stats])

  const analyseABC = useMemo(() => {
    if (!engine || !stats?.topProduits) return []
    return engine.analyseABC(stats.topProduits)
  }, [engine, stats])

  const anomalies = useMemo(() => {
    if (!engine || !stats?.ventesParMois) return []
    return engine.detecterAnomalies(stats.ventesParMois)
  }, [engine, stats])

  const segmentationClients = useMemo(() => {
    if (!engine || !stats?.topClients) return []
    return engine.segmentationRFM(stats.topClients)
  }, [engine, stats])

  const clientsAuRisque = useMemo(() => {
    if (!engine || !stats?.topClients) return []
    return engine.predireAttritionClients(stats.topClients)
  }, [engine, stats])

  const recommandations = useMemo(() => {
    if (!engine || !stats) return []
    return engine.genererRecommandations(stats)
  }, [engine, stats])

  if (loading && !stats) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <BrainOutlined spin style={{ fontSize: 48, color: '#1890ff' }} />
        <p>Intelligence des données en cours de traitement...</p>
      </div>
    )
  }

  // ============================================
  // 📊 RENDUS DES SECTIONS
  // ============================================

  const TabPredictions = () => (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} md={12}>
          <Card title="🔮 Prédictions Ventes (3 périodes)" style={{ borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart
                data={[
                  ...(stats.ventesParMois || []).map(d => ({ ...d, type: 'Historique' })),
                  ...predictions.map((p, i) => ({
                    mois: `+${p.periode}`,
                    total: p.valeur,
                    type: 'Prédiction'
                  }))
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mois" />
                <YAxis />
                <Tooltip formatter={(val) => `${val.toLocaleString()} FCFA`} />
                <Legend />
                <Area type="monotone" dataKey="total" stroke="#1890ff" fill="#1890ff40" />
              </ComposedChart>
            </ResponsiveContainer>
            <Divider />
            <Row gutter={16}>
              {predictions.map((pred, i) => (
                <Col xs={24} sm={8} key={i}>
                  <Card size="small" style={{ background: '#f0f5ff' }}>
                    <Statistic
                      title={`Période +${pred.periode}`}
                      value={pred.valeur}
                      suffix="FCFA"
                      valueStyle={{ color: '#1890ff', fontSize: 14 }}
                    />
                    <Tag color="blue" style={{ marginTop: 8 }}>
                      Confiance: {pred.confiance}%
                    </Tag>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="📈 Analyse de Croissance" style={{ borderRadius: 12 }}>
            <Row gutter={16}>
              <Col xs={12}>
                <Statistic
                  title="Tendance Générale"
                  value={croissance.croissance}
                  suffix="%"
                  prefix={croissance.croissance >= 0 ? <RiseOutlined /> : <TrendingUpOutlined />}
                  valueStyle={{
                    color: croissance.croissance >= 0 ? '#52c41a' : '#ff4d4f',
                    fontSize: 24
                  }}
                />
              </Col>
              <Col xs={12}>
                <Statistic
                  title="Classification"
                  value={croissance.tendance}
                  valueStyle={{
                    fontSize: 16,
                    color: croissance.tendance === 'croissance' ? '#52c41a' : croissance.tendance === 'decline' ? '#ff4d4f' : '#faad14'
                  }}
                />
              </Col>
            </Row>

            {saisonnalite?.saisonnalite && (
              <Alert
                message="📊 Saisonnalité détectée"
                description={`Variation saisonnière détectée (intensité: ${saisonnalite.intensite}%)`}
                type="info"
                style={{ marginTop: 16 }}
                showIcon
              />
            )}

            {anomalies.length > 0 && (
              <Card style={{ marginTop: 16, background: '#fff2f0' }}>
                <Text strong style={{ color: '#ff4d4f' }}>⚠️ {anomalies.length} Anomalie(s) détectée(s)</Text>
                {anomalies.map((anom, i) => (
                  <div key={i} style={{ marginTop: 8, fontSize: 12 }}>
                    <Text>{anom.label || `Période ${i}`}: {anom.type} ({anom.zscore.toFixed(1)} σ)</Text>
                  </div>
                ))}
              </Card>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )

  const TabABC = () => (
    <Card title="🎯 Analyse ABC (Pareto)" style={{ borderRadius: 12 }}>
      <Table
        dataSource={analyseABC}
        columns={[
          {
            title: 'Rang',
            key: 'rang',
            render: (_, __, idx) => idx + 1,
            width: 50
          },
          {
            title: 'Produit',
            dataIndex: 'nom',
            key: 'nom'
          },
          {
            title: 'Classification',
            dataIndex: 'classe',
            key: 'classe',
            render: (classe) => (
              <Tag color={classe === 'A' ? 'red' : classe === 'B' ? 'orange' : 'blue'}>
                Classe {classe}
              </Tag>
            )
          },
          {
            title: 'Impact',
            dataIndex: 'impact',
            key: 'impact'
          },
          {
            title: 'CA Cumulatif',
            dataIndex: 'pourcentageCumulatif',
            key: 'pourcentageCumulatif',
            render: (val) => `${val}%`
          },
          {
            title: 'Chiffre d\'Affaires',
            dataIndex: 'total_ca',
            key: 'total_ca',
            render: (val) => `${val.toLocaleString()} FCFA`
          }
        ]}
        rowKey="nom"
        pagination={false}
        size="small"
        scroll={{ x: 'max-content' }}
      />
    </Card>
  )

  const TabSegmentation = () => (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={12}>
        <Card title="💰 Segmentation RFM Clients" style={{ borderRadius: 12 }}>
          <Table
            dataSource={segmentationClients.slice(0, 10)}
            columns={[
              {
                title: 'Client',
                dataIndex: 'nom',
                key: 'nom',
                render: (val) => <Text strong>{val}</Text>
              },
              {
                title: 'Segment',
                dataIndex: 'segment',
                key: 'segment',
                render: (val) => <Tag>{val}</Tag>
              },
              {
                title: 'Score',
                dataIndex: 'rfmScore',
                key: 'rfmScore',
                render: (val) => (
                  <Text strong style={{ color: val >= 12 ? '#52c41a' : '#faad14' }}>
                    {val}/15
                  </Text>
                )
              }
            ]}
            rowKey="nom"
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
          />
        </Card>
      </Col>

      <Col xs={24} md={12}>
        <Card title="⚠️ Clients à Risque d'Attrition" style={{ borderRadius: 12 }}>
          {clientsAuRisque.length === 0 ? (
            <Empty description="Aucun client à risque" />
          ) : (
            <Table
              dataSource={clientsAuRisque}
              columns={[
                {
                  title: 'Client',
                  dataIndex: 'nom',
                  key: 'nom'
                },
                {
                  title: 'Risque',
                  dataIndex: 'risque',
                  key: 'risque'
                },
                {
                  title: 'Score',
                  dataIndex: 'riskScore',
                  key: 'riskScore',
                  render: (val) => (
                    <div style={{
                      width: '100%',
                      background: '#f0f0f0',
                      borderRadius: 4,
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${val}%`,
                        background: val > 80 ? '#ff4d4f' : val > 50 ? '#faad14' : '#52c41a',
                        height: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: 10,
                        fontWeight: 'bold'
                      }}>
                        {val}%
                      </div>
                    </div>
                  )
                }
              ]}
              rowKey="nom"
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          )}
        </Card>
      </Col>
    </Row>
  )

  const TabRecommandations = () => (
    <Row gutter={[16, 16]}>
      {recommandations.length === 0 ? (
        <Col span={24}>
          <Empty description="Aucune recommandation pour le moment" />
        </Col>
      ) : (
        recommandations.map((rec, i) => (
          <Col xs={24} sm={12} md={8} key={rec.id}>
            <Card
              style={{
                borderRadius: 12,
                borderLeft: `4px solid ${rec.impact === 'Élevé' ? '#ff4d4f' : '#faad14'}`
              }}
            >
              <Title level={5}>{rec.titre}</Title>
              <Text>{rec.description}</Text>
              <div style={{ marginTop: 12 }}>
                <Tag color={rec.impact === 'Élevé' ? 'red' : 'orange'}>
                  Impact: {rec.impact}
                </Tag>
              </div>
              <Button type="primary" size="small" style={{ marginTop: 12, width: '100%' }}>
                {rec.action}
              </Button>
            </Card>
          </Col>
        ))
      )}
    </Row>
  )

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* En-tête */}
      <div style={{
        background: 'linear-gradient(135deg, #722ed1 0%, #1890ff 100%)',
        borderRadius: 16, padding: '20px 28px', marginBottom: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <Title level={2} style={{ color: 'white', margin: 0 }}>
            <BrainOutlined /> Intelligence des Données
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
            Prédictions • Analyses • Recommandations
          </Text>
        </div>
        <Button onClick={chargerStats} loading={loading} style={{
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.3)',
          color: 'white'
        }}>
          Actualiser
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={selectedTab}
        onChange={setSelectedTab}
        items={[
          {
            key: 'predictions',
            label: '🔮 Prédictions',
            children: <TabPredictions />
          },
          {
            key: 'abc',
            label: '🎯 Analyse ABC',
            children: <TabABC />
          },
          {
            key: 'segmentation',
            label: '💰 Segmentation',
            children: <TabSegmentation />
          },
          {
            key: 'recommandations',
            label: '💡 Recommandations',
            children: <TabRecommandations />
          }
        ]}
      />
    </div>
  )
}

export default StatistiquesAvancees