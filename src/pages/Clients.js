import React, { useState, useEffect } from 'react'
import {
  Typography, Table, Button, Modal, Form,
  Select, Input, Space, Tag, Card,
  message, Row, Col, Popconfirm, Drawer,
  Statistic
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, ClearOutlined, UserOutlined,
  BarChartOutlined, PhoneOutlined, MailOutlined,
  EnvironmentOutlined
} from '@ant-design/icons'
import { peutAjouter, peutModifier, peutSupprimer } from '../utils/permissions'

const { Title, Text } = Typography
const { Option } = Select
const { Search } = Input
const ipcRenderer = window.ipcRenderer

function Clients({ utilisateur }) {
  const role = utilisateur?.role || 'caissier'
  const [clients, setClients] = useState([])
  const [clientsFiltres, setClientsFiltres] = useState([])
  const [modalVisible, setModalVisible] = useState(false)
  const [clientEnEdition, setClientEnEdition] = useState(null)
  const [recherche, setRecherche] = useState('')
  const [filtreType, setFiltreType] = useState(null)
  const [form] = Form.useForm()
  const [statsDrawerVisible, setStatsDrawerVisible] = useState(false)
  const [clientSelectionne, setClientSelectionne] = useState(null)
  const [factures, setFactures] = useState([])
  const [devis, setDevis] = useState([])

  // ── Chargement ──────────────────────────────────────────
  const chargerClients = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('clients:getAll')
    setClients(data)
    setClientsFiltres(data)
  }

  const chargerFactures = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('ventes:getAll')
    setFactures(data || [])
  }

  const chargerDevis = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('devis:getAll')
    setDevis(data || [])
  }

  const afficherStatsClient = (client) => {
    chargerFactures()
    chargerDevis()
    setClientSelectionne(client)
    setStatsDrawerVisible(true)
  }

  useEffect(() => { chargerClients() }, [])

  useEffect(() => {
    let resultat = [...clients]
    if (recherche) {
      const terme = recherche.toLowerCase()
      resultat = resultat.filter(c =>
        c.nom?.toLowerCase().includes(terme) ||
        c.telephone?.toLowerCase().includes(terme) ||
        c.email?.toLowerCase().includes(terme) ||
        c.adresse?.toLowerCase().includes(terme)
      )
    }
    if (filtreType) resultat = resultat.filter(c => c.type === filtreType)
    setClientsFiltres(resultat)
  }, [recherche, filtreType, clients])

  const reinitialiserFiltres = () => { setRecherche(''); setFiltreType(null) }

  // ── CRUD ────────────────────────────────────────────────
  const sauvegarder = async (values) => {
    if (!ipcRenderer) return
    if (clientEnEdition) {
      await ipcRenderer.invoke('clients:update', { ...values, id: clientEnEdition.id })
      message.success('✅ Client modifié !')
    } else {
      const result = await ipcRenderer.invoke('clients:create', values)
      if (result.erreur) { message.error(`❌ ${result.erreur}`); return }
      message.success('✅ Client ajouté !')
    }
    setModalVisible(false)
    form.resetFields()
    setClientEnEdition(null)
    chargerClients()
  }

  const editer = (client) => {
    setClientEnEdition(client)
    form.setFieldsValue(client)
    setModalVisible(true)
  }

  const supprimer = async (id) => {
    if (!ipcRenderer) return
    await ipcRenderer.invoke('clients:delete', id)
    message.success('✅ Client supprimé !')
    chargerClients()
  }

  const fermerModal = () => {
    setModalVisible(false)
    setClientEnEdition(null)
    form.resetFields()
  }

  // ── Colonnes tableau ─────────────────────────────────────
  const columns = [
    {
      title: 'Client', dataIndex: 'nom', key: 'nom',
      render: (val, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1890ff, #722ed1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 'bold', fontSize: 14, flexShrink: 0
          }}>
            {val?.[0]?.toUpperCase() || 'A'}
          </div>
          <div>
            <Text strong style={{ display: 'block' }}>{val}</Text>
            <Text style={{ color: '#888', fontSize: 12 }}>{record.email || '—'}</Text>
          </div>
        </div>
      )
    },
    {
      title: 'Type', dataIndex: 'type', key: 'type',
      render: (val) => (
        <Tag color={val === 'entreprise' ? 'blue' : 'green'} style={{ borderRadius: 12 }}>
          {val === 'entreprise' ? '🏢 Entreprise' : '👤 Particulier'}
        </Tag>
      )
    },
    {
      title: 'Contact', dataIndex: 'telephone', key: 'telephone',
      render: (val, record) => (
        <div>
          {val && (
            <div style={{ fontSize: 12, marginBottom: 4 }}>
              <PhoneOutlined /> {val}
            </div>
          )}
          {record.adresse && (
            <div style={{ fontSize: 12, color: '#888' }}>
              <EnvironmentOutlined /> {record.adresse.slice(0, 30)}
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Actions', key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<BarChartOutlined />} size="small"
            style={{ borderRadius: 6 }}
            onClick={() => afficherStatsClient(record)}>
            Stats
          </Button>
          {peutModifier(role) && (
            <Button type="primary" icon={<EditOutlined />} size="small"
              style={{ borderRadius: 6 }} onClick={() => editer(record)}>
              Modifier
            </Button>
          )}
          {peutSupprimer(role) && (
            <Popconfirm title="Supprimer ce client ?"
              onConfirm={() => supprimer(record.id)}
              okText="Oui" cancelText="Non">
              <Button danger icon={<DeleteOutlined />} size="small" style={{ borderRadius: 6 }}>
                Supprimer
              </Button>
            </Popconfirm>
          )}
          {!peutModifier(role) && !peutSupprimer(role) && (
            <Tag color="default">👁️ Lecture seule</Tag>
          )}
        </Space>
      )
    }
  ]

  // ── Stats client dans le Drawer ──────────────────────────
  const facturesClient = factures.filter(f => f.client_id === clientSelectionne?.id)
  const devisClient = devis.filter(d => d.client_id === clientSelectionne?.id)
  const caClient = facturesClient.reduce((acc, f) => acc + (f.montant_total || 0), 0)

  // ── RENDU ────────────────────────────────────────────────
  return (
    <div>
      {/* En-tête */}
      <div style={{
        background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
        borderRadius: 16, padding: '20px 28px', marginBottom: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <Title level={2} style={{ color: 'white', margin: 0 }}>
            👥 Gestion des Clients
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
            Gérez vos clients et suivez vos relations commerciales
          </Text>
        </div>
        {peutAjouter(role) && (
          <Button icon={<PlusOutlined />} size="large"
            onClick={() => { setClientEnEdition(null); form.resetFields(); setModalVisible(true) }}
            style={{
              borderRadius: 10, fontWeight: 'bold', height: 44,
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)', color: 'white'
            }}>
            Nouveau Client
          </Button>
        )}
      </div>

      {/* Stats rapides */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { titre: 'Total Clients', val: clients.length, color: '#1890ff', bg: '#e6f7ff', prefix: <UserOutlined /> },
          { titre: 'Entreprises', val: clients.filter(c => c.type === 'entreprise').length, color: '#52c41a', bg: '#f6ffed' },
          { titre: 'Particuliers', val: clients.filter(c => c.type === 'particulier').length, color: '#faad14', bg: '#fff7e6' },
          {
            titre: 'Taux couverture',
            val: (clients.filter(c => c.email && c.telephone).length / (clients.length || 1) * 100).toFixed(0),
            suffix: '%', color: '#722ed1', bg: '#f9f0ff'
          }
        ].map((s, i) => (
          <Col span={6} key={i}>
            <Card style={{ borderRadius: 12, border: 'none', background: s.bg }}
              bodyStyle={{ padding: '16px 20px' }}>
              <Statistic title={<Text style={{ color: '#888' }}>{s.titre}</Text>}
                value={s.val} suffix={s.suffix || ''}
                prefix={s.prefix}
                valueStyle={{ color: s.color, fontSize: 22 }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filtres */}
      <Card style={{ marginBottom: 16, borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Row gutter={16} align="middle">
          <Col span={10}>
            <Search placeholder="Rechercher par nom, téléphone, email..."
              allowClear prefix={<SearchOutlined style={{ color: '#1890ff' }} />}
              value={recherche} onChange={(e) => setRecherche(e.target.value)}
              size="large" />
          </Col>
          <Col span={6}>
            <Select placeholder="Filtrer par type" allowClear
              style={{ width: '100%' }} size="large"
              value={filtreType} onChange={setFiltreType}>
              <Option value="particulier">👤 Particulier</Option>
              <Option value="entreprise">🏢 Entreprise</Option>
            </Select>
          </Col>
          <Col span={8} style={{ display: 'flex', gap: 8 }}>
            <Button icon={<ClearOutlined />} size="large"
              onClick={reinitialiserFiltres} style={{ flex: 1, borderRadius: 8 }}>
              Réinitialiser
            </Button>
            <div style={{
              background: '#f0f5ff', padding: '8px 12px',
              borderRadius: 8, minWidth: 80, textAlign: 'center'
            }}>
              <Text style={{ color: '#1890ff', fontWeight: 'bold', display: 'block' }}>
                {clientsFiltres.length}
              </Text>
              <Text style={{ color: '#888', fontSize: 12 }}>/ {clients.length}</Text>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Tableau */}
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Table dataSource={clientsFiltres} columns={columns} rowKey="id"
          pagination={{ pageSize: 10, showTotal: (t) => `${t} client(s)` }} />
      </Card>

      {/* Modal Ajout / Modification */}
      <Modal
        title={
          <Space>
            <UserOutlined style={{ color: '#1890ff' }} />
            {clientEnEdition ? 'Modifier le Client' : 'Nouveau Client'}
          </Space>
        }
        open={modalVisible} onCancel={fermerModal} footer={null} width={600}
      >
        <Form form={form} layout="vertical" onFinish={sauvegarder}>
          <Form.Item name="nom" label="Nom complet"
            rules={[{ required: true, message: 'Nom obligatoire' }]}>
            <Input placeholder="Ex: Nabei Diallo" size="large" />
          </Form.Item>

          <Form.Item name="type" label="Type de client" initialValue="particulier">
            <Select size="large">
              <Option value="particulier">👤 Particulier</Option>
              <Option value="entreprise">🏢 Entreprise</Option>
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="telephone" label="Téléphone">
                <Input placeholder="Ex: +221 77 000 00 00" size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email"
                rules={[{ type: 'email', message: 'Email invalide' }]}>
                <Input placeholder="contact@email.com" size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="adresse" label="Adresse">
            <Input placeholder="Ex: Dakar, Sénégal" size="large" />
          </Form.Item>

          <Form.Item name="notes" label="Notes / Commentaires">
            <Input.TextArea placeholder="Notes personnelles..." rows={3} />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={fermerModal}>Annuler</Button>
              <Button type="primary" htmlType="submit" icon={<PlusOutlined />}
                style={{ background: 'linear-gradient(135deg, #1890ff, #722ed1)', border: 'none' }}>
                {clientEnEdition ? '✏️ Modifier' : '➕ Ajouter'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer Stats Client */}
      <Drawer
        title={clientSelectionne &&
          <Space><BarChartOutlined />Stats : {clientSelectionne.nom}</Space>}
        placement="right"
        onClose={() => setStatsDrawerVisible(false)}
        open={statsDrawerVisible} width={400}
      >
        {clientSelectionne && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Infos */}
            <Card style={{ borderRadius: 10, background: '#f0f5ff', border: '1px solid #d6e4ff' }}>
              <Tag color={clientSelectionne.type === 'entreprise' ? 'blue' : 'green'}
                style={{ marginBottom: 10 }}>
                {clientSelectionne.type === 'entreprise' ? '🏢 Entreprise' : '👤 Particulier'}
              </Tag>
              {clientSelectionne.telephone && (
                <div style={{ marginBottom: 8 }}>
                  <Text style={{ color: '#555' }}><PhoneOutlined /> {clientSelectionne.telephone}</Text>
                </div>
              )}
              {clientSelectionne.email && (
                <div style={{ marginBottom: 8 }}>
                  <Text style={{ color: '#555' }}><MailOutlined /> {clientSelectionne.email}</Text>
                </div>
              )}
              {clientSelectionne.adresse && (
                <div>
                  <Text style={{ color: '#555' }}><EnvironmentOutlined /> {clientSelectionne.adresse}</Text>
                </div>
              )}
            </Card>

            {/* Statistiques */}
            {[
              { titre: '📄 Ventes', val: facturesClient.length, color: '#1890ff', bg: '#e6f7ff', suffix: 'vente(s)' },
              { titre: '📋 Devis', val: devisClient.length, color: '#722ed1', bg: '#f9f0ff', suffix: 'devis' },
              {
                titre: '💰 CA Total', val: caClient, color: '#52c41a',
                bg: '#f6ffed', suffix: 'FCFA'
              }
            ].map((s, i) => (
              <Card key={i} style={{ borderRadius: 10, background: s.bg }}>
                <Statistic title={s.titre} value={s.val}
                  suffix={s.suffix} valueStyle={{ color: s.color }} precision={0} />
              </Card>
            ))}

            {/* Notes */}
            {clientSelectionne.notes && (
              <Card style={{ borderRadius: 10 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>📝 Notes</Text>
                <Text style={{ color: '#666' }}>{clientSelectionne.notes}</Text>
              </Card>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}

export default Clients