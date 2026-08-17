import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Typography, Card, Row, Col, Tag, Button, Badge, Tabs, Select,
  DatePicker, Space, Alert, Modal, Form, Input, InputNumber,
  Divider, notification, Empty, Table, Popconfirm, message, Statistic
} from 'antd'
import {
  ShoppingCartOutlined, UserOutlined, ClockCircleOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, CalendarOutlined,
  PlusOutlined, DeleteOutlined, EyeOutlined, ArrowRightOutlined,
  BellOutlined, CloseCircleOutlined, AppstoreOutlined,
  UnorderedListOutlined, ReloadOutlined,
  LinkOutlined, CreditCardOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { CATEGORIES_PAR_DOMAINE, UNITES_DECIMALES } from '../utils/domainConfig'
import NouveauProduitRapideModal from '../components/NouveauProduitRapideModal'
import NouveauClientModal from '../components/NouveauClientModal'

dayjs.locale('fr')

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input
const ipcRenderer = typeof window !== 'undefined' ? window.ipcRenderer : null

// ── Référentiels ───────────────────────────────────────────────
const STATUTS = {
  nouvelle:       { label: 'Nouvelle',       color: 'blue',    next: 'en_preparation' },
  en_preparation: { label: 'En préparation', color: 'orange',  next: 'prete'          },
  prete:          { label: 'Prête',          color: 'green',   next: 'livree'         },
  livree:         { label: 'Livrée',         color: 'default', next: null             },
  annulee:        { label: 'Annulée',        color: 'red',     next: null             },
}

const PRIORITES = {
  basse:   { label: 'Basse',   color: '#8c8c8c' },
  normale: { label: 'Normale', color: '#1890ff' },
  haute:   { label: 'Haute',   color: '#fa8c16' },
  urgente: { label: 'Urgente', color: '#f5222d' },
}

const ORDRE_KANBAN = ['nouvelle', 'en_preparation', 'prete', 'livree']

function fmt(v) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(v || 0)) + ' FCFA'
}

function joursRestants(date) {
  if (!date) return null
  return dayjs(date).diff(dayjs().startOf('day'), 'day')
}

function parsePanier(raw) {
  if (!raw) return []
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return [] }
  }
  return Array.isArray(raw) ? raw : []
}

// ─────────────────────────────────────────────────────────────
// Carte Kanban
// ─────────────────────────────────────────────────────────────
function CarteCommande({ commande, onStatut, onVoir }) {
  const statut   = STATUTS[commande.statut]   || STATUTS.nouvelle
  const priorite = PRIORITES[commande.priorite] || PRIORITES.normale
  const jours    = joursRestants(commande.date_livraison_prevue)
  const enRetard = jours !== null && jours < 0 && !['livree', 'annulee'].includes(commande.statut)
  const panier   = parsePanier(commande.panier)

  return (
    <Card
      size="small"
      style={{
        marginBottom: 8,
        borderLeft: `4px solid ${priorite.color}`,
        background: enRetard ? '#fff2f0' : '#fff',
        borderRadius: 8,
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      }}
      bodyStyle={{ padding: '10px 12px' }}
    >
      <Space direction="vertical" size={3} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text strong style={{ fontSize: 11, color: '#1890ff' }}>{commande.numero}</Text>
          <Tag color={priorite.color} style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>
            {priorite.label}
          </Tag>
        </div>

        <Text strong style={{ fontSize: 13 }}>
          <UserOutlined style={{ marginRight: 4 }} />
          {commande.client_nom}
        </Text>

        {commande.client_telephone && (
          <Text type="secondary" style={{ fontSize: 11 }}>{commande.client_telephone}</Text>
        )}

        <Text style={{ fontSize: 12 }}>
          {panier.length} article{panier.length > 1 ? 's' : ''} —{' '}
          <strong>{fmt(commande.total)}</strong>
        </Text>

        {commande.date_livraison_prevue && (
          <Space size={4}>
            <ClockCircleOutlined style={{ color: enRetard ? '#f5222d' : '#8c8c8c', fontSize: 11 }} />
            <Text style={{ fontSize: 11, color: enRetard ? '#f5222d' : '#595959' }}>
              {enRetard
                ? `Retard de ${Math.abs(jours)}j`
                : jours === 0
                  ? "Aujourd'hui !"
                  : `Dans ${jours}j`}
            </Text>
          </Space>
        )}

        {commande.acompte > 0 && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            Acompte : {fmt(commande.acompte)} | Reste : {fmt(commande.total - commande.acompte)}
          </Text>
        )}

        <Divider style={{ margin: '6px 0' }} />

        <Space size={4} wrap>
          <Button size="small" icon={<EyeOutlined />} onClick={() => onVoir(commande)}>
            Détails
          </Button>
          {statut.next && (
            <Button
              type="primary" size="small" icon={<ArrowRightOutlined />}
              onClick={() => onStatut(commande.id, statut.next)}
            >
              {STATUTS[statut.next]?.label}
            </Button>
          )}
          {!['livree', 'annulee'].includes(commande.statut) && (
            <Popconfirm
              title="Annuler cette commande ?"
              onConfirm={() => onStatut(commande.id, 'annulee')}
              okText="Oui" cancelText="Non"
            >
              <Button size="small" danger icon={<CloseCircleOutlined />} />
            </Popconfirm>
          )}
        </Space>
      </Space>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// Colonne Kanban
// ─────────────────────────────────────────────────────────────
function ColonneKanban({ statut, commandes, onStatut, onVoir }) {
  const info  = STATUTS[statut]
  const total = commandes.reduce((s, c) => s + (c.total || 0), 0)

  return (
    <div style={{
      background: '#f5f5f5', borderRadius: 10,
      padding: '10px 8px', minHeight: 180, flex: '1 1 200px', minWidth: 190,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <Badge count={commandes.length} style={{ backgroundColor: '#1890ff' }} showZero>
          <Tag color={info.color} style={{ margin: 0, fontWeight: 600 }}>{info.label}</Tag>
        </Badge>
        <Text type="secondary" style={{ fontSize: 11 }}>{fmt(total)}</Text>
      </div>

      {commandes.length === 0
        ? <Empty description="Aucune" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '20px 0' }} />
        : commandes.map(c => (
          <CarteCommande key={c.id} commande={c} onStatut={onStatut} onVoir={onVoir} />
        ))
      }
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Calendrier
// ─────────────────────────────────────────────────────────────
function TabCalendrier({ ipcRenderer }) {
  const [date, setDate]       = useState(dayjs())
  const [rows, setRows]       = useState([])
  const [jourSel, setJourSel] = useState(null)

  const charger = useCallback(async (d) => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('commandes:getCalendrier', {
      annee: d.year(), mois: d.month() + 1
    })
    setRows(data || [])
  }, [ipcRenderer])

  useEffect(() => { charger(date) }, [date, charger])

  const parJour = useMemo(() => {
    const map = {}
    rows.forEach(c => {
      if (!c.date_livraison_prevue) return
      const k = dayjs(c.date_livraison_prevue).format('YYYY-MM-DD')
      if (!map[k]) map[k] = []
      map[k].push(c)
    })
    return map
  }, [rows])

  const debut           = date.startOf('month')
  const nbJours         = date.daysInMonth()
  const decalage        = debut.day() === 0 ? 6 : debut.day() - 1
  const aujourdhui      = dayjs().format('YYYY-MM-DD')
  const cmdsDuJour      = jourSel ? (parJour[date.date(jourSel).format('YYYY-MM-DD')] || []) : []

  const cellules = []
  for (let i = 0; i < decalage; i++) cellules.push(null)
  for (let i = 1; i <= nbJours; i++) cellules.push(i)

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        <Button onClick={() => setDate(d => d.subtract(1, 'month'))}>‹</Button>
        <Text strong style={{ width: 170, textAlign: 'center', display: 'inline-block', fontSize: 15 }}>
          {date.format('MMMM YYYY')}
        </Text>
        <Button onClick={() => setDate(d => d.add(1, 'month'))}>›</Button>
        <Button onClick={() => { setDate(dayjs()); setJourSel(null) }}>Aujourd'hui</Button>
      </Space>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 8 }}>
        {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(j => (
          <div key={j} style={{ textAlign: 'center', fontWeight: 600, color: '#595959', fontSize: 12, padding: '4px 0' }}>
            {j}
          </div>
        ))}
        {cellules.map((jour, idx) => {
          if (!jour) return <div key={`_${idx}`} />
          const dateKey = date.date(jour).format('YYYY-MM-DD')
          const cmds    = parJour[dateKey] || []
          const today   = dateKey === aujourdhui
          const sel     = jourSel === jour
          return (
            <div
              key={jour}
              onClick={() => setJourSel(sel ? null : jour)}
              style={{
                minHeight: 56, border: sel ? '2px solid #1890ff' : '1px solid #f0f0f0',
                borderRadius: 6, padding: '4px 6px', cursor: 'pointer',
                background: today ? '#e6f7ff' : sel ? '#f0f7ff' : '#fff',
              }}
            >
              <Text strong style={{ fontSize: 12, color: today ? '#1890ff' : 'inherit' }}>{jour}</Text>
              {cmds.slice(0, 3).map(c => (
                <div key={c.id} style={{
                  fontSize: 10, background: PRIORITES[c.priorite]?.color || '#1890ff',
                  color: '#fff', borderRadius: 3, padding: '1px 4px',
                  marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'
                }}>
                  {c.client_nom}
                </div>
              ))}
              {cmds.length > 3 && (
                <Text style={{ fontSize: 10, color: '#8c8c8c' }}>+{cmds.length - 3}</Text>
              )}
            </div>
          )
        })}
      </div>

      {jourSel && (
        <Card size="small" title={`Livraisons du ${jourSel} ${date.format('MMMM YYYY')}`}>
          {cmdsDuJour.length === 0
            ? <Empty description="Aucune livraison ce jour" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            : cmdsDuJour.map(c => (
              <div key={c.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 0', borderBottom: '1px solid #f0f0f0'
              }}>
                <Space>
                  <Tag color={STATUTS[c.statut]?.color}>{STATUTS[c.statut]?.label}</Tag>
                  <Text strong>{c.numero}</Text>
                  <Text>{c.client_nom}</Text>
                  {c.client_telephone && <Text type="secondary">({c.client_telephone})</Text>}
                </Space>
                <Text strong>{fmt(c.total)}</Text>
              </div>
            ))
          }
        </Card>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Modal Détail
// ─────────────────────────────────────────────────────────────
function ModalDetail({ commande, open, onClose, onStatut }) {
  if (!commande) return null
  const panier   = parsePanier(commande.panier)
  const statut   = STATUTS[commande.statut]   || STATUTS.nouvelle
  const priorite = PRIORITES[commande.priorite] || PRIORITES.normale
  const jours    = joursRestants(commande.date_livraison_prevue)

  return (
    <Modal
      title={<><EyeOutlined /> Commande {commande.numero}</>}
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          {statut.next && (
            <Button type="primary" icon={<ArrowRightOutlined />}
              onClick={() => { onStatut(commande.id, statut.next); onClose() }}>
              → {STATUTS[statut.next]?.label}
            </Button>
          )}
          <Button onClick={onClose}>Fermer</Button>
        </Space>
      }
      width={600}
    >
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={12}>
          <Text type="secondary">Client</Text>
          <div><Text strong style={{ fontSize: 15 }}>{commande.client_nom}</Text></div>
          {commande.client_telephone && <Text>{commande.client_telephone}</Text>}
        </Col>
        <Col span={12}>
          <Space wrap>
            <Tag color={statut.color}>{statut.label}</Tag>
            <Tag color={priorite.color}>{priorite.label}</Tag>
          </Space>
          {commande.date_livraison_prevue && (
            <div style={{ marginTop: 6 }}>
              <Text><ClockCircleOutlined /> {dayjs(commande.date_livraison_prevue).format('DD/MM/YYYY')}</Text>
              {jours !== null && (
                <Tag
                  color={jours < 0 ? 'red' : jours === 0 ? 'orange' : 'green'}
                  style={{ marginLeft: 6 }}
                >
                  {jours < 0 ? `Retard ${Math.abs(jours)}j` : jours === 0 ? "Aujourd'hui" : `+${jours}j`}
                </Tag>
              )}
            </div>
          )}
        </Col>
      </Row>

      <Table
        dataSource={panier} rowKey={(_, i) => i}
        size="small" pagination={false}
        columns={[
          { title: 'Article',      dataIndex: 'nom',           key: 'nom'           },
          { title: 'Qté',          dataIndex: 'quantite',      key: 'quantite', width: 60  },
          { title: 'Prix unit.',   dataIndex: 'prix_unitaire', key: 'pu',   render: v => fmt(v) },
          { title: 'Total',        dataIndex: 'total',         key: 'total', render: v => <Text strong>{fmt(v)}</Text> },
        ]}
        summary={() => (
          <Table.Summary.Row>
            <Table.Summary.Cell colSpan={3}><Text strong>Total commande</Text></Table.Summary.Cell>
            <Table.Summary.Cell>
              <Text strong style={{ color: '#1890ff' }}>{fmt(commande.total)}</Text>
            </Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />

      <div style={{ marginTop: 10 }}>
        {commande.vente_id && (
          <div style={{
            background: '#f6ffed', border: '1px solid #b7eb8f',
            borderRadius: 6, padding: '6px 12px', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <LinkOutlined style={{ color: '#52c41a' }} />
            <Text style={{ color: '#389e0d' }}>
              <strong>Vente #{commande.vente_id} générée</strong> — apparaît dans Ventes &amp; Statistiques
            </Text>
          </div>
        )}
        {commande.acompte > 0 && (
          <div>
            <Text type="secondary">Acompte : </Text>
            <Text strong>{fmt(commande.acompte)}</Text>
            <Text type="secondary"> | Reste à payer : </Text>
            <Text strong style={{ color: '#f5222d' }}>{fmt(commande.total - commande.acompte)}</Text>
          </div>
        )}
        {commande.mode_paiement && (
          <div style={{ marginTop: 4 }}>
            <Text type="secondary">Paiement : </Text>
            <Tag icon={<CreditCardOutlined />}>{commande.mode_paiement.replace('_', ' ')}</Tag>
          </div>
        )}
        {commande.notes && (
          <div style={{ marginTop: 6 }}>
            <Text type="secondary">Notes : </Text>
            <Text>{commande.notes}</Text>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────────────────────
export default function Commandes() {
  const [commandes, setCommandes]         = useState([])
  const [alertes, setAlertes]             = useState({ enRetard: [], aujourdhui: [], pretes: [] })
  const [loading, setLoading]             = useState(false)
  const [tab, setTab]                     = useState('kanban')
  const [search, setSearch]               = useState('')
  const [filtreStatut, setFiltreStatut]   = useState('tous')
  const [modalCreer, setModalCreer]       = useState(false)
  const [loadingCreer, setLoadingCreer]   = useState(false)
  const [formCreer]                       = Form.useForm()
  const [lignes, setLignes]               = useState([])
  const [clients, setClients]             = useState([])
  const [produits, setProduits]           = useState([])
  const [categories, setCategories]       = useState([])
  const [domaineActive, setDomaineActive] = useState(null)
  const [produitModalVisible, setProduitModalVisible] = useState(false)
  const [ligneActiveKey, setLigneActiveKey] = useState(null)
  const [rechercheProduitLigne, setRechercheProduitLigne] = useState('')
  const [clientModalVisible, setClientModalVisible] = useState(false)
  const [modalDetail, setModalDetail]     = useState(false)
  const [commandeSel, setCommandeSel]     = useState(null)

  // ── Chargement ─────────────────────────────────────────────
  const chargerCommandes = useCallback(async () => {
    if (!ipcRenderer) return
    setLoading(true)
    try {
      const rows = await ipcRenderer.invoke('commandes:getAll')
      setCommandes(rows || [])
    } finally {
      setLoading(false)
    }
  }, [])

  const chargerAlertes = useCallback(async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('commandes:getAlertes')
    if (data) setAlertes(data)
  }, [])

  useEffect(() => {
    chargerCommandes()
    chargerAlertes()
  }, [chargerCommandes, chargerAlertes])

  // Notifications au chargement
  useEffect(() => {
    if (alertes.enRetard.length > 0) {
      notification.warning({
        message: `${alertes.enRetard.length} commande(s) en retard`,
        description: alertes.enRetard.map(c => `${c.numero} — ${c.client_nom}`).join(' · '),
        duration: 6,
      })
    }
    if (alertes.pretes.length > 0) {
      notification.info({
        message: `${alertes.pretes.length} commande(s) prête(s) à livrer`,
        description: alertes.pretes.map(c => `${c.numero} — ${c.client_nom}`).join(' · '),
        duration: 5,
      })
    }
  }, [alertes.enRetard.length, alertes.pretes.length]) // eslint-disable-line

  // ── KPIs ───────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const actives  = commandes.filter(c => !['livree', 'annulee'].includes(c.statut))
    const pretes   = commandes.filter(c => c.statut === 'prete')
    const enRetard = commandes.filter(c =>
      !['livree', 'annulee'].includes(c.statut) &&
      c.date_livraison_prevue &&
      dayjs(c.date_livraison_prevue).isBefore(dayjs(), 'day')
    )
    return {
      total:    commandes.length,
      actives:  actives.length,
      pretes:   pretes.length,
      enRetard: enRetard.length,
    }
  }, [commandes])

  // ── Kanban ─────────────────────────────────────────────────
  const kanban = useMemo(() => {
    const map = {}
    ORDRE_KANBAN.forEach(s => { map[s] = commandes.filter(c => c.statut === s) })
    return map
  }, [commandes])

  // ── Liste filtrée ──────────────────────────────────────────
  const tableData = useMemo(() => {
    return commandes.filter(c => {
      const q = search.toLowerCase()
      const ok = !q
        || c.numero?.toLowerCase().includes(q)
        || c.client_nom?.toLowerCase().includes(q)
        || (c.client_telephone || '').includes(q)
      return ok && (filtreStatut === 'tous' || c.statut === filtreStatut)
    })
  }, [commandes, search, filtreStatut])

  // ── Actions ────────────────────────────────────────────────
  const changerStatut = async (id, statut) => {
    if (!ipcRenderer) return
    try {
      await ipcRenderer.invoke('commandes:changerStatut', { id, statut })
      const label = STATUTS[statut]?.label || statut
      message.success(statut === 'livree' ? '✅ Commande livrée !' : `Statut → ${label}`)
      chargerCommandes()
      chargerAlertes()
    } catch (e) {
      message.error('Erreur : ' + e.message)
    }
  }

  const supprimerCommande = async (id) => {
    if (!ipcRenderer) return
    await ipcRenderer.invoke('commandes:delete', id)
    message.success('Commande supprimée')
    chargerCommandes()
  }

  const voirCommande = (c) => { setCommandeSel(c); setModalDetail(true) }

  // ── Création ───────────────────────────────────────────────
  const ouvrirModalCreer = async () => {
    if (ipcRenderer) {
      const [cl, pr, dom, cat] = await Promise.all([
        ipcRenderer.invoke('clients:getAll'),
        ipcRenderer.invoke('produits:getAll'),
        ipcRenderer.invoke('domaine:get'),
        ipcRenderer.invoke('categories:getAll'),
      ])
      setClients(cl || [])
      setProduits(pr || [])
      if (dom?.type) setDomaineActive(dom.type)
      setCategories(cat || [])
    }
    setLignes([])
    formCreer.resetFields()
    setModalCreer(true)
  }

  // Recharge la liste des produits puis renseigne la ligne concernée avec le
  // produit fraîchement créé — sans passer par majLigne (qui chercherait dans
  // l'état `produits`, pas encore à jour juste après ce rechargement).
  const handleNouveauProduitCommande = async (nouveauProduit) => {
    if (ipcRenderer) {
      const pr = await ipcRenderer.invoke('produits:getAll')
      setProduits(pr || [])
    }
    setLignes(prev => prev.map(l => l.key === ligneActiveKey
      ? {
          ...l, produit_id: nouveauProduit.id, nom: nouveauProduit.nom,
          prix_unitaire: nouveauProduit.prix_vente || 0, unite: nouveauProduit.unite || ''
        }
      : l
    ))
    setRechercheProduitLigne('')
  }

  const categoriesDomaineActif = useMemo(
    () => (!domaineActive || domaineActive === 'general')
      ? categories
      : categories.filter(c => c.domaine === domaineActive),
    [categories, domaineActive]
  )

  const ajouterLigne = () =>
    setLignes(prev => [...prev, { key: Date.now(), produit_id: null, nom: '', unite: '', quantite: 1, prix_unitaire: 0 }])

  const majLigne = (key, field, value) =>
    setLignes(prev => prev.map(l => {
      if (l.key !== key) return l
      const u = { ...l, [field]: value }
      if (field === 'produit_id') {
        const p = produits.find(x => x.id === value)
        if (p) { u.nom = p.nom; u.prix_unitaire = p.prix_vente || 0; u.unite = p.unite || '' }
      }
      return u
    }))

  const supprimerLigne = (key) => setLignes(prev => prev.filter(l => l.key !== key))

  const totalCmd = useMemo(() =>
    lignes.reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0), [lignes])

  const soumettre = async () => {
    if (lignes.length === 0) { message.error('Ajoutez au moins un article'); return }
    if (lignes.some(l => !l.nom)) { message.error('Chaque article doit avoir un nom'); return }
    try { await formCreer.validateFields() } catch { return }

    const v = formCreer.getFieldsValue()
    const clientObj = clients.find(c => c.id === v.client_id)

    setLoadingCreer(true)
    try {
      await ipcRenderer.invoke('commandes:create', {
        client_id:             v.client_id || null,
        client_nom:            v.client_nom || clientObj?.nom || 'Client',
        client_telephone:      v.client_telephone || clientObj?.telephone || null,
        date_livraison_prevue: v.date_livraison_prevue?.format('YYYY-MM-DD') || null,
        priorite:              v.priorite || 'normale',
        mode_paiement:         v.mode_paiement || 'especes',
        panier: lignes.map(l => ({
          produit_id:    l.produit_id,
          nom:           l.nom,
          quantite:      l.quantite,
          prix_unitaire: l.prix_unitaire,
          total:         l.quantite * l.prix_unitaire,
        })),
        total:   totalCmd,
        acompte: v.acompte || 0,
        notes:   v.notes || null,
        vendeur: v.vendeur || null,
      })
      message.success('✅ Commande créée !')
      setModalCreer(false)
      chargerCommandes()
      chargerAlertes()
    } catch (e) {
      message.error('Erreur : ' + e.message)
    } finally {
      setLoadingCreer(false)
    }
  }

  // ── Colonnes Table ─────────────────────────────────────────
  const colonnes = [
    {
      title: 'N°', dataIndex: 'numero', key: 'numero', width: 130,
      render: v => <Text strong style={{ color: '#1890ff' }}>{v}</Text>
    },
    {
      title: 'Client', dataIndex: 'client_nom', key: 'client_nom',
      render: (v, r) => (
        <div>
          <Text strong>{v}</Text>
          {r.client_telephone && <div><Text type="secondary" style={{ fontSize: 11 }}>{r.client_telephone}</Text></div>}
        </div>
      )
    },
    {
      title: 'Articles', key: 'articles', width: 80,
      render: (_, r) => {
        const nb = parsePanier(r.panier).length
        return <Badge count={nb} style={{ backgroundColor: '#52c41a' }} />
      }
    },
    {
      title: 'Total', dataIndex: 'total', key: 'total',
      render: v => <Text strong>{fmt(v)}</Text>
    },
    {
      title: 'Statut', dataIndex: 'statut', key: 'statut',
      render: v => <Tag color={STATUTS[v]?.color}>{STATUTS[v]?.label || v}</Tag>
    },
    {
      title: 'Priorité', dataIndex: 'priorite', key: 'priorite',
      render: v => <Tag color={PRIORITES[v]?.color}>{PRIORITES[v]?.label || v}</Tag>
    },
    {
      title: 'Livraison', dataIndex: 'date_livraison_prevue', key: 'dlp',
      render: v => {
        if (!v) return <Text type="secondary">—</Text>
        const j = joursRestants(v)
        return (
          <Text style={{ color: j < 0 ? '#f5222d' : 'inherit' }}>
            {dayjs(v).format('DD/MM/YYYY')}
            {j < 0 && <Tag color="red" style={{ marginLeft: 4, fontSize: 10 }}>{Math.abs(j)}j retard</Tag>}
            {j === 0 && <Tag color="orange" style={{ marginLeft: 4, fontSize: 10 }}>Auj.</Tag>}
          </Text>
        )
      }
    },
    {
      title: 'Actions', key: 'actions', width: 130,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => voirCommande(r)} />
          {STATUTS[r.statut]?.next && (
            <Button size="small" type="primary" icon={<ArrowRightOutlined />}
              onClick={() => changerStatut(r.id, STATUTS[r.statut].next)} />
          )}
          <Popconfirm title="Supprimer ?" onConfirm={() => supprimerCommande(r.id)} okText="Oui" cancelText="Non">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    },
  ]

  // ─────────────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: 32 }}>
      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <ShoppingCartOutlined /> Commandes Clients
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { chargerCommandes(); chargerAlertes() }}>
            Actualiser
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={ouvrirModalCreer} size="large">
            Nouvelle commande
          </Button>
        </Space>
      </div>

      {/* KPI */}
      <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Total commandes" value={kpis.total}
              prefix={<ShoppingCartOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="En cours" value={kpis.actives}
              prefix={<ClockCircleOutlined />} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Prêtes à livrer" value={kpis.pretes}
              prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="En retard" value={kpis.enRetard}
              prefix={<ExclamationCircleOutlined />} valueStyle={{ color: '#f5222d' }} />
          </Card>
        </Col>
      </Row>

      {/* Alertes */}
      {alertes.enRetard.length > 0 && (
        <Alert type="error" showIcon closable style={{ marginBottom: 8 }}
          message={`${alertes.enRetard.length} commande(s) en retard`}
          description={alertes.enRetard.map(c => `${c.numero} — ${c.client_nom}`).join(' · ')}
        />
      )}
      {alertes.pretes.length > 0 && (
        <Alert type="success" showIcon closable icon={<BellOutlined />} style={{ marginBottom: 8 }}
          message={`${alertes.pretes.length} commande(s) prête(s) à livrer`}
          description={alertes.pretes.map(c => `${c.numero} — ${c.client_nom}`).join(' · ')}
        />
      )}
      {alertes.aujourdhui.length > 0 && (
        <Alert type="warning" showIcon closable style={{ marginBottom: 12 }}
          message={`${alertes.aujourdhui.length} livraison(s) prévue(s) aujourd'hui`}
          description={alertes.aujourdhui.map(c => `${c.numero} — ${c.client_nom}`).join(' · ')}
        />
      )}

      {/* Onglets */}
      <Card bodyStyle={{ padding: '12px 16px' }}>
        <Tabs activeKey={tab} onChange={setTab}>
          {/* KANBAN */}
          <Tabs.TabPane tab={<><AppstoreOutlined /> Kanban</>} key="kanban">
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
              {ORDRE_KANBAN.map(s => (
                <ColonneKanban
                  key={s} statut={s}
                  commandes={kanban[s] || []}
                  onStatut={changerStatut}
                  onVoir={voirCommande}
                />
              ))}
            </div>
          </Tabs.TabPane>

          {/* LISTE */}
          <Tabs.TabPane tab={<><UnorderedListOutlined /> Liste</>} key="liste">
            <Space style={{ marginBottom: 12 }} wrap>
              <Input.Search
                placeholder="N° commande, client, téléphone..."
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: 280 }}
              />
              <Select value={filtreStatut} onChange={setFiltreStatut} style={{ width: 160 }}>
                <Option value="tous">Tous les statuts</Option>
                {Object.entries(STATUTS).map(([k, v]) => (
                  <Option key={k} value={k}>{v.label}</Option>
                ))}
              </Select>
            </Space>
            <Table
              dataSource={tableData} columns={colonnes}
              rowKey="id" loading={loading} size="small"
              pagination={{ pageSize: 15, showSizeChanger: false }}
            />
          </Tabs.TabPane>

          {/* CALENDRIER */}
          <Tabs.TabPane tab={<><CalendarOutlined /> Calendrier</>} key="calendrier">
            <TabCalendrier ipcRenderer={ipcRenderer} />
          </Tabs.TabPane>
        </Tabs>
      </Card>

      {/* Modal Création */}
      <Modal
        title={<><PlusOutlined /> Nouvelle commande client</>}
        open={modalCreer}
        onCancel={() => setModalCreer(false)}
        onOk={soumettre}
        confirmLoading={loadingCreer}
        okText="Créer la commande"
        cancelText="Annuler"
        width={720}
        destroyOnClose
      >
        <Form form={formCreer} layout="vertical" size="small">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Client (catalogue)" name="client_id">
                <Select
                  showSearch placeholder="Choisir un client..." allowClear
                  optionFilterProp="children"
                  onChange={id => {
                    const c = clients.find(x => x.id === id)
                    if (c) formCreer.setFieldsValue({ client_nom: c.nom, client_telephone: c.telephone || '' })
                  }}
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <div style={{ padding: '8px', borderTop: '1px solid #eee' }}>
                        <Button type="dashed" icon={<PlusOutlined />}
                          style={{ width: '100%' }}
                          onClick={() => setClientModalVisible(true)}>
                          + Nouveau Client
                        </Button>
                      </div>
                    </>
                  )}
                >
                  {clients.map(c => (
                    <Option key={c.id} value={c.id}>
                      {c.nom}{c.telephone ? ` (${c.telephone})` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Nom du client" name="client_nom" rules={[{ required: true, message: 'Requis' }]}>
                <Input placeholder="Nom complet du client" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Téléphone" name="client_telephone">
                <Input placeholder="77 xxx xx xx" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Date de livraison" name="date_livraison_prevue">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Priorité" name="priorite" initialValue="normale">
                <Select>
                  {Object.entries(PRIORITES).map(([k, v]) => (
                    <Option key={k} value={k}><Tag color={v.color}>{v.label}</Tag></Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: '6px 0 10px' }}>Articles commandés</Divider>

          {lignes.map(ligne => (
            <div key={ligne.key} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <Select
                showSearch placeholder="Chercher un produit..." allowClear
                style={{ flex: 2 }}
                optionFilterProp="label"
                value={ligne.produit_id}
                onChange={v => majLigne(ligne.key, 'produit_id', v)}
                onSearch={setRechercheProduitLigne}
                dropdownRender={(menu) => (
                  <>
                    {menu}
                    <div style={{ padding: '8px', borderTop: '1px solid #eee' }}>
                      <Button type="dashed" icon={<PlusOutlined />}
                        style={{ width: '100%' }}
                        onClick={() => { setLigneActiveKey(ligne.key); setProduitModalVisible(true) }}>
                        + Nouveau produit{rechercheProduitLigne ? ` "${rechercheProduitLigne}"` : ''}
                      </Button>
                    </div>
                  </>
                )}
                options={(() => {
                  const catsDomaine = domaineActive && domaineActive !== 'general'
                    ? new Set((CATEGORIES_PAR_DOMAINE[domaineActive] || []).map(c => c.nom.toLowerCase()))
                    : null
                  const du  = catsDomaine ? produits.filter(p => catsDomaine.has((p.categorie || '').toLowerCase())) : produits
                  const hors = catsDomaine ? produits.filter(p => !catsDomaine.has((p.categorie || '').toLowerCase())) : []
                  const toOpt = (p) => ({
                    label: `${p.nom}${p.marque ? ' · ' + p.marque : ''} — ${fmt(p.prix_vente)} (stock: ${p.stock_actuel})`,
                    value: p.id
                  })
                  const result = du.map(toOpt)
                  if (hors.length) {
                    result.push({ label: '── Autres produits ──', value: '__sep__', disabled: true })
                    hors.forEach(p => result.push(toOpt(p)))
                  }
                  return result
                })()}
              />
              <Input
                style={{ flex: 2 }} placeholder="Désignation"
                value={ligne.nom}
                onChange={e => majLigne(ligne.key, 'nom', e.target.value)}
              />
              <InputNumber
                min={UNITES_DECIMALES.includes(ligne.unite) ? 0.001 : 1}
                step={UNITES_DECIMALES.includes(ligne.unite) ? 0.5 : 1}
                precision={UNITES_DECIMALES.includes(ligne.unite) ? 2 : 0}
                style={{ width: 80 }} placeholder="Qté"
                value={ligne.quantite}
                onChange={v => majLigne(ligne.key, 'quantite', v)}
                addonAfter={ligne.unite ? <span style={{ fontSize: 10 }}>{ligne.unite}</span> : undefined}
              />
              <InputNumber
                min={0} style={{ width: 110 }} placeholder="Prix unit."
                value={ligne.prix_unitaire}
                onChange={v => majLigne(ligne.key, 'prix_unitaire', v)}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
              />
              <Button danger icon={<DeleteOutlined />} onClick={() => supprimerLigne(ligne.key)} />
            </div>
          ))}

          <Button type="dashed" icon={<PlusOutlined />} onClick={ajouterLigne} block style={{ marginBottom: 10 }}>
            Ajouter un article
          </Button>

          {lignes.length > 0 && (
            <div style={{ textAlign: 'right', marginBottom: 8 }}>
              <Text strong style={{ fontSize: 14 }}>Total : {fmt(totalCmd)}</Text>
            </div>
          )}

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Mode de paiement" name="mode_paiement" initialValue="especes">
                <Select>
                  <Option value="especes"><CreditCardOutlined /> Espèces</Option>
                  <Option value="wave">Wave</Option>
                  <Option value="orange_money">Orange Money</Option>
                  <Option value="free_money">Free Money</Option>
                  <Option value="virement">Virement</Option>
                  <Option value="cheque">Chèque</Option>
                  <Option value="credit">Crédit (à payer)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Acompte versé (FCFA)" name="acompte" initialValue={0}>
                <InputNumber min={0} style={{ width: '100%' }}
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Vendeur" name="vendeur">
                <Input placeholder="Nom du vendeur" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Notes" name="notes">
                <TextArea rows={2} placeholder="Instructions spéciales, couleur, taille, modèle..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal Détail */}
      <ModalDetail
        commande={commandeSel}
        open={modalDetail}
        onClose={() => setModalDetail(false)}
        onStatut={changerStatut}
      />

      {/* Modal Nouveau Produit — création rapide sans quitter la commande en cours */}
      <NouveauProduitRapideModal
        visible={produitModalVisible}
        onClose={() => setProduitModalVisible(false)}
        nomInitial={rechercheProduitLigne}
        categoriesDomaine={categoriesDomaineActif}
        onSuccess={handleNouveauProduitCommande}
      />

      {/* Modal Nouveau Client — création rapide si le client n'est pas encore au catalogue */}
      <NouveauClientModal
        visible={clientModalVisible}
        onClose={() => setClientModalVisible(false)}
        onSuccess={async (result) => {
          if (ipcRenderer) {
            const cl = await ipcRenderer.invoke('clients:getAll')
            setClients(cl || [])
          }
          const nouveauClient = result?.succes
          if (nouveauClient) {
            formCreer.setFieldsValue({
              client_id: nouveauClient.id,
              client_nom: nouveauClient.nom,
              client_telephone: nouveauClient.telephone || ''
            })
          }
        }}
      />
    </div>
  )
}
