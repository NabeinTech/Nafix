import React, { useState, useEffect, useCallback } from 'react'
import {
  Table, Button, Modal, Form, Input, InputNumber, Select, Tag, Drawer,
  Space, Typography, Card, Statistic, Row, Col, Tabs, Badge, Tooltip,
  message, Popconfirm, Divider, Alert, Empty
} from 'antd'
import {
  WalletOutlined, PlusOutlined, HistoryOutlined, FilePdfOutlined,
  ReloadOutlined, UserOutlined, BankOutlined, WarningOutlined,
  DollarOutlined, ShoppingCartOutlined, PauseCircleOutlined, DeleteOutlined,
  UserAddOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import FactureAvoir from '../components/FactureAvoir'
import NouveauClientModal from '../components/NouveauClientModal'

const { Title, Text } = Typography
const { TabPane } = Tabs

const fmt = (n) =>
  Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 }) + ' FCFA'

const fmtDate = (d) =>
  d ? dayjs(d).format('DD/MM/YYYY HH:mm') : '—'

// ────────────────────────────────────────────────────────────────────
export default function ComptesPrepayes({ utilisateur }) {
  const [avoirs, setAvoirs]           = useState([])
  const [clients, setClients]         = useState([])
  const [parametres, setParametres]   = useState({})
  const [loading, setLoading]         = useState(false)

  // Modals
  const [clientModalVisible, setClientModalVisible] = useState(false)
  const [modalCreer, setModalCreer]             = useState(false)
  const [loadingCreer, setLoadingCreer]         = useState(false)
  const [loadingRecharge, setLoadingRecharge]   = useState(false)
  const [loadingAchat, setLoadingAchat]         = useState(false)
  const [modalRecharger, setModalRecharger]     = useState(false)
  const [modalAchat, setModalAchat]             = useState(false)
  const [avoirSelectionne, setAvoirSelectionne] = useState(null)

  // Drawer transactions
  const [drawerVisible, setDrawerVisible]   = useState(false)
  const [drawerAvoir, setDrawerAvoir]       = useState(null)
  const [transactions, setTransactions]     = useState([])
  const [loadingTx, setLoadingTx]           = useState(false)

  // PDF preview
  const [pdfTx, setPdfTx]         = useState(null)
  const [pdfAvoir, setPdfAvoir]   = useState(null)
  const [pdfClient, setPdfClient] = useState(null)
  const [modalPdf, setModalPdf]   = useState(false)

  // Panier achat
  const [panier, setPanier]     = useState([])
  const [produits, setProduits] = useState([])

  const [formCreer]    = Form.useForm()
  const [formRecharge] = Form.useForm()
  const [formAchat]    = Form.useForm()

  // ── Chargement ──────────────────────────────────────────────────
  const charger = useCallback(async () => {
    setLoading(true)
    try {
      const [a, c, p, pr] = await Promise.all([
        window.ipcRenderer.invoke('avoirs:getAll'),
        window.ipcRenderer.invoke('clients:getAll'),
        window.ipcRenderer.invoke('parametres:get'),
        window.ipcRenderer.invoke('produits:getAll'),
      ])
      setAvoirs(a || [])
      setClients(c || [])
      setParametres(p || {})
      setProduits(pr || [])
    } catch (e) {
      message.error('Erreur de chargement : ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { charger() }, [charger])

  // ── Ouvrir le drawer d'un compte ───────────────────────────────
  const ouvrirDrawer = async (avoir) => {
    setDrawerAvoir(avoir)
    setDrawerVisible(true)
    setLoadingTx(true)
    try {
      const tx = await window.ipcRenderer.invoke('avoirs:getTransactions', avoir.id)
      setTransactions(tx || [])
    } catch (e) {
      message.error('Erreur : ' + e.message)
    } finally {
      setLoadingTx(false)
    }
  }

  // Rafraîchit les KPIs (avoirs) + les transactions si le drawer est ouvert
  const refreshTout = useCallback(async (avoirCourant) => {
    const cible = avoirCourant || drawerAvoir
    try {
      const avs = await window.ipcRenderer.invoke('avoirs:getAll')
      setAvoirs(avs || [])
      if (cible) {
        const updated = (avs || []).find(a => a.id === cible.id)
        if (updated) setDrawerAvoir(updated)
        if (drawerVisible) {
          setLoadingTx(true)
          try {
            const tx = await window.ipcRenderer.invoke('avoirs:getTransactions', cible.id)
            setTransactions(tx || [])
          } finally {
            setLoadingTx(false)
          }
        }
      }
    } catch (e) {
      message.error('Erreur : ' + e.message)
    }
  }, [drawerAvoir, drawerVisible])

  // ── Créer un compte ─────────────────────────────────────────────
  const creerCompte = async (vals) => {
    setLoadingCreer(true)
    try {
      await window.ipcRenderer.invoke('avoirs:creerCompte', {
        client_id:      vals.client_id,
        montant_initial: vals.montant_initial,
        description:    vals.description || '',
        seuil_alerte:   vals.seuil_alerte || 0,
      })
      message.success('Compte prépayé créé')
      setModalCreer(false)
      formCreer.resetFields()
      charger()
    } catch (e) {
      message.error(e.message)
    } finally {
      setLoadingCreer(false)
    }
  }

  // ── Recharger ───────────────────────────────────────────────────
  const recharger = async (vals) => {
    setLoadingRecharge(true)
    try {
      await window.ipcRenderer.invoke('avoirs:recharger', {
        avoir_id:    avoirSelectionne.id,
        montant:     vals.montant,
        description: vals.description || '',
      })
      message.success('Compte rechargé')
      setModalRecharger(false)
      formRecharge.resetFields()
      refreshTout(avoirSelectionne)
    } catch (e) {
      message.error(e.message)
    } finally {
      setLoadingRecharge(false)
    }
  }

  // ── Enregistrer un achat ────────────────────────────────────────
  const ajouterLignePanier = () => {
    setPanier(prev => [...prev, { produit_id: null, nom: '', quantite: 1, prix_unitaire: 0, total: 0 }])
  }

  const modifierLigne = (i, field, value) => {
    setPanier(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      if (field === 'produit_id') {
        const prod = produits.find(p => p.id === value)
        if (prod) {
          next[i].nom           = prod.nom
          next[i].prix_unitaire = prod.prix_vente || prod.prix || 0
        }
      }
      // Recalculer total à chaque modification
      next[i].total = (next[i].prix_unitaire || 0) * (next[i].quantite || 1)
      return next
    })
  }

  const supprimerLigne = (i) => {
    setPanier(prev => prev.filter((_, idx) => idx !== i))
  }

  const totalPanier = panier.reduce((s, l) => s + (l.prix_unitaire || 0) * (l.quantite || 1), 0)

  const enregistrerAchat = async (vals) => {
    const montant = vals.montant_manuel != null ? vals.montant_manuel : totalPanier
    if (!montant || montant <= 0) {
      message.error('Le montant doit être supérieur à 0')
      return
    }
    setLoadingAchat(true)
    try {
      const tx = await window.ipcRenderer.invoke('avoirs:enregistrerAchat', {
        avoir_id: avoirSelectionne.id,
        libelle:  vals.libelle || 'Achat sur compte prépayé',
        montant,
        panier:   JSON.stringify(panier),
      })
      message.success('Achat enregistré')
      if (tx.en_alerte) {
        message.warning('⚠️ Solde faible — Pensez à recharger le compte')
      }
      setModalAchat(false)
      formAchat.resetFields()
      setPanier([])
      refreshTout(avoirSelectionne)
    } catch (e) {
      message.error(e.message)
    } finally {
      setLoadingAchat(false)
    }
  }

  // ── Générer PDF ──────────────────────────────────────────────────
  const genererPDF = async (tx, avoir, client) => {
    setPdfTx(tx)
    setPdfAvoir(avoir)
    setPdfClient(client || clients.find(c => c.id === (avoir?.client_id || tx?.client_id)) || {})
    setModalPdf(true)
  }

  const imprimerPdf = async () => {
    const el = document.getElementById('facture-avoir-preview')
    if (!el) return
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const w = pdf.internal.pageSize.getWidth()
      const h = (canvas.height * w) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, w, h)
      const ref = pdfTx ? `TXN-${String(pdfTx.id).padStart(6, '0')}` : 'avoir'
      pdf.save(`Facture-${ref}.pdf`)
    } catch (e) {
      message.error('Erreur PDF : ' + e.message)
    }
  }

  // ── Clôturer / Supprimer ─────────────────────────────────────────
  const cloturerCompte = async (id) => {
    try {
      await window.ipcRenderer.invoke('avoirs:cloturerCompte', id)
      message.success('Compte clôturé')
      charger()
    } catch (e) {
      message.error(e.message)
    }
  }

  const supprimerCompte = async (id) => {
    try {
      await window.ipcRenderer.invoke('avoirs:delete', id)
      message.success('Compte supprimé')
      charger()
    } catch (e) {
      message.error(e.message)
    }
  }

  // ── KPIs ─────────────────────────────────────────────────────────
  const totalSoldes    = avoirs.filter(a => a.actif).reduce((s, a) => s + (a.solde_restant || 0), 0)
  const totalDepots    = avoirs.filter(a => a.actif).reduce((s, a) => s + (a.montant_initial || 0), 0)
  const comptesAlerte  = avoirs.filter(a => a.en_alerte && a.actif).length
  const comptesActifs  = avoirs.filter(a => a.actif).length

  // ── Colonnes table principale ─────────────────────────────────────
  const colonnes = [
    {
      title: 'Client',
      dataIndex: 'client_nom',
      render: (v, r) => (
        <Space>
          <UserOutlined style={{ color: '#1565C0' }} />
          <span style={{ fontWeight: 500 }}>{v || '—'}</span>
          {r.en_alerte && r.actif ? (
            <Tooltip title={`Solde ≤ seuil d'alerte (${fmt(r.seuil_alerte)})`}>
              <WarningOutlined style={{ color: '#FF9800' }} />
            </Tooltip>
          ) : null}
        </Space>
      )
    },
    {
      title: 'Référence',
      dataIndex: 'reference',
      render: v => <Tag color="blue">{v}</Tag>
    },
    {
      title: 'Dépôt initial',
      dataIndex: 'montant_initial',
      align: 'right',
      render: v => <span style={{ color: '#555' }}>{fmt(v)}</span>
    },
    {
      title: 'Solde restant',
      dataIndex: 'solde_restant',
      align: 'right',
      render: (v, r) => (
        <span style={{ fontWeight: 'bold', color: r.en_alerte ? '#FF9800' : '#1565C0', fontSize: '13px' }}>
          {fmt(v)}
        </span>
      )
    },
    {
      title: 'Achats',
      dataIndex: 'nb_achats',
      align: 'center',
      render: v => <Badge count={v} showZero style={{ backgroundColor: '#1565C0' }} />
    },
    {
      title: 'Statut',
      dataIndex: 'actif',
      align: 'center',
      render: v => v ? <Tag color="green">Actif</Tag> : <Tag color="default">Clôturé</Tag>
    },
    {
      title: 'Créé le',
      dataIndex: 'created_at',
      render: v => fmtDate(v)
    },
    {
      title: 'Actions',
      render: (_, r) => (
        <Space size="small">
          <Button size="small" icon={<HistoryOutlined />} onClick={() => ouvrirDrawer(r)}>
            Transactions
          </Button>
          {r.actif ? (
            <>
              <Button
                size="small" type="primary" icon={<ShoppingCartOutlined />}
                onClick={() => { setAvoirSelectionne(r); setPanier([]); setModalAchat(true) }}
              >
                Achat
              </Button>
              <Button
                size="small" icon={<ReloadOutlined />}
                onClick={() => { setAvoirSelectionne(r); setModalRecharger(true) }}
              >
                Recharger
              </Button>
              <Popconfirm title="Clôturer ce compte ?" onConfirm={() => cloturerCompte(r.id)}>
                <Button size="small" icon={<PauseCircleOutlined />} danger />
              </Popconfirm>
            </>
          ) : null}
          <Popconfirm title="Supprimer définitivement ?" onConfirm={() => supprimerCompte(r.id)}>
            <Button size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      )
    }
  ]

  // ── Colonnes transactions (drawer) ────────────────────────────────
  const colonnesTx = [
    {
      title: 'Date',
      dataIndex: 'created_at',
      render: v => fmtDate(v),
      width: 140
    },
    {
      title: 'Type',
      dataIndex: 'type',
      width: 90,
      render: v => v === 'achat'
        ? <Tag color="volcano">Achat</Tag>
        : <Tag color="green">Dépôt</Tag>
    },
    {
      title: 'Libellé',
      dataIndex: 'libelle',
      render: (v, r) => (
        <Space direction="vertical" size={0}>
          <Text>{v || '—'}</Text>
          {r.vente_id ? (
            <Tag color="cyan" style={{ fontSize: 10 }}>🏦 Vente #{r.vente_id}</Tag>
          ) : null}
        </Space>
      )
    },
    {
      title: 'Montant',
      dataIndex: 'montant',
      align: 'right',
      width: 130,
      render: (v, r) => (
        <span style={{ fontWeight: 'bold', color: r.type === 'achat' ? '#C62828' : '#2E7D32' }}>
          {r.type === 'achat' ? '- ' : '+ '}{fmt(v)}
        </span>
      )
    },
    {
      title: 'Solde restant',
      dataIndex: 'solde_apres',
      align: 'right',
      width: 130,
      render: v => <span style={{ color: '#1565C0', fontWeight: 500 }}>{fmt(v)}</span>
    },
    {
      title: 'PDF',
      width: 60,
      render: (_, tx) => (
        <Tooltip title="Générer facture">
          <Button
            size="small" icon={<FilePdfOutlined />} type="text"
            onClick={() => genererPDF(tx, drawerAvoir, clients.find(c => c.id === drawerAvoir?.client_id))}
          />
        </Tooltip>
      )
    }
  ]

  // ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px', background: '#F5F7FA', minHeight: '100vh' }}>

      {/* ── Titre + bouton ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Title level={3} style={{ margin: 0, color: '#1565C0' }}>
          <WalletOutlined style={{ marginRight: 10 }} />
          Comptes Prépayés Clients
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={charger}>Actualiser</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalCreer(true)}>
            Nouveau compte
          </Button>
        </Space>
      </div>

      {/* ── Alertes solde bas ── */}
      {comptesAlerte > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message={`${comptesAlerte} compte(s) avec un solde inférieur ou égal au seuil d'alerte`}
          style={{ marginBottom: '16px' }}
        />
      )}

      {/* ── KPIs ── */}
      <Row gutter={16} style={{ marginBottom: '20px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Comptes actifs"
              value={comptesActifs}
              prefix={<BankOutlined />}
              valueStyle={{ color: '#1565C0' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total dépôts"
              value={totalDepots}
              suffix="FCFA"
              valueStyle={{ color: '#2E7D32' }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Soldes disponibles"
              value={totalSoldes}
              suffix="FCFA"
              valueStyle={{ color: '#1565C0' }}
              prefix={<WalletOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="En alerte"
              value={comptesAlerte}
              prefix={<WarningOutlined />}
              valueStyle={{ color: comptesAlerte > 0 ? '#FF9800' : '#888' }}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Table principale ── */}
      <Card>
        <Table
          columns={colonnes}
          dataSource={avoirs}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: false }}
          rowClassName={r => r.en_alerte && r.actif ? 'row-alerte' : ''}
          locale={{ emptyText: <Empty description="Aucun compte prépayé" /> }}
        />
      </Card>

      {/* ══════════════════════════════════════════════════════
          MODAL — Créer un compte
      ══════════════════════════════════════════════════════ */}
      <Modal
        title={<><PlusOutlined /> Nouveau compte prépayé</>}
        open={modalCreer}
        onCancel={() => { if (!loadingCreer) { setModalCreer(false); formCreer.resetFields() } }}
        onOk={() => formCreer.submit()}
        okText="Créer"
        confirmLoading={loadingCreer}
        width={500}
      >
        <Form form={formCreer} layout="vertical" onFinish={creerCompte}>
          <Form.Item label="Client" required style={{ marginBottom: 16 }}>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="client_id" rules={[{ required: true, message: 'Client obligatoire' }]} noStyle>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Sélectionner un client"
                  options={clients.map(c => ({ value: c.id, label: c.nom }))}
                  style={{ width: '100%' }}
                />
              </Form.Item>
              <Button
                icon={<UserAddOutlined />}
                onClick={() => setClientModalVisible(true)}
                title="Nouveau client"
              >
                Nouveau
              </Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item name="montant_initial" label="Montant déposé (FCFA)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} placeholder="2 000 000" />
          </Form.Item>
          <Form.Item name="description" label="Description / Note">
            <Input.TextArea rows={2} placeholder="Objet du compte, commentaire..." />
          </Form.Item>
          <Form.Item name="seuil_alerte" label="Seuil d'alerte (FCFA)">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Laisser 0 pour désactiver" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ══════════════════════════════════════════════════════
          MODAL — Recharger
      ══════════════════════════════════════════════════════ */}
      <Modal
        title={<><ReloadOutlined /> Recharger le compte — {avoirSelectionne?.reference}</>}
        open={modalRecharger}
        onCancel={() => { if (!loadingRecharge) { setModalRecharger(false); formRecharge.resetFields() } }}
        onOk={() => formRecharge.submit()}
        okText="Recharger"
        confirmLoading={loadingRecharge}
        width={440}
      >
        {avoirSelectionne && (
          <div style={{ background: '#F5F9FF', padding: '10px 14px', borderRadius: 6, marginBottom: 16 }}>
            <Text>Client : <b>{avoirSelectionne.client_nom}</b></Text><br />
            <Text>Solde actuel : <b style={{ color: '#1565C0' }}>{fmt(avoirSelectionne.solde_restant)}</b></Text>
          </div>
        )}
        <Form form={formRecharge} layout="vertical" onFinish={recharger}>
          <Form.Item name="montant" label="Montant à ajouter (FCFA)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} placeholder="500 000" />
          </Form.Item>
          <Form.Item name="description" label="Motif du rechargement">
            <Input placeholder="Ex : Rechargement mensuel" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ══════════════════════════════════════════════════════
          MODAL — Enregistrer un achat
      ══════════════════════════════════════════════════════ */}
      <Modal
        title={<><ShoppingCartOutlined /> Achat sur compte — {avoirSelectionne?.reference}</>}
        open={modalAchat}
        onCancel={() => { if (!loadingAchat) { setModalAchat(false); formAchat.resetFields(); setPanier([]) } }}
        onOk={() => formAchat.submit()}
        okText="Enregistrer"
        confirmLoading={loadingAchat}
        width={700}
      >
        {avoirSelectionne && (
          <div style={{ background: '#F5F9FF', padding: '10px 14px', borderRadius: 6, marginBottom: 16 }}>
            <Text>Client : <b>{avoirSelectionne.client_nom}</b></Text>
            <span style={{ marginLeft: 24 }}>
              Solde disponible : <b style={{ color: '#1565C0' }}>{fmt(avoirSelectionne.solde_restant)}</b>
            </span>
          </div>
        )}
        <Form form={formAchat} layout="vertical" onFinish={enregistrerAchat}>
          <Form.Item name="libelle" label="Libellé de l'achat" rules={[{ required: true }]}>
            <Input placeholder="Ex : Achat matériel informatique" />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: '12px' }}>Articles (optionnel)</Divider>

          {panier.map((ligne, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <Select
                style={{ flex: 2 }}
                showSearch
                optionFilterProp="label"
                placeholder="Produit"
                value={ligne.produit_id}
                onChange={v => modifierLigne(i, 'produit_id', v)}
                options={produits.map(p => ({ value: p.id, label: p.nom }))}
              />
              <Input
                style={{ flex: 2 }}
                placeholder="Désignation"
                value={ligne.nom}
                onChange={e => modifierLigne(i, 'nom', e.target.value)}
              />
              <InputNumber
                style={{ width: 70 }}
                min={1} placeholder="Qté"
                value={ligne.quantite}
                onChange={v => modifierLigne(i, 'quantite', v)}
              />
              <InputNumber
                style={{ width: 110 }}
                min={0} placeholder="Prix unit."
                value={ligne.prix_unitaire}
                onChange={v => modifierLigne(i, 'prix_unitaire', v)}
              />
              <Button danger icon={<DeleteOutlined />} onClick={() => supprimerLigne(i)} />
            </div>
          ))}
          <Button icon={<PlusOutlined />} onClick={ajouterLignePanier} style={{ marginBottom: 12 }}>
            Ajouter un article
          </Button>

          {panier.length > 0 && (
            <div style={{ background: '#F5F9FF', padding: '8px 14px', borderRadius: 4, marginBottom: 12 }}>
              Total panier : <b style={{ color: '#1565C0' }}>{fmt(totalPanier)}</b>
            </div>
          )}

          <Divider orientation="left" style={{ fontSize: '12px' }}>Ou montant direct</Divider>
          <Form.Item
            name="montant_manuel"
            label="Montant de la transaction (FCFA)"
            tooltip="Remplissez ce champ si vous ne voulez pas détailler les articles, ou pour corriger le total"
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder={panier.length > 0 ? `Total panier : ${totalPanier}` : 'Montant'} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ══════════════════════════════════════════════════════
          MODAL — Aperçu PDF
      ══════════════════════════════════════════════════════ */}
      <Modal
        title={<><FilePdfOutlined /> Aperçu facture</>}
        open={modalPdf}
        onCancel={() => setModalPdf(false)}
        footer={[
          <Button key="close" onClick={() => setModalPdf(false)}>Fermer</Button>,
          <Button key="print" type="primary" icon={<FilePdfOutlined />} onClick={imprimerPdf}>
            Télécharger PDF
          </Button>
        ]}
        width={900}
      >
        <div style={{ maxHeight: '70vh', overflow: 'auto', background: '#f0f0f0', padding: 10 }}>
          <FactureAvoir
            id="facture-avoir-preview"
            transaction={pdfTx}
            avoir={pdfAvoir}
            client={pdfClient}
            parametres={parametres}
          />
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════
          DRAWER — Historique transactions
      ══════════════════════════════════════════════════════ */}
      <Drawer
        title={
          drawerAvoir ? (
            <Space>
              <WalletOutlined style={{ color: '#1565C0' }} />
              <span>{drawerAvoir.client_nom} — {drawerAvoir.reference}</span>
              {drawerAvoir.en_alerte && <Tag color="orange"><WarningOutlined /> Solde bas</Tag>}
            </Space>
          ) : 'Historique'
        }
        placement="right"
        width={820}
        open={drawerVisible}
        onClose={() => { setDrawerVisible(false); setDrawerAvoir(null); setTransactions([]) }}
        extra={
          <Space>
            <Button
              icon={<ShoppingCartOutlined />}
              type="primary"
              disabled={!drawerAvoir?.actif}
              onClick={() => {
                setAvoirSelectionne(drawerAvoir)
                setPanier([])
                setModalAchat(true)
              }}
            >
              Achat
            </Button>
            <Button
              icon={<ReloadOutlined />}
              disabled={!drawerAvoir?.actif}
              onClick={() => { setAvoirSelectionne(drawerAvoir); setModalRecharger(true) }}
            >
              Recharger
            </Button>
          </Space>
        }
      >
        {drawerAvoir && (
          <>
            {/* Résumé compte */}
            <Row gutter={12} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card size="small">
                  <Statistic title="Dépôt initial" value={Number(drawerAvoir.montant_initial)} suffix="FCFA" valueStyle={{ fontSize: 14 }} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="Solde restant"
                    value={Number(drawerAvoir.solde_restant)}
                    suffix="FCFA"
                    valueStyle={{ fontSize: 14, color: drawerAvoir.en_alerte ? '#FF9800' : '#1565C0' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="Montant dépensé"
                    value={Number(drawerAvoir.montant_initial) - Number(drawerAvoir.solde_restant)}
                    suffix="FCFA"
                    valueStyle={{ fontSize: 14, color: '#C62828' }}
                  />
                </Card>
              </Col>
            </Row>

            {/* Barre de progression solde */}
            {drawerAvoir.montant_initial > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 4 }}>
                  <span>Utilisation du compte</span>
                  <span>
                    {Math.round(((drawerAvoir.montant_initial - drawerAvoir.solde_restant) / drawerAvoir.montant_initial) * 100)}%
                  </span>
                </div>
                <div style={{ background: '#E3F2FD', borderRadius: 4, height: 10, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, Math.round(((drawerAvoir.montant_initial - drawerAvoir.solde_restant) / drawerAvoir.montant_initial) * 100))}%`,
                    height: '100%',
                    background: drawerAvoir.en_alerte ? '#FF9800' : '#1565C0',
                    borderRadius: 4,
                    transition: 'width 0.4s'
                  }} />
                </div>
              </div>
            )}

            {drawerAvoir.en_alerte && (
              <Alert
                type="warning"
                showIcon
                message={`Solde inférieur ou égal au seuil d'alerte (${fmt(drawerAvoir.seuil_alerte)})`}
                style={{ marginBottom: 14 }}
              />
            )}

            <Divider orientation="left" style={{ fontSize: 12 }}>Historique des transactions</Divider>

            <Table
              columns={colonnesTx}
              dataSource={transactions}
              rowKey="id"
              loading={loadingTx}
              size="small"
              pagination={{ pageSize: 20, showSizeChanger: false }}
              locale={{ emptyText: <Empty description="Aucune transaction" /> }}
            />
          </>
        )}
      </Drawer>

      <NouveauClientModal
        visible={clientModalVisible}
        onClose={() => setClientModalVisible(false)}
        onSuccess={async (result) => {
          const c = await window.ipcRenderer.invoke('clients:getAll')
          setClients(c || [])
          const id = result?.succes?.id || result?.id
          if (id) formCreer.setFieldValue('client_id', id)
        }}
      />

      <style>{`
        .row-alerte td { background: #FFF8E1 !important; }
      `}</style>
    </div>
  )
}
