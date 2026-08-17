import React, { useState, useEffect, useMemo } from 'react'
import {
  Typography, Table, Button, Modal, Form,
  Input, InputNumber, Select, Space, Tag, message,
  Card, Row, Col, Tabs, Alert, Divider, Badge, Tooltip, DatePicker,
  Progress, Statistic
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  ArrowUpOutlined, ArrowDownOutlined, SearchOutlined,
  ClearOutlined, LockOutlined, WalletOutlined,
  CalendarOutlined, BarChartOutlined, CheckCircleOutlined,
  DownloadOutlined, AuditOutlined, RiseOutlined,
  FallOutlined, LineChartOutlined, PieChartOutlined,
  DollarOutlined, BankOutlined, ShoppingCartOutlined,
  WarningOutlined, BulbOutlined, TeamOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select
const { RangePicker } = DatePicker
const ipcRenderer = window.ipcRenderer

const CATS = {
  vente:     { label: 'Vente',             color: 'green',    icon: '💰' },
  achat:     { label: 'Achat stock',       color: 'blue',     icon: '📦' },
  salaire:   { label: 'Salaire',           color: 'purple',   icon: '👤' },
  loyer:     { label: 'Loyer',             color: 'orange',   icon: '🏠' },
  transport: { label: 'Transport',         color: 'cyan',     icon: '🚗' },
  retour:    { label: 'Retour/Remb.',      color: 'red',      icon: '↩️' },
  avoir:     { label: 'Compte prépayé',    color: 'geekblue', icon: '🏦' },
  autre:     { label: 'Autre',             color: 'default',  icon: '📌' },
}

const isEntree = (type) => type === 'entree' || type === 'recette'

function Comptabilite({ utilisateur }) {
  const role = utilisateur?.role || 'caissier'
  const peutGerer = role === 'administrateur' || role === 'gerant' || role === 'comptable'

  const [operations, setOperations] = useState([])
  const [stats, setStats] = useState(null)
  const [clotures, setClotures] = useState([])
  const [dashStats, setDashStats] = useState(null)
  const [modalOpVisible, setModalOpVisible] = useState(false)
  const [modalClotureVisible, setModalClotureVisible] = useState(false)
  const [editingOp, setEditingOp] = useState(null)
  const [loadingCloture, setLoadingCloture] = useState(false)
  const [loadingSave, setLoadingSave] = useState(false)
  const [activeTab, setActiveTab] = useState('operations')
  const [recherche, setRecherche] = useState('')
  const [filtreType, setFiltreType] = useState(null)
  const [filtreCategorie, setFiltreCategorie] = useState(null)
  const [filtrePeriode, setFiltrePeriode] = useState(null)
  const [notesClot, setNotesClot] = useState('')
  const [rapportCloture, setRapportCloture] = useState(null)
  const [loadingRapport, setLoadingRapport] = useState(false)
  const [formOp] = Form.useForm()

  const chargerOperations = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('tresorerie:getAll')
    setOperations(Array.isArray(data) ? data : [])
  }

  const chargerStats = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('tresorerie:getStats')
    setStats(data || null)
  }

  const chargerClotures = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('tresorerie:getClotures')
    setClotures(Array.isArray(data) ? data : [])
  }

  const chargerDashStats = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('dashboard:getAll')
    setDashStats(data || null)
  }

  useEffect(() => {
    chargerOperations()
    chargerStats()
    chargerClotures()
    chargerDashStats()
  }, [])

  const operationsFiltrees = useMemo(() => {
    let res = [...operations]
    if (recherche) {
      const t = recherche.toLowerCase()
      res = res.filter(o =>
        o.description?.toLowerCase().includes(t) ||
        o.categorie?.toLowerCase().includes(t)
      )
    }
    if (filtreType) {
      const ent = filtreType === 'entree'
      res = res.filter(o => ent ? isEntree(o.type) : !isEntree(o.type))
    }
    if (filtreCategorie) res = res.filter(o => o.categorie === filtreCategorie)
    if (filtrePeriode?.[0] && filtrePeriode?.[1]) {
      const debut = filtrePeriode[0].startOf('day')
      const fin   = filtrePeriode[1].endOf('day')
      res = res.filter(o => {
        const d = dayjs(o.date_operation)
        return d.isAfter(debut) && d.isBefore(fin)
      })
    }
    return res
  }, [operations, recherche, filtreType, filtreCategorie, filtrePeriode])

  const jourDejaClôture = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD')
    return clotures.some(c => dayjs(c.date_cloture).format('YYYY-MM-DD') === today)
  }, [clotures])

  const resumeJourActuel = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD')
    const opsJour = operations.filter(o => dayjs(o.date_operation).format('YYYY-MM-DD') === today)
    return {
      entrees: opsJour.filter(o => isEntree(o.type)).reduce((s, o) => s + (o.montant || 0), 0),
      sorties: opsJour.filter(o => !isEntree(o.type)).reduce((s, o) => s + (o.montant || 0), 0),
      nb: opsJour.length
    }
  }, [operations])

  const soldeGlobal = useMemo(() =>
    stats?.global?.solde ?? operations.reduce((s, o) => {
      if (isEntree(o.type) && o.categorie === 'avoir') return s
      return s + (isEntree(o.type) ? o.montant : -o.montant)
    }, 0)
  , [stats, operations])

  // Répartition des charges par catégorie
  const repartitionCharges = useMemo(() => {
    const sorties = operations.filter(o => !isEntree(o.type))
    const total = sorties.reduce((s, o) => s + (o.montant || 0), 0)
    const parCat = {}
    sorties.forEach(o => {
      const cat = o.categorie || 'autre'
      parCat[cat] = (parCat[cat] || 0) + (o.montant || 0)
    })
    return Object.entries(parCat)
      .map(([cat, montant]) => ({
        cat, montant,
        pct: total > 0 ? Math.round((montant / total) * 100) : 0,
        ...(CATS[cat] || { label: cat, color: 'default', icon: '📌' })
      }))
      .sort((a, b) => b.montant - a.montant)
  }, [operations])

  // CA mensuel agrégé depuis les clôtures
  const caMensuel = useMemo(() => {
    const byMonth = {}
    ;[...clotures].reverse().forEach(c => {
      const mois = dayjs(c.date_cloture).format('MM/YYYY')
      const key  = dayjs(c.date_cloture).format('YYYY-MM')
      if (!byMonth[key]) byMonth[key] = { mois, key, ca: 0, nbVentes: 0, entrees: 0, sorties: 0, nbJours: 0, soldeFin: 0 }
      byMonth[key].ca       += parseFloat(c.ca_jour) || 0
      byMonth[key].nbVentes += parseInt(c.nb_ventes) || 0
      byMonth[key].entrees  += parseFloat(c.total_entrees) || 0
      byMonth[key].sorties  += parseFloat(c.total_sorties) || 0
      byMonth[key].nbJours  += 1
      byMonth[key].soldeFin  = parseFloat(c.solde_fin) || 0
    })
    return Object.values(byMonth).sort((a, b) => b.key.localeCompare(a.key))
  }, [clotures])

  // Résumé du mois courant comparé au mois précédent
  const moisCourant = dayjs().format('MM/YYYY')
  const moisPrecedent = dayjs().subtract(1, 'month').format('MM/YYYY')
  const caMoisCourant   = caMensuel.find(m => m.mois === moisCourant)
  const caMoisPrecedent = caMensuel.find(m => m.mois === moisPrecedent)
  const tendancePct = caMoisPrecedent?.ca > 0
    ? Math.round(((caMoisCourant?.ca || 0) - caMoisPrecedent.ca) / caMoisPrecedent.ca * 100)
    : null

  const ouvrirModal = (op = null) => {
    setEditingOp(op)
    if (op) {
      formOp.setFieldsValue({
        ...op,
        type: isEntree(op.type) ? 'entree' : 'sortie'
      })
    } else {
      formOp.resetFields()
      formOp.setFieldValue('date_operation', dayjs().format('YYYY-MM-DD'))
    }
    setModalOpVisible(true)
  }

  const fermerModal = () => {
    if (loadingSave) return
    setModalOpVisible(false)
    setEditingOp(null)
    formOp.resetFields()
  }

  const sauvegarder = async (values) => {
    if (!ipcRenderer) return
    setLoadingSave(true)
    try {
      if (editingOp) {
        const res = await ipcRenderer.invoke('tresorerie:update', { ...values, id: editingOp.id })
        if (res?.erreur) { message.error(res.erreur); return }
        message.success('Opération modifiée')
      } else {
        await ipcRenderer.invoke('tresorerie:create', values)
        message.success('Opération enregistrée')
      }
      chargerOperations()
      chargerStats()
      fermerModal()
    } catch (err) {
      message.error(`Erreur : ${err.message}`)
    } finally {
      setLoadingSave(false)
    }
  }

  const supprimer = async (id) => {
    if (!ipcRenderer) return
    const res = await ipcRenderer.invoke('tresorerie:delete', id)
    if (res?.erreur) { message.error(res.erreur); return }
    message.success('Opération supprimée')
    chargerOperations()
    chargerStats()
  }

  // Ouvre la fenêtre de clôture ET charge le rapport intelligent du jour —
  // le caissier doit pouvoir vérifier ce qui s'est passé avant de verrouiller.
  const ouvrirModalCloture = async () => {
    setModalClotureVisible(true)
    setLoadingRapport(true)
    setRapportCloture(null)
    try {
      const today = dayjs().format('YYYY-MM-DD')
      const rapport = await ipcRenderer.invoke('tresorerie:rapportCloture', today)
      setRapportCloture(rapport)
    } finally {
      setLoadingRapport(false)
    }
  }

  const effectuerCloture = async () => {
    setLoadingCloture(true)
    try {
      const today = dayjs().format('YYYY-MM-DD')
      const res = await ipcRenderer.invoke(
        'tresorerie:cloturer', today,
        utilisateur?.username || role,
        notesClot
      )
      if (res?.erreur) { message.error(res.erreur); return }
      message.success(`Journée du ${dayjs().format('DD/MM/YYYY')} clôturée`)
      setModalClotureVisible(false)
      setNotesClot('')
      chargerOperations()
      chargerStats()
      chargerClotures()
    } finally {
      setLoadingCloture(false)
    }
  }

  const exporterCSV = () => {
    if (!operationsFiltrees.length) { message.warning('Aucune opération à exporter'); return }
    const headers = ['Type', 'Catégorie', 'Description', 'Montant', 'Date', 'Statut']
    const data = operationsFiltrees.map(o => [
      isEntree(o.type) ? 'Entrée' : 'Sortie',
      CATS[o.categorie]?.label || o.categorie || '—',
      (o.description || '—').replace(/,/g, ';'),
      o.montant,
      o.date_operation,
      o.cloturee ? 'Clôturée' : 'En cours'
    ])
    const csv = [headers, ...data].map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `tresorerie_${dayjs().format('YYYY-MM-DD')}.csv`
    a.click()
    message.success('Export CSV téléchargé')
  }

  // ─── Colonnes ───────────────────────────────────────────────────
  const columnsOps = [
    {
      title: 'Type', dataIndex: 'type', key: 'type', width: 115,
      render: (val, rec) => (
        <Space size={4}>
          {rec.cloturee ? <LockOutlined style={{ color: '#bfbfbf', fontSize: 11 }} /> : null}
          <Tag
            color={isEntree(val) ? 'success' : 'error'}
            icon={isEntree(val) ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            style={{ borderRadius: 10, fontSize: 11, margin: 0 }}
          >
            {isEntree(val) ? 'Entrée' : 'Sortie'}
          </Tag>
        </Space>
      )
    },
    {
      title: 'Catégorie', dataIndex: 'categorie', key: 'categorie', width: 145,
      render: val => {
        const c = CATS[val]
        return c
          ? <Tag color={c.color} style={{ borderRadius: 10, margin: 0 }}>{c.icon} {c.label}</Tag>
          : <Tag style={{ borderRadius: 10, margin: 0 }}>{val || '—'}</Tag>
      }
    },
    {
      title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true,
      render: val => val
        ? <Text style={{ fontSize: 13 }}>{val}</Text>
        : <Text type="secondary" italic style={{ fontSize: 12 }}>—</Text>
    },
    {
      title: 'Montant', dataIndex: 'montant', key: 'montant', width: 145, align: 'right',
      render: (val, rec) => (
        <Text strong style={{ color: isEntree(rec.type) ? '#52c41a' : '#ff4d4f', fontSize: 14, whiteSpace: 'nowrap' }}>
          {isEntree(rec.type) ? '+' : '-'}{(val || 0).toLocaleString('fr-FR')} F
        </Text>
      )
    },
    {
      title: 'Date', dataIndex: 'date_operation', key: 'date_operation', width: 100,
      render: val => (
        <Text style={{ color: '#888', fontSize: 12 }}>
          {new Date(val).toLocaleDateString('fr-FR')}
        </Text>
      )
    },
    {
      title: 'Actions', key: 'actions', fixed: 'right', width: 110,
      render: (_, record) => {
        if (record.cloturee) {
          return (
            <Tooltip title="Opération verrouillée après clôture journalière">
              <Tag icon={<LockOutlined />} color="default" style={{ borderRadius: 8, cursor: 'default' }}>
                Clôturée
              </Tag>
            </Tooltip>
          )
        }
        return (
          <Space size={4}>
            {peutGerer && (
              <Tooltip title="Modifier">
                <Button type="primary" ghost icon={<EditOutlined />} size="small"
                  style={{ borderRadius: 6 }} onClick={() => ouvrirModal(record)} />
              </Tooltip>
            )}
            {peutGerer && (
              <Tooltip title="Supprimer">
                <Button danger icon={<DeleteOutlined />} size="small" style={{ borderRadius: 6 }}
                  onClick={() => Modal.confirm({
                    title: 'Supprimer cette opération ?',
                    content: `${isEntree(record.type) ? '+' : '-'}${(record.montant || 0).toLocaleString('fr-FR')} FCFA — ${record.description || record.categorie || ''}`,
                    okText: 'Supprimer', okButtonProps: { danger: true },
                    cancelText: 'Annuler',
                    onOk: () => supprimer(record.id)
                  })} />
              </Tooltip>
            )}
          </Space>
        )
      }
    }
  ]

  const columnsClotures = [
    {
      title: 'Date', dataIndex: 'date_cloture', width: 110,
      render: val => <Text strong>{new Date(val).toLocaleDateString('fr-FR')}</Text>
    },
    {
      title: 'CA du jour', dataIndex: 'ca_jour', width: 140, align: 'right',
      render: (val, rec) => (
        <div>
          <Text strong style={{ color: '#1890ff' }}>{(val || 0).toLocaleString('fr-FR')} F</Text>
          <div style={{ fontSize: 11, color: '#888' }}>{rec.nb_ventes || 0} vente(s)</div>
        </div>
      )
    },
    {
      title: 'Entrées', dataIndex: 'total_entrees', width: 125, align: 'right',
      render: val => (
        <Text style={{ color: '#52c41a', fontWeight: 600 }}>
          +{(val || 0).toLocaleString('fr-FR')} F
        </Text>
      )
    },
    {
      title: 'Sorties', dataIndex: 'total_sorties', width: 125, align: 'right',
      render: val => (
        <Text style={{ color: '#ff4d4f', fontWeight: 600 }}>
          -{(val || 0).toLocaleString('fr-FR')} F
        </Text>
      )
    },
    {
      title: 'Solde ouverture', dataIndex: 'solde_debut', width: 130, align: 'right',
      render: val => <Text style={{ color: '#888' }}>{(val || 0).toLocaleString('fr-FR')} F</Text>
    },
    {
      title: 'Solde clôture', dataIndex: 'solde_fin', width: 130, align: 'right',
      render: val => (
        <Text strong style={{ color: (val || 0) >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 14 }}>
          {(val || 0).toLocaleString('fr-FR')} F
        </Text>
      )
    },
    {
      title: 'Clôturé par', dataIndex: 'cloturee_par', width: 110,
      render: val => val ? <Tag color="default">{val}</Tag> : '—'
    },
    {
      title: 'Notes', dataIndex: 'notes', ellipsis: true,
      render: val => val || <Text type="secondary" italic>—</Text>
    }
  ]

  return (
    <div>
      {/* ✅ En-tête */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        borderRadius: 16, padding: '20px 28px', marginBottom: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <Title level={2} style={{ color: 'white', margin: 0 }}>
            🏦 Gestion de Trésorerie
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.65)' }}>
            Flux financiers, clôtures journalières et suivi du comptoir
          </Text>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            color: soldeGlobal >= 0 ? '#52c41a' : '#ff4d4f',
            fontSize: 26, fontWeight: 'bold', lineHeight: 1.2
          }}>
            {soldeGlobal.toLocaleString('fr-FR')} F
          </div>
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
            Solde global trésorerie
          </Text>
        </div>
      </div>

      {/* ✅ KPI Cards — ligne 1 : résumé global */}
      <Row gutter={[14, 14]} style={{ marginBottom: 12 }}>
        {[
          {
            titre: 'Solde caisse',
            valeur: soldeGlobal,
            sub: 'Trésorerie + ventes encaissées',
            couleur: soldeGlobal >= 0 ? '#1890ff' : '#ff4d4f',
            bg: 'linear-gradient(135deg,#e6f7ff,#f0f5ff)',
            border: soldeGlobal >= 0 ? '#91caff' : '#ffa39e',
            icone: <WalletOutlined />, span: 6
          },
          {
            titre: 'CA ventes (global)',
            valeur: dashStats?.chiffreAffaire ?? 0,
            sub: dashStats?.chiffreAffaireAvoir > 0
              ? `dont ${(dashStats.chiffreAffaireAvoir || 0).toLocaleString('fr-FR')} F prépayés`
              : `${dashStats?.totalVentes || 0} vente(s) au total`,
            couleur: '#52c41a',
            bg: 'linear-gradient(135deg,#f6ffed,#fcffe6)',
            border: '#b7eb8f',
            icone: <BarChartOutlined />, span: 6
          },
          {
            titre: 'Charges totales',
            valeur: operations.filter(o => !isEntree(o.type)).reduce((s, o) => s + (o.montant || 0), 0),
            sub: `${repartitionCharges.length} catégorie(s)`,
            couleur: '#ff4d4f',
            bg: 'linear-gradient(135deg,#fff2f0,#fff1f0)',
            border: '#ffa39e',
            icone: <FallOutlined />, span: 6
          },
          {
            titre: 'Résultat net',
            valeur: (() => {
              const ca = dashStats?.chiffreAffaire || 0
              const charges = operations.filter(o => !isEntree(o.type) && o.categorie !== 'avoir').reduce((s, o) => s + (o.montant || 0), 0)
              return ca - charges
            })(),
            sub: 'CA ventes – charges',
            couleur: (() => {
              const ca = dashStats?.chiffreAffaire || 0
              const charges = operations.filter(o => !isEntree(o.type) && o.categorie !== 'avoir').reduce((s, o) => s + (o.montant || 0), 0)
              return (ca - charges) >= 0 ? '#13c2c2' : '#ff4d4f'
            })(),
            bg: 'linear-gradient(135deg,#e6fffb,#f0fff4)',
            border: '#87e8de',
            icone: <RiseOutlined />, span: 6
          }
        ].map((s, i) => (
          <Col span={s.span} key={i}>
            <Card style={{ borderRadius: 14, border: `1px solid ${s.border}`, background: s.bg }}
              bodyStyle={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 4 }}>{s.titre}</Text>
                  <div style={{ color: s.couleur, fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
                    {(s.valeur || 0).toLocaleString('fr-FR')}
                    <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 3 }}>F</span>
                  </div>
                  <Text style={{ color: '#aaa', fontSize: 11, marginTop: 4, display: 'block' }}>{s.sub}</Text>
                </div>
                <div style={{ fontSize: 22, color: s.couleur, opacity: 0.7 }}>{s.icone}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* KPI Cards — ligne 2 : aujourd'hui + ce mois */}
      <Row gutter={[14, 14]} style={{ marginBottom: 20 }}>
        {[
          {
            titre: "CA ventes aujourd'hui",
            valeur: stats?.jour?.caVentes ?? 0,
            sub: stats?.jour?.caVentesAvoir > 0
              ? `Cash: ${(stats.jour.caVentesCash || 0).toLocaleString('fr-FR')} F · Prépayé: ${(stats.jour.caVentesAvoir || 0).toLocaleString('fr-FR')} F`
              : stats?.jour?.nbVentes > 0 ? `${stats.jour.nbVentes} vente(s)` : 'Aucune vente',
            couleur: '#722ed1', bg: '#f9f0ff', icone: <ShoppingCartOutlined />, span: 6
          },
          {
            titre: 'Entrées tréso ce mois',
            valeur: stats?.mois?.entrees ?? 0,
            sub: 'Dépôts, recettes manuelles',
            couleur: '#52c41a', bg: '#f6ffed', icone: <ArrowUpOutlined />, span: 5
          },
          {
            titre: 'Sorties tréso ce mois',
            valeur: stats?.mois?.sorties ?? 0,
            sub: 'Achats, charges, salaires',
            couleur: '#ff4d4f', bg: '#fff2f0', icone: <ArrowDownOutlined />, span: 5
          },
          {
            titre: 'Solde tréso ce mois',
            valeur: (stats?.mois?.entrees ?? 0) - (stats?.mois?.sorties ?? 0),
            sub: tendancePct !== null
              ? tendancePct >= 0
                ? `+${tendancePct}% vs mois précédent`
                : `${tendancePct}% vs mois précédent`
              : 'Entrées – Sorties',
            couleur: '#fa8c16', bg: '#fff7e6', icone: <BankOutlined />, span: 4
          },
          {
            titre: 'Jours clôturés',
            valeur: clotures.length,
            sub: `Dernier: ${clotures[0] ? dayjs(clotures[0].date_cloture).format('DD/MM/YY') : '—'}`,
            couleur: '#13c2c2', bg: '#e6fffb', icone: <CheckCircleOutlined />, noSuffix: true, span: 4
          }
        ].map((s, i) => (
          <Col span={s.span} key={i}>
            <Card style={{ borderRadius: 12, border: 'none', background: s.bg }}
              bodyStyle={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 20, color: s.couleur, flexShrink: 0 }}>{s.icone}</div>
                <div style={{ minWidth: 0 }}>
                  <Text style={{ color: '#888', fontSize: 11, display: 'block', whiteSpace: 'nowrap' }}>{s.titre}</Text>
                  <Text strong style={{ color: s.couleur, fontSize: 14 }}>
                    {(s.valeur || 0).toLocaleString('fr-FR')}
                    {!s.noSuffix && <span style={{ fontSize: 10 }}> F</span>}
                  </Text>
                  {s.sub && <Text style={{ color: '#aaa', fontSize: 10, display: 'block' }}>{s.sub}</Text>}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ✅ Alerte / statut clôture */}
      {peutGerer && !jourDejaClôture && (
        <Alert
          type="warning" showIcon
          style={{ borderRadius: 12, marginBottom: 16 }}
          message={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span>
                <strong>Comptoir non clôturé</strong> — journée du {dayjs().format('DD/MM/YYYY')} encore ouverte.
                Pensez à fermer le comptoir en fin de journée.
              </span>
              <Button
                type="primary" icon={<LockOutlined />}
                style={{ background: '#fa8c16', borderColor: '#fa8c16', borderRadius: 8, flexShrink: 0 }}
                onClick={ouvrirModalCloture}
              >
                Fermer le comptoir
              </Button>
            </div>
          }
        />
      )}
      {peutGerer && jourDejaClôture && (
        <Alert
          type="success" showIcon icon={<CheckCircleOutlined />}
          style={{ borderRadius: 12, marginBottom: 16 }}
          message={`Journée du ${dayjs().format('DD/MM/YYYY')} déjà clôturée.`}
        />
      )}

      {/* ✅ Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        tabBarExtraContent={
          <Space>
            <Button icon={<DownloadOutlined />} onClick={exporterCSV}
              style={{ borderRadius: 8 }}>
              Exporter CSV
            </Button>
            {peutGerer && (
              <Button type="primary" icon={<PlusOutlined />}
                style={{ background: 'linear-gradient(135deg,#1890ff,#722ed1)', border: 'none', borderRadius: 8 }}
                onClick={() => ouvrirModal()}>
                Nouvelle opération
              </Button>
            )}
          </Space>
        }
        items={[
          {
            key: 'operations',
            label: (
              <Space size={6}>
                <AuditOutlined />
                Opérations
                <Badge count={operations.length} style={{ background: '#1890ff' }} />
              </Space>
            ),
            children: (
              <>
                {/* Filtres */}
                <Card style={{ marginBottom: 12, borderRadius: 10 }} bodyStyle={{ padding: '12px 16px' }}>
                  <Row gutter={[12, 8]} align="middle">
                    <Col span={6}>
                      <Input
                        placeholder="Rechercher description / catégorie..."
                        prefix={<SearchOutlined style={{ color: '#1890ff' }} />}
                        allowClear value={recherche}
                        onChange={e => setRecherche(e.target.value)} size="large"
                      />
                    </Col>
                    <Col span={4}>
                      <Select placeholder="Type" allowClear style={{ width: '100%' }} size="large"
                        value={filtreType} onChange={setFiltreType}>
                        <Option value="entree">
                          <ArrowUpOutlined style={{ color: '#52c41a' }} /> Entrées
                        </Option>
                        <Option value="sortie">
                          <ArrowDownOutlined style={{ color: '#ff4d4f' }} /> Sorties
                        </Option>
                      </Select>
                    </Col>
                    <Col span={4}>
                      <Select placeholder="Catégorie" allowClear style={{ width: '100%' }} size="large"
                        value={filtreCategorie} onChange={setFiltreCategorie}>
                        {Object.entries(CATS).map(([k, v]) => (
                          <Option key={k} value={k}>{v.icon} {v.label}</Option>
                        ))}
                      </Select>
                    </Col>
                    <Col span={7}>
                      <RangePicker style={{ width: '100%' }} size="large"
                        value={filtrePeriode} onChange={setFiltrePeriode}
                        format="DD/MM/YYYY" placeholder={['Début', 'Fin']} />
                    </Col>
                    <Col span={3}>
                      <Button icon={<ClearOutlined />} size="large" style={{ width: '100%', borderRadius: 8 }}
                        onClick={() => {
                          setRecherche(''); setFiltreType(null)
                          setFiltreCategorie(null); setFiltrePeriode(null)
                        }}>
                        Reset
                      </Button>
                    </Col>
                  </Row>
                  <div style={{ marginTop: 6, color: '#888', fontSize: 12, textAlign: 'right' }}>
                    {operationsFiltrees.length} / {operations.length} opération(s)
                  </div>
                </Card>

                <Table
                  dataSource={operationsFiltrees}
                  columns={columnsOps}
                  rowKey="id"
                  scroll={{ x: 900 }}
                  size="middle"
                  rowClassName={rec =>
                    rec.cloturee ? 'row-cloture' :
                    isEntree(rec.type) ? 'row-entree' : 'row-sortie'
                  }
                  pagination={{
                    pageSize: 15, showSizeChanger: true,
                    pageSizeOptions: ['15', '30', '50'],
                    showTotal: (t, r) => `${r[0]}-${r[1]} sur ${t}`
                  }}
                  summary={(pageData) => {
                    const ent = pageData.filter(r => isEntree(r.type)).reduce((s, r) => s + (r.montant || 0), 0)
                    const sor = pageData.filter(r => !isEntree(r.type)).reduce((s, r) => s + (r.montant || 0), 0)
                    const net = ent - sor
                    return (
                      <Table.Summary.Row style={{ background: '#f8f9fa', fontWeight: 'bold' }}>
                        <Table.Summary.Cell index={0} colSpan={3}>
                          <Text type="secondary" style={{ fontSize: 11 }}>Résumé page visible</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3} align="right">
                          <div>
                            <Text style={{ color: '#52c41a', fontSize: 12, display: 'block' }}>
                              +{ent.toLocaleString('fr-FR')} F
                            </Text>
                            <Text style={{ color: '#ff4d4f', fontSize: 12, display: 'block' }}>
                              -{sor.toLocaleString('fr-FR')} F
                            </Text>
                            <Divider style={{ margin: '2px 0' }} />
                            <Text style={{ color: net >= 0 ? '#1890ff' : '#ff4d4f', fontSize: 12, fontWeight: 700 }}>
                              Net : {net >= 0 ? '+' : ''}{net.toLocaleString('fr-FR')} F
                            </Text>
                          </div>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={4} />
                        <Table.Summary.Cell index={5} />
                      </Table.Summary.Row>
                    )
                  }}
                />
              </>
            )
          },
          {
            key: 'analyse',
            label: (
              <Space size={6}>
                <LineChartOutlined />
                Analyse CA
              </Space>
            ),
            children: (
              <div>
                {/* ── Résumé financier ───────────────────────────────────── */}
                <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                  <Col span={24}>
                    <Card
                      title={<Space><DollarOutlined style={{ color: '#1890ff' }} /><span>Compte de résultat simplifié</span></Space>}
                      style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                      bodyStyle={{ padding: '16px 20px' }}
                    >
                      <Row gutter={[24, 16]}>
                        {/* Recettes */}
                        <Col span={8}>
                          <div style={{ background: '#f6ffed', borderRadius: 12, padding: '14px 18px', border: '1px solid #b7eb8f' }}>
                            <Text style={{ color: '#389e0d', fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 8 }}>
                              RECETTES
                            </Text>
                            {(() => {
                              const caNet       = dashStats?.chiffreAffaire || 0
                              const caAvoir     = dashStats?.chiffreAffaireAvoir || 0
                              const caCash      = caNet - caAvoir   // Cash net = CA net − portion avoir
                              const caRetournes = dashStats?.totalRetournes || 0
                              const autresEnt   = operations.filter(o => isEntree(o.type) && o.categorie !== 'avoir' && o.categorie !== 'vente').reduce((s, o) => s + o.montant, 0)
                              const rows = [
                                { label: 'CA ventes brut', val: dashStats?.chiffreAffaireBrut || (caNet + caRetournes), italic: false },
                                ...(caRetournes > 0 ? [{ label: '  (−) Retours / remboursements', val: -caRetournes, neg: true }] : []),
                                { label: '  dont espèces / mobile', val: caCash, sub: true },
                                { label: '  dont comptes prépayés', val: caAvoir, sub: true },
                                { label: 'Autres entrées trésorerie', val: autresEnt },
                              ]
                              return rows.map((r, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed #d9f7be' }}>
                                  <Text style={{ color: r.sub ? '#888' : '#555', fontSize: r.sub ? 11 : 12, fontStyle: r.italic ? 'italic' : 'normal' }}>{r.label}</Text>
                                  <Text strong style={{ color: r.neg ? '#ff4d4f' : r.sub ? '#888' : '#52c41a', fontSize: r.sub ? 11 : 12 }}>
                                    {r.neg ? '' : ''}{(r.val || 0).toLocaleString('fr-FR')} F
                                  </Text>
                                </div>
                              ))
                            })()}
                            {(() => {
                              const caNet     = dashStats?.chiffreAffaire || 0
                              const autresEnt = operations.filter(o => isEntree(o.type) && o.categorie !== 'avoir' && o.categorie !== 'vente').reduce((s, o) => s + o.montant, 0)
                              return (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                                  <Text strong style={{ color: '#389e0d' }}>Total recettes</Text>
                                  <Text strong style={{ color: '#389e0d', fontSize: 16 }}>
                                    {(caNet + autresEnt).toLocaleString('fr-FR')} F
                                  </Text>
                                </div>
                              )
                            })()}
                          </div>
                        </Col>

                        {/* Charges */}
                        <Col span={8}>
                          <div style={{ background: '#fff2f0', borderRadius: 12, padding: '14px 18px', border: '1px solid #ffa39e' }}>
                            <Text style={{ color: '#cf1322', fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 8 }}>
                              CHARGES
                            </Text>
                            {repartitionCharges.slice(0, 5).map((r, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed #ffd6d6' }}>
                                <Text style={{ color: '#555', fontSize: 12 }}>{r.icon} {r.label}</Text>
                                <Text strong style={{ color: '#ff4d4f', fontSize: 12 }}>{(r.montant || 0).toLocaleString('fr-FR')} F</Text>
                              </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                              <Text strong style={{ color: '#cf1322' }}>Total charges</Text>
                              <Text strong style={{ color: '#cf1322', fontSize: 16 }}>
                                {operations.filter(o => !isEntree(o.type)).reduce((s, o) => s + o.montant, 0).toLocaleString('fr-FR')} F
                              </Text>
                            </div>
                          </div>
                        </Col>

                        {/* Résultat */}
                        <Col span={8}>
                          {(() => {
                            const recettes = (dashStats?.chiffreAffaire || 0) + operations.filter(o => isEntree(o.type) && o.categorie !== 'avoir' && o.categorie !== 'vente').reduce((s, o) => s + o.montant, 0)
                            const charges  = operations.filter(o => !isEntree(o.type)).reduce((s, o) => s + o.montant, 0)
                            const resultat = recettes - charges
                            const pctCharges = recettes > 0 ? Math.round(charges / recettes * 100) : 0
                            return (
                              <div style={{
                                background: resultat >= 0 ? 'linear-gradient(135deg,#e6fffb,#f0fff4)' : '#fff2f0',
                                borderRadius: 12, padding: '14px 18px',
                                border: `1px solid ${resultat >= 0 ? '#87e8de' : '#ffa39e'}`,
                                textAlign: 'center'
                              }}>
                                <Text style={{ color: '#888', fontSize: 12, display: 'block', marginBottom: 8 }}>RÉSULTAT NET</Text>
                                <div style={{ fontSize: 32, fontWeight: 900, color: resultat >= 0 ? '#13c2c2' : '#ff4d4f', lineHeight: 1 }}>
                                  {resultat >= 0 ? '+' : ''}{resultat.toLocaleString('fr-FR')}
                                </div>
                                <Text style={{ color: '#888', fontSize: 11 }}>FCFA</Text>
                                <Divider style={{ margin: '10px 0' }} />
                                <div style={{ marginBottom: 6 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 4 }}>
                                    <span>Taux de charges</span><span>{pctCharges}%</span>
                                  </div>
                                  <Progress percent={pctCharges} strokeColor={pctCharges > 80 ? '#ff4d4f' : pctCharges > 60 ? '#faad14' : '#52c41a'} showInfo={false} size="small" />
                                </div>
                                <Tag color={resultat >= 0 ? 'success' : 'error'} style={{ borderRadius: 10, marginTop: 4 }}>
                                  {resultat >= 0 ? 'Bénéfice' : 'Déficit'}
                                </Tag>
                              </div>
                            )
                          })()}
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                </Row>

                {/* ── CA mensuel + Répartition charges ──────────────────── */}
                <Row gutter={[16, 16]}>
                  {/* CA mensuel */}
                  <Col span={14}>
                    <Card
                      title={<Space><CalendarOutlined style={{ color: '#fa8c16' }} /><span>CA mensuel (clôtures)</span></Space>}
                      style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                      bodyStyle={{ padding: 0 }}
                    >
                      {caMensuel.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#aaa' }}>
                          <CalendarOutlined style={{ fontSize: 40, color: '#d9d9d9' }} />
                          <p style={{ marginTop: 12 }}>Aucune clôture journalière enregistrée</p>
                          <Text style={{ fontSize: 12 }}>Les clôtures apparaîtront ici après fermeture du comptoir</Text>
                        </div>
                      ) : (
                        <Table
                          dataSource={caMensuel}
                          rowKey="key"
                          size="small"
                          pagination={{ pageSize: 8, hideOnSinglePage: true }}
                          columns={[
                            {
                              title: 'Mois', dataIndex: 'mois', width: 90,
                              render: (val, rec) => (
                                <div>
                                  <Text strong style={{ color: val === moisCourant ? '#1890ff' : '#333' }}>{val}</Text>
                                  {val === moisCourant && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10, borderRadius: 8 }}>En cours</Tag>}
                                </div>
                              )
                            },
                            {
                              title: 'CA ventes', dataIndex: 'ca', align: 'right', width: 130,
                              render: (val, rec, idx) => {
                                const prev = caMensuel[idx + 1]
                                const trend = prev?.ca > 0 ? ((val - prev.ca) / prev.ca * 100).toFixed(0) : null
                                return (
                                  <div>
                                    <Text strong style={{ color: '#1890ff' }}>{(val || 0).toLocaleString('fr-FR')} F</Text>
                                    {trend !== null && (
                                      <div style={{ fontSize: 10, color: Number(trend) >= 0 ? '#52c41a' : '#ff4d4f' }}>
                                        {Number(trend) >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
                                      </div>
                                    )}
                                  </div>
                                )
                              }
                            },
                            {
                              title: 'Ventes', dataIndex: 'nbVentes', align: 'center', width: 70,
                              render: val => <Tag color="geekblue">{val}</Tag>
                            },
                            {
                              title: 'Entrées', dataIndex: 'entrees', align: 'right', width: 110,
                              render: val => <Text style={{ color: '#52c41a', fontSize: 12 }}>+{(val || 0).toLocaleString('fr-FR')} F</Text>
                            },
                            {
                              title: 'Sorties', dataIndex: 'sorties', align: 'right', width: 110,
                              render: val => <Text style={{ color: '#ff4d4f', fontSize: 12 }}>-{(val || 0).toLocaleString('fr-FR')} F</Text>
                            },
                            {
                              title: 'Solde fin', dataIndex: 'soldeFin', align: 'right', width: 110,
                              render: val => (
                                <Text strong style={{ color: val >= 0 ? '#13c2c2' : '#ff4d4f' }}>
                                  {(val || 0).toLocaleString('fr-FR')} F
                                </Text>
                              )
                            },
                            {
                              title: 'Jours', dataIndex: 'nbJours', align: 'center', width: 60,
                              render: val => <Text style={{ color: '#888', fontSize: 11 }}>{val}j</Text>
                            }
                          ]}
                          summary={(pageData) => {
                            const totalCA  = pageData.reduce((s, r) => s + (r.ca || 0), 0)
                            const totalNb  = pageData.reduce((s, r) => s + (r.nbVentes || 0), 0)
                            return (
                              <Table.Summary.Row style={{ background: '#f8f9fa', fontWeight: 'bold' }}>
                                <Table.Summary.Cell index={0}><Text strong>Total</Text></Table.Summary.Cell>
                                <Table.Summary.Cell index={1} align="right">
                                  <Text strong style={{ color: '#1890ff' }}>{totalCA.toLocaleString('fr-FR')} F</Text>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={2} align="center">
                                  <Text strong>{totalNb}</Text>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={3} colSpan={4} />
                              </Table.Summary.Row>
                            )
                          }}
                        />
                      )}
                    </Card>
                  </Col>

                  {/* Répartition charges */}
                  <Col span={10}>
                    <Card
                      title={<Space><PieChartOutlined style={{ color: '#ff4d4f' }} /><span>Répartition des charges</span></Space>}
                      style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%' }}
                      bodyStyle={{ padding: '16px 20px' }}
                    >
                      {repartitionCharges.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#aaa', padding: '40px 0' }}>
                          Aucune charge enregistrée
                        </div>
                      ) : (
                        <div>
                          {repartitionCharges.map((r, i) => (
                            <div key={i} style={{ marginBottom: 14 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text style={{ fontSize: 13 }}>{r.icon} {r.label}</Text>
                                <Space size={8}>
                                  <Text strong style={{ color: '#ff4d4f', fontSize: 13 }}>
                                    {(r.montant || 0).toLocaleString('fr-FR')} F
                                  </Text>
                                  <Tag style={{ borderRadius: 8, fontSize: 10, minWidth: 36, textAlign: 'center' }}>
                                    {r.pct}%
                                  </Tag>
                                </Space>
                              </div>
                              <Progress
                                percent={r.pct}
                                strokeColor={
                                  r.cat === 'achat' ? '#1890ff' :
                                  r.cat === 'salaire' ? '#722ed1' :
                                  r.cat === 'loyer' ? '#fa8c16' :
                                  r.cat === 'transport' ? '#13c2c2' :
                                  r.cat === 'retour' ? '#ff4d4f' : '#52c41a'
                                }
                                showInfo={false} size="small"
                              />
                            </div>
                          ))}
                          <Divider style={{ margin: '12px 0' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text strong>Total charges</Text>
                            <Text strong style={{ color: '#ff4d4f', fontSize: 15 }}>
                              {repartitionCharges.reduce((s, r) => s + r.montant, 0).toLocaleString('fr-FR')} F
                            </Text>
                          </div>
                        </div>
                      )}
                    </Card>
                  </Col>
                </Row>
              </div>
            )
          },
          {
            key: 'clotures',
            label: (
              <Space size={6}>
                <CalendarOutlined />
                Clôtures journalières
                <Badge count={clotures.length} style={{ background: '#fa8c16' }} />
              </Space>
            ),
            children: (
              <>
                {peutGerer && (
                  <div style={{ marginBottom: 12, textAlign: 'right' }}>
                    <Button
                      type="primary" icon={<LockOutlined />}
                      disabled={jourDejaClôture}
                      style={{
                        background: jourDejaClôture ? undefined : '#fa8c16',
                        borderColor: jourDejaClôture ? undefined : '#fa8c16',
                        borderRadius: 8
                      }}
                      onClick={ouvrirModalCloture}
                    >
                      {jourDejaClôture
                        ? `Journée du ${dayjs().format('DD/MM')} clôturée`
                        : 'Fermer le comptoir aujourd\'hui'}
                    </Button>
                  </div>
                )}
                <Table
                  dataSource={clotures}
                  columns={columnsClotures}
                  rowKey="id"
                  scroll={{ x: 1000 }}
                  size="middle"
                  pagination={{
                    pageSize: 10,
                    showTotal: (t, r) => `${r[0]}-${r[1]} sur ${t} clôture(s)`
                  }}
                />
              </>
            )
          }
        ]}
      />

      {/* ✅ Modal Nouvelle/Modifier opération */}
      <Modal
        title={
          <Space>
            {editingOp
              ? <EditOutlined style={{ color: '#1890ff' }} />
              : <PlusOutlined style={{ color: '#52c41a' }} />}
            {editingOp ? "Modifier l'opération" : 'Nouvelle opération de trésorerie'}
          </Space>
        }
        open={modalOpVisible}
        onCancel={fermerModal}
        confirmLoading={loadingSave}
        onOk={() => formOp.submit()}
        okText={editingOp ? 'Modifier' : 'Enregistrer'}
        cancelText="Annuler"
        width={520}
      >
        <Form form={formOp} layout="vertical" onFinish={sauvegarder} style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="Type d'opération"
                rules={[{ required: true, message: 'Obligatoire' }]}>
                <Select placeholder="Choisir" size="large">
                  <Option value="entree">
                    <ArrowUpOutlined style={{ color: '#52c41a' }} /> Entrée (recette)
                  </Option>
                  <Option value="sortie">
                    <ArrowDownOutlined style={{ color: '#ff4d4f' }} /> Sortie (dépense)
                  </Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="categorie" label="Catégorie"
                rules={[{ required: true, message: 'Obligatoire' }]}>
                <Select placeholder="Catégorie" size="large">
                  {Object.entries(CATS).map(([k, v]) => (
                    <Option key={k} value={k}>{v.icon} {v.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Description">
            <Input
              placeholder="Ex : Vente comptoir, paiement fournisseur ABC..."
              size="large"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="montant" label="Montant (FCFA)"
                rules={[{ required: true, message: 'Obligatoire' }]}>
                <InputNumber
                  style={{ width: '100%' }} min={1} size="large"
                  formatter={v => `${(v || 0).toLocaleString('fr-FR')} FCFA`}
                  parser={v => parseInt((v || '').replace(/\D/g, ''), 10) || 0}
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="date_operation" label="Date"
                rules={[{ required: true, message: 'Obligatoire' }]}>
                <Input type="date" size="large" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ✅ Modal Clôture journée */}
      <Modal
        title={
          <Space>
            <LockOutlined style={{ color: '#fa8c16' }} />
            <span>Fermeture du comptoir — {dayjs().format('DD/MM/YYYY')}</span>
          </Space>
        }
        open={modalClotureVisible}
        onCancel={() => { if (!loadingCloture) { setModalClotureVisible(false); setNotesClot(''); setRapportCloture(null) } }}
        confirmLoading={loadingCloture}
        onOk={effectuerCloture}
        okText="Confirmer la clôture"
        okButtonProps={{ style: { background: '#fa8c16', borderColor: '#fa8c16' } }}
        cancelText="Annuler"
        width={820}
        bodyStyle={{ maxHeight: '75vh', overflowY: 'auto' }}
      >
        <Alert
          type="info" showIcon
          style={{ borderRadius: 10, marginBottom: 16 }}
          message="Toutes les opérations de la journée seront verrouillées et le CA du jour enregistré automatiquement."
        />

        {/* ═══ Rapport de clôture intelligent ═══ */}
        {loadingRapport && (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#8c8c8c' }}>
            Analyse de la journée en cours…
          </div>
        )}

        {!loadingRapport && rapportCloture && (
          <>
            {/* Recommandations — le résumé "intelligent", en premier */}
            <Card size="small" style={{
              marginBottom: 16, borderRadius: 10,
              background: rapportCloture.anomalies.some(a => a.gravite === 'haute') ? '#fff2f0'
                : rapportCloture.anomalies.length > 0 ? '#fffbe6' : '#f6ffed',
              border: `1px solid ${
                rapportCloture.anomalies.some(a => a.gravite === 'haute') ? '#ffa39e'
                  : rapportCloture.anomalies.length > 0 ? '#ffe58f' : '#b7eb8f'
              }`
            }}>
              <Text strong style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <BulbOutlined /> Résumé intelligent de la journée
              </Text>
              {rapportCloture.recommandations.map((r, i) => (
                <div key={i} style={{ fontSize: 12.5, marginBottom: 4, paddingLeft: 4 }}>• {r}</div>
              ))}
            </Card>

            {/* KPI ventes du jour */}
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center', borderRadius: 10 }}>
                  <Text style={{ color: '#8c8c8c', fontSize: 11, display: 'block' }}>Ventes</Text>
                  <Text strong style={{ fontSize: 18 }}>{rapportCloture.resume.nbVentes}</Text>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center', borderRadius: 10 }}>
                  <Text style={{ color: '#8c8c8c', fontSize: 11, display: 'block' }}>Panier moyen</Text>
                  <Text strong style={{ fontSize: 15 }}>{Math.round(rapportCloture.resume.panierMoyen).toLocaleString('fr-FR')} F</Text>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center', borderRadius: 10 }}>
                  <Text style={{ color: '#8c8c8c', fontSize: 11, display: 'block' }}>Clients servis</Text>
                  <Text strong style={{ fontSize: 18 }}>{rapportCloture.resume.clientsUniques}</Text>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center', borderRadius: 10, background: rapportCloture.dettes.total > 0 ? '#fff7e6' : undefined }}>
                  <Text style={{ color: '#8c8c8c', fontSize: 11, display: 'block' }}>Dû (crédit)</Text>
                  <Text strong style={{ fontSize: 15, color: rapportCloture.dettes.total > 0 ? '#fa8c16' : undefined }}>
                    {rapportCloture.dettes.total.toLocaleString('fr-FR')} F
                  </Text>
                </Card>
              </Col>
            </Row>

            {/* Anomalies détectées */}
            <Card size="small" style={{ marginBottom: 12, borderRadius: 10 }}
              title={
                <Space size={6}>
                  <WarningOutlined style={{ color: rapportCloture.anomalies.length ? '#fa8c16' : '#52c41a' }} />
                  <Text strong style={{ fontSize: 13 }}>Anomalies détectées ({rapportCloture.anomalies.length})</Text>
                </Space>
              }>
              {rapportCloture.anomalies.length === 0 ? (
                <Text style={{ color: '#52c41a', fontSize: 12.5 }}>✅ Aucune anomalie détectée sur les ventes du jour.</Text>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {rapportCloture.anomalies.map((a, i) => (
                    <div key={i} style={{
                      fontSize: 12, padding: '5px 8px', borderRadius: 6,
                      background: a.gravite === 'haute' ? '#fff2f0' : '#fffbe6',
                      color: a.gravite === 'haute' ? '#cf1322' : '#ad6800'
                    }}>
                      {a.message}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Clients du jour */}
            {rapportCloture.clients.length > 0 && (
              <Card size="small" style={{ marginBottom: 12, borderRadius: 10 }}
                title={<Space size={6}><TeamOutlined /><Text strong style={{ fontSize: 13 }}>Clients du jour ({rapportCloture.clients.length})</Text></Space>}>
                <Table
                  size="small" pagination={false}
                  dataSource={rapportCloture.clients.slice(0, 8)}
                  rowKey={(r, i) => r.client_id || i}
                  columns={[
                    { title: 'Client', dataIndex: 'nom' },
                    { title: 'Achats', dataIndex: 'nb', align: 'center', width: 70 },
                    { title: 'Total', dataIndex: 'total', align: 'right', width: 110,
                      render: v => `${v.toLocaleString('fr-FR')} F` },
                    { title: 'Dû', dataIndex: 'du', align: 'right', width: 100,
                      render: v => v > 0 ? <Text style={{ color: '#fa8c16' }}>{v.toLocaleString('fr-FR')} F</Text> : '—' }
                  ]}
                />
                {rapportCloture.clients.length > 8 && (
                  <Text style={{ fontSize: 11, color: '#8c8c8c' }}>+ {rapportCloture.clients.length - 8} autre(s) client(s)</Text>
                )}
              </Card>
            )}

            {/* Dettes / crédits en cours */}
            {rapportCloture.dettes.liste.length > 0 && (
              <Card size="small" style={{ marginBottom: 12, borderRadius: 10 }}
                title={<Text strong style={{ fontSize: 13 }}>Dettes créées aujourd'hui ({rapportCloture.dettes.liste.length})</Text>}>
                {rapportCloture.dettes.liste.map((d, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', fontSize: 12.5,
                    padding: '4px 0', borderBottom: i < rapportCloture.dettes.liste.length - 1 ? '1px solid #f0f0f0' : 'none'
                  }}>
                    <span>{d.numero} — {d.client_nom}{d.date_pret ? ` (échéance ${dayjs(d.date_pret).format('DD/MM/YYYY')})` : ''}</span>
                    <strong style={{ color: '#fa8c16' }}>{d.montant_du.toLocaleString('fr-FR')} F</strong>
                  </div>
                ))}
              </Card>
            )}

            <Divider style={{ margin: '12px 0' }} />
          </>
        )}

        {/* Résumé trésorerie du jour */}
        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col span={12}>
            <Card size="small" style={{
              background: '#f6ffed', border: '1px solid #b7eb8f',
              borderRadius: 10, textAlign: 'center'
            }}>
              <Text style={{ color: '#888', fontSize: 11, display: 'block' }}>Entrées du jour</Text>
              <Text strong style={{ color: '#52c41a', fontSize: 20 }}>
                +{resumeJourActuel.entrees.toLocaleString('fr-FR')} F
              </Text>
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" style={{
              background: '#fff2f0', border: '1px solid #ffa39e',
              borderRadius: 10, textAlign: 'center'
            }}>
              <Text style={{ color: '#888', fontSize: 11, display: 'block' }}>Sorties du jour</Text>
              <Text strong style={{ color: '#ff4d4f', fontSize: 20 }}>
                -{resumeJourActuel.sorties.toLocaleString('fr-FR')} F
              </Text>
            </Card>
          </Col>
        </Row>

        {/* CA ventes */}
        <Card size="small" style={{
          background: 'linear-gradient(135deg,#f0f5ff,#f9f0ff)',
          border: '1px solid #adc6ff', borderRadius: 10,
          marginBottom: 12, textAlign: 'center'
        }}>
          <Text style={{ color: '#888', fontSize: 11, display: 'block' }}>
            CA ventes du jour — {stats?.jour?.nbVentes || 0} vente(s)
          </Text>
          <Text strong style={{ color: '#1890ff', fontSize: 22 }}>
            {(stats?.jour?.caVentes || 0).toLocaleString('fr-FR')} FCFA
          </Text>
          {stats?.jour?.caVentesAvoir > 0 ? (
            <div style={{ marginTop: 4 }}>
              <Text style={{ color: '#52c41a', fontSize: 11, display: 'block' }}>
                Espèces/mobile : {(stats.jour.caVentesCash || 0).toLocaleString('fr-FR')} F
              </Text>
              <Text style={{ color: '#1565C0', fontSize: 11, display: 'block' }}>
                Comptes prépayés : {(stats.jour.caVentesAvoir || 0).toLocaleString('fr-FR')} F
                <span style={{ color: '#aaa' }}> (dépôt déjà en caisse)</span>
              </Text>
            </div>
          ) : (
            <Text style={{ color: '#aaa', fontSize: 11, display: 'block' }}>
              {stats?.jour?.ventesPaye > 0
                ? `Encaissé : +${(stats.jour.ventesPaye).toLocaleString('fr-FR')} F (inclus dans le solde)`
                : `Aucune vente aujourd'hui`}
            </Text>
          )}
        </Card>

        {/* Solde net */}
        {(() => {
          const net = resumeJourActuel.entrees + (stats?.jour?.ventesPaye || 0) - resumeJourActuel.sorties
          return (
            <Card size="small" style={{
              background: net >= 0 ? '#f6ffed' : '#fff2f0',
              border: `1px solid ${net >= 0 ? '#b7eb8f' : '#ffa39e'}`,
              borderRadius: 10, marginBottom: 16, textAlign: 'center'
            }}>
              <Text style={{ color: '#888', fontSize: 11, display: 'block' }}>Net caisse du jour (tréso + ventes encaissées)</Text>
              <Text strong style={{ color: net >= 0 ? '#52c41a' : '#ff4d4f', fontSize: 18 }}>
                {net >= 0 ? '+' : ''}{net.toLocaleString('fr-FR')} F
              </Text>
            </Card>
          )
        })()}

        <div>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>
            Notes de clôture (optionnel)
          </Text>
          <Input.TextArea
            rows={2}
            placeholder="Ex : Journée normale, incident de caisse, anomalie..."
            value={notesClot}
            onChange={e => setNotesClot(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  )
}

export default Comptabilite
