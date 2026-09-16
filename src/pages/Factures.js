import React, { useState, useEffect, useMemo } from 'react'
import {
  Typography, Table, Button, Modal, Tag,
  Card, Space, message, Input, Select, Divider,
  Row, Col, DatePicker, Form, InputNumber,
  Badge, Alert, Dropdown, Tooltip
} from 'antd'
import {
  PrinterOutlined, EyeOutlined, EditOutlined,
  DeleteOutlined, LockOutlined, SearchOutlined,
  ClearOutlined, FileTextOutlined, CheckCircleOutlined,
  WarningOutlined, CreditCardOutlined, RiseOutlined,
  DownloadOutlined, RollbackOutlined, MoreOutlined
} from '@ant-design/icons'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import FactureSelector, { getFormatFacture } from '../components/FactureSelector'
import FiltresPeriode from '../components/FiltresPeriode'
import { peutFaireSurFacture } from '../utils/permissions'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Search } = Input
const { Option } = Select
const { RangePicker } = DatePicker
const ipcRenderer = window.ipcRenderer

function Factures({ utilisateur }) {
  const role = utilisateur?.role || 'caissier'
  const [ventes, setVentes] = useState([])
  const [ventesFiltres, setVentesFiltres] = useState([])
  const [factureVisible, setFactureVisible] = useState(false)
  const [factureSelectionnee, setFactureSelectionnee] = useState(null)
  const [parametres, setParametres] = useState({})
  const [impression, setImpression] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [filtrePaiement, setFiltrePaiement] = useState(null)
  const [filtreDates, setFiltreDates] = useState(null)
  const [filtrePeriode, setFiltrePeriode] = useState(null)
  const [filtrePaiementStatut, setFiltrePaiementStatut] = useState(null)
  const [modalModifierVisible, setModalModifierVisible] = useState(false)
  const [factureEnModification, setFactureEnModification] = useState(null)
  const [formModifier] = Form.useForm()
  const [filtreClient, setFiltreClient] = useState(null)
  const [clients, setClients] = useState([])
  const [filtresMontant, setFiltresMontant] = useState({ min: 0, max: 0 })
  const [modalRetourVisible, setModalRetourVisible] = useState(false)
  const [venteRetour, setVenteRetour] = useState(null)
  const [panierRetourQtes, setPanierRetourQtes] = useState({})
  const [raisonRetour, setRaisonRetour] = useState('')
  const [modeRemboursement, setModeRemboursement] = useState('especes')
  const [retourLoading, setRetourLoading] = useState(false)
  const [domaineActive, setDomaineActive] = useState(null)
  const [modalRembours, setModalRembours] = useState(false)
  const [facturePret, setFacturePret] = useState(null)
  const [montantRembours, setMontantRembours] = useState(0)
  const [modeRembours, setModeRembours] = useState('especes')
  const [loadingRembours, setLoadingRembours] = useState(false)
  const [retoursEnAttente, setRetoursEnAttente] = useState([])
  const [loadingApprob, setLoadingApprob] = useState({})

  const chargerVentes = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('ventes:getAll')
    setVentes(data)
    setVentesFiltres(data)
  }

  const chargerParametres = async () => {
    if (!ipcRenderer) return
    setParametres(await ipcRenderer.invoke('parametres:get') || {})
  }

  const chargerClients = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('clients:getAll')
    setClients(data || [])
  }

  const chargerDomaine = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('domaine:get')
    if (data?.type) setDomaineActive(data.type)
  }

  const chargerRetoursEnAttente = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('retours:getPendants')
    setRetoursEnAttente(Array.isArray(data) ? data : [])
  }

  const approuverRetour = async (retourId) => {
    setLoadingApprob(prev => ({ ...prev, [retourId]: 'approuver' }))
    const res = await ipcRenderer.invoke('retours:approuver', retourId, utilisateur?.username || role)
    setLoadingApprob(prev => { const n = { ...prev }; delete n[retourId]; return n })
    if (res?.erreur) { message.error(`Erreur : ${res.erreur}`); return }
    message.success('Retour approuvé — stock, CA et trésorerie mis à jour')
    chargerRetoursEnAttente()
    chargerVentes()
  }

  const rejeterRetour = async (retourId) => {
    setLoadingApprob(prev => ({ ...prev, [retourId]: 'rejeter' }))
    const res = await ipcRenderer.invoke('retours:rejeter', retourId, utilisateur?.username || role)
    setLoadingApprob(prev => { const n = { ...prev }; delete n[retourId]; return n })
    if (res?.erreur) { message.error(`Erreur : ${res.erreur}`); return }
    message.success('Retour rejeté')
    chargerRetoursEnAttente()
  }

  const exporterCSV = () => {
    if (ventesFiltres.length === 0) {
      message.warning('Aucune facture à exporter')
      return
    }

    const headers = ['N° Facture', 'Client', 'Montant TTC', 'Payé', 'Reste Dû', 'Statut', 'Mode Paiement', 'Date']
    const data = ventesFiltres.map(f => [
      `F-${String(f.id).padStart(4, '0')}`,
      f.client_nom || 'Anonyme',
      f.montant_total,
      f.montant_paye || 0,
      f.montant_du || 0,
      f.est_pret ? 'Crédit' : f.montant_du > 0 ? 'Partiel' : 'Payée',
      f.mode_paiement,
      new Date(f.created_at).toLocaleDateString('fr-FR')
    ])

    const csv = [headers, ...data].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `factures_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    message.success('✅ Fichier exporté')
  }

  useEffect(() => {
    chargerVentes()
    chargerParametres()
    chargerClients()
    chargerDomaine()
    chargerRetoursEnAttente()
  }, [])

  useEffect(() => {
    let resultat = [...ventes]

    if (recherche) {
      const terme = recherche.toLowerCase()
      resultat = resultat.filter(v =>
        v.client_nom?.toLowerCase().includes(terme) ||
        String(v.id).includes(terme)
      )
    }

    if (filtrePaiement) {
      resultat = resultat.filter(v => v.mode_paiement === filtrePaiement)
    }

    if (filtreClient) {
      resultat = resultat.filter(v => v.client_id === filtreClient)
    }

    if (filtrePaiementStatut) {
      resultat = resultat.filter(v => {
        if (filtrePaiementStatut === 'credit') return v.est_pret === 1
        if (filtrePaiementStatut === 'partiel') return v.montant_du > 0 && v.est_pret === 0
        if (filtrePaiementStatut === 'complet') return v.montant_du === 0 && v.est_pret === 0
        return true
      })
    }

    // Filtre par montant
    if (filtresMontant.max > 0) {
      resultat = resultat.filter(v => 
        v.montant_total >= filtresMontant.min && 
        v.montant_total <= filtresMontant.max
      )
    }

    if (filtrePeriode?.[0] && filtrePeriode?.[1]) {
      const debut = filtrePeriode[0].startOf('day')
      const fin = filtrePeriode[1].endOf('day')
      resultat = resultat.filter(v => {
        const date = dayjs(v.created_at)
        return date.isAfter(debut) && date.isBefore(fin)
      })
    }

    if (filtreDates?.[0] && filtreDates?.[1]) {
      const debut = filtreDates[0].startOf('day')
      const fin = filtreDates[1].endOf('day')
      resultat = resultat.filter(v => {
        const date = dayjs(v.created_at)
        return date.isAfter(debut) && date.isBefore(fin)
      })
    }

    setVentesFiltres(resultat)
  }, [recherche, filtrePaiement, filtreDates, filtrePeriode, filtrePaiementStatut, filtreClient, filtresMontant, ventes])

  const reinitialiserFiltres = () => {
    setRecherche('')
    setFiltrePaiement(null)
    setFiltreDates(null)
    setFiltrePeriode(null)
    setFiltrePaiementStatut(null)
    setFiltreClient(null)
    setFiltresMontant({ min: 0, max: 0 })
  }

  // ✅ Stats calculées
  const statsFactures = useMemo(() => ({
    total: ventesFiltres.length,
    ca: ventesFiltres.reduce((acc, v) => acc + (v.montant_total || 0), 0),
    payees: ventesFiltres.filter(v => v.montant_du === 0 && !v.est_pret).length,
    credits: ventesFiltres.filter(v => v.est_pret).length,
    partielles: ventesFiltres.filter(v => v.montant_du > 0 && !v.est_pret).length,
    totalDu: ventesFiltres.reduce((acc, v) => acc + (v.montant_du || 0), 0)
  }), [ventesFiltres])

  const champsFactureManquants = useMemo(() => {
    const champs = []
    if (!parametres?.registre_commerce?.trim()) champs.push('Registre de Commerce')
    if (!parametres?.ninea?.trim()) champs.push('NINEA')
    if (!parametres?.telephone?.trim()) champs.push('Téléphone 1')
    if (!parametres?.telephone_secondaire?.trim()) champs.push('Téléphone 2')
    return champs
  }, [parametres])

  const verifierConformiteFacture = () => {
    if (champsFactureManquants.length === 0) return true
    message.error(
      `Configuration incomplète pour la facture: ${champsFactureManquants.join(', ')}. ` +
      'Veuillez compléter ces champs dans Paramètres > Entreprise.'
    )
    return false
  }

  const voirFacture = (vente) => {
    if (!verifierConformiteFacture()) return
    setFactureSelectionnee(vente)
    setFactureVisible(true)
  }

  // Envoie directement la facture à l'imprimante physique (boîte de dialogue
  // native), sans passer par un fichier PDF à ouvrir/imprimer manuellement.
  const imprimerFactureDirectement = async () => {
    if (!verifierConformiteFacture()) return
    setImpression(true)
    try {
      const element = document.getElementById('facture-pdf')
      if (!element) throw new Error('Apercu facture non disponible')
      const resultat = await ipcRenderer.invoke('impression:imprimerHTML', {
        html: element.outerHTML,
        numero: `F-${String(factureSelectionnee.id).padStart(4, '0')}`,
        client: factureSelectionnee.client_nom || 'Client de passage',
        montant: factureSelectionnee.montant_total,
        utilisateur: utilisateur?.username || utilisateur?.nom
      })
      if (resultat?.erreur) {
        message.error(`Erreur d'impression : ${resultat.erreur}`)
      } else if (resultat?.succes) {
        message.success('✅ Facture envoyée à l\'imprimante')
      }
    } catch (error) {
      message.error("Erreur lors de l'impression")
    }
    setImpression(false)
  }

  const imprimerPDF = async () => {
    if (!verifierConformiteFacture()) return
    setImpression(true)
    try {
      const element = document.getElementById('facture-pdf')
      const canvas = await html2canvas(element, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff'
      })
      const imgData = canvas.toDataURL('image/png')
      const formatDoc = getFormatFacture(domaineActive, parametres?.format_facture)
      const isTicket = formatDoc === 'ticket'
      const isA5 = formatDoc === 'a5'
      const pdfWidth = isTicket ? 80 : isA5 ? 148 : 210
      const pdfHeightAuto = (canvas.height * pdfWidth) / canvas.width
      const pdf = isTicket
        ? new jsPDF('p', 'mm', [pdfWidth, pdfHeightAuto])
        : new jsPDF('p', 'mm', isA5 ? 'a5' : 'a4')
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, isTicket ? pdfHeightAuto : (isA5 ? 210 : 297))
      const prefix = isTicket ? 'T' : 'F'
      const numero = `${prefix}-${String(factureSelectionnee.id).padStart(4, '0')}`
      pdf.save(`${isTicket ? 'Ticket' : 'Facture'}-${numero}.pdf`)
      message.success('✅ PDF téléchargé !')
    } catch (error) {
      message.error('Erreur PDF')
    }
    setImpression(false)
  }

  const ouvrirModification = (facture) => {
    if (!peutFaireSurFacture(role, 'modifier')) {
      message.error('❌ Permission refusée')
      return
    }
    setFactureEnModification(facture)
    formModifier.setFieldsValue({
      montant_paye: facture.montant_paye || 0,
      montant_du: facture.montant_du || 0
    })
    setModalModifierVisible(true)
  }

  const validerModification = async (values) => {
    try {
      await ipcRenderer.invoke('factures:update', {
        id: factureEnModification.id,
        montant_paye: values.montant_paye || 0,
        montant_du: values.montant_du || 0
      })
      message.success('✅ Facture mise à jour !')
      setModalModifierVisible(false)
      chargerVentes()
    } catch (error) {
      message.error(`❌ Erreur: ${error.message}`)
    }
  }

  const ouvrirRemboursement = (facture) => {
    setFacturePret(facture)
    setMontantRembours(facture.montant_du || 0)
    setModeRembours('especes')
    setModalRembours(true)
  }

  const validerRemboursement = async () => {
    if (!facturePret || montantRembours <= 0) {
      message.warning('Saisissez un montant valide')
      return
    }
    if (montantRembours > facturePret.montant_du) {
      message.error('Le montant dépasse la dette restante')
      return
    }
    setLoadingRembours(true)
    try {
      const newMontantPaye = (facturePret.montant_paye || 0) + montantRembours
      const newMontantDu = Math.max(0, (facturePret.montant_du || 0) - montantRembours)
      const newEstPret = newMontantDu <= 0 ? 0 : 1

      await ipcRenderer.invoke('factures:update', {
        id: facturePret.id,
        montant_paye: newMontantPaye,
        montant_du: newMontantDu,
        est_pret: newEstPret
      })

      const modeLabel = { especes: 'Espèces', wave: 'Wave', orange_money: 'Orange Money', cheque: 'Chèque' }
      await ipcRenderer.invoke('tresorerie:create', {
        type: 'entree',
        categorie: 'vente',
        description: `Remboursement crédit F-${String(facturePret.id).padStart(4, '0')} — ${facturePret.client_nom || 'Client'} (${modeLabel[modeRembours] || modeRembours})`,
        montant: montantRembours,
        date_operation: new Date().toISOString().slice(0, 10)
      })

      message.success(newMontantDu <= 0
        ? '✅ Crédit soldé intégralement !'
        : `✅ Remboursement enregistré — reste dû : ${newMontantDu.toLocaleString('fr-FR')} FCFA`)
      setModalRembours(false)
      chargerVentes()
    } catch (err) {
      message.error(`❌ Erreur : ${err.message}`)
    } finally {
      setLoadingRembours(false)
    }
  }

  const supprimerFacture = async (id) => {
    if (!peutFaireSurFacture(role, 'supprimer')) {
      message.error('❌ Permission refusée')
      return
    }
    try {
      await ipcRenderer.invoke('factures:delete', id)
      message.success('✅ Facture supprimée')
      chargerVentes()
    } catch (error) {
      message.error(`❌ Erreur: ${error.message}`)
    }
  }

  const ouvrirRetour = (vente) => {
    const panier = JSON.parse(vente.panier || '[]')
    const qtes = {}
    panier.forEach(item => { qtes[item.produit_id] = 0 })
    setPanierRetourQtes(qtes)
    setRaisonRetour('')
    setModeRemboursement('especes')
    setVenteRetour(vente)
    setModalRetourVisible(true)
  }

  const montantRetourCalcule = () => {
    if (!venteRetour) return 0
    const panier = JSON.parse(venteRetour.panier || '[]')
    return panier.reduce((total, item) => {
      const qteRetour = panierRetourQtes[item.produit_id] || 0
      return total + qteRetour * item.prix_unitaire
    }, 0)
  }

  const validerRetour = async () => {
    if (!ipcRenderer || !venteRetour) return
    const panier = JSON.parse(venteRetour.panier || '[]')
    const panierRetourne = panier
      .filter(item => (panierRetourQtes[item.produit_id] || 0) > 0)
      .map(item => ({ ...item, quantite: panierRetourQtes[item.produit_id] }))

    if (panierRetourne.length === 0) {
      message.warning('Sélectionnez au moins un article à retourner')
      return
    }
    setRetourLoading(true)
    const result = await ipcRenderer.invoke('retours:create', {
      vente_id: venteRetour.id,
      panier_retour: JSON.stringify(panierRetourne),
      montant_retour: montantRetourCalcule(),
      raison: raisonRetour,
      mode_remboursement: modeRemboursement
    })
    setRetourLoading(false)
    if (result?.erreur) {
      message.error(`❌ ${result.erreur}`)
      return
    }
    message.success('✅ Retour soumis — en attente d\'approbation par un responsable')
    setModalRetourVisible(false)
    chargerRetoursEnAttente()
  }

  const columns = [
    {
      title: 'N° Facture',
      dataIndex: 'id',
      key: 'id',
      width: 110,
      render: (id) => (
        <Tag style={{
          background: '#e6f7ff', border: '1px solid #91d5ff',
          color: '#1890ff', borderRadius: 6, fontWeight: 'bold',
          whiteSpace: 'nowrap'
        }}>
          F-{String(id).padStart(4, '0')}
        </Tag>
      )
    },
    {
      title: 'Client',
      dataIndex: 'client_nom',
      key: 'client_nom',
      width: 160,
      ellipsis: true,
      render: (val) => (
        <Tooltip title={val || 'Client anonyme'} placement="topLeft">
          <Space wrap={false} style={{ flexWrap: 'nowrap', overflow: 'hidden' }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #1890ff, #722ed1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 11, fontWeight: 'bold'
            }}>
              {val ? val[0].toUpperCase() : 'A'}
            </div>
            <Text ellipsis style={{ maxWidth: 110 }}>{val || 'Client anonyme'}</Text>
          </Space>
        </Tooltip>
      )
    },
    {
      title: 'Montant TTC',
      dataIndex: 'montant_total',
      key: 'montant_total',
      width: 130,
      align: 'right',
      render: (val) => (
        <Text strong style={{ color: '#1890ff', fontSize: 13, whiteSpace: 'nowrap' }}>
          {(val || 0).toLocaleString('fr-FR')} F
        </Text>
      )
    },
    {
      title: 'Payé',
      dataIndex: 'montant_paye',
      key: 'montant_paye',
      width: 120,
      align: 'right',
      render: (val) => (
        <Text strong style={{ color: '#52c41a', whiteSpace: 'nowrap' }}>
          {(val || 0).toLocaleString('fr-FR')} F
        </Text>
      )
    },
    {
      title: 'Reste dû',
      dataIndex: 'montant_du',
      key: 'montant_du',
      width: 115,
      align: 'right',
      render: (val) => (
        <Text strong style={{ color: val > 0 ? '#ff4d4f' : '#52c41a', whiteSpace: 'nowrap' }}>
          {(val || 0).toLocaleString('fr-FR')} F
        </Text>
      )
    },
    {
      title: 'Statut',
      key: 'statut_paiement',
      width: 105,
      align: 'center',
      render: (_, record) => {
        if (record.est_pret) {
          return <Tag color="orange" style={{ borderRadius: 12, margin: 0 }}>📋 Crédit</Tag>
        } else if (record.montant_du > 0) {
          return <Tag color="red" style={{ borderRadius: 12, margin: 0 }}>⚠️ Partiel</Tag>
        }
        return <Tag color="green" style={{ borderRadius: 12, margin: 0 }}>✅ Payée</Tag>
      }
    },
    {
      title: 'Mode',
      dataIndex: 'mode_paiement',
      key: 'mode_paiement',
      width: 115,
      align: 'center',
      render: (val) => {
        const cfg = {
          especes:      { color: 'green',   label: 'Espèces' },
          wave:         { color: 'blue',    label: 'Wave' },
          orange_money: { color: 'orange',  label: 'Orange M.' },
          cheque:       { color: 'purple',  label: 'Chèque' },
          avoir:        { color: 'cyan',    label: 'Prépayé' },
          pret:         { color: 'volcano', label: 'Crédit' },
        }
        const c = cfg[val] || { color: 'default', label: val }
        return <Tag color={c.color} style={{ borderRadius: 12, margin: 0 }}>{c.label}</Tag>
      }
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 95,
      render: (val) => (
        <Text style={{ color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>
          {new Date(val).toLocaleDateString('fr-FR')}
        </Text>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 130,
      render: (_, record) => {
        const peutModifier = peutFaireSurFacture(role, 'modifier')
        const peutSupprimer = peutFaireSurFacture(role, 'supprimer')

        if (!peutModifier && !peutSupprimer) {
          return (
            <Button type="text" size="small" icon={<LockOutlined />}
              style={{ color: '#999' }} disabled>
              Verrouillé
            </Button>
          )
        }

        const menuItems = [
          {
            key: 'imprimer',
            icon: <PrinterOutlined />,
            label: 'Imprimer',
            onClick: () => { voirFacture(record); setTimeout(() => imprimerFactureDirectement(), 500) }
          },
          {
            key: 'pdf',
            icon: <FileTextOutlined />,
            label: 'Télécharger PDF',
            onClick: () => { voirFacture(record); setTimeout(() => imprimerPDF(), 500) }
          },
          peutModifier && {
            key: 'modifier',
            icon: <EditOutlined />,
            label: 'Modifier paiement',
            onClick: () => ouvrirModification(record)
          },
          peutModifier && (record.est_pret === 1 || record.montant_du > 0) && {
            key: 'rembourser',
            icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
            label: <span style={{ color: '#52c41a', fontWeight: 600 }}>Rembourser</span>,
            onClick: () => ouvrirRemboursement(record)
          },
          peutModifier && {
            key: 'retour',
            icon: <RollbackOutlined style={{ color: '#fa8c16' }} />,
            label: <span style={{ color: '#fa8c16' }}>Retour marchandise</span>,
            onClick: () => ouvrirRetour(record)
          },
          peutSupprimer && { type: 'divider' },
          peutSupprimer && {
            key: 'supprimer',
            icon: <DeleteOutlined />,
            label: <span style={{ color: '#ff4d4f' }}>Supprimer</span>,
            danger: true,
            onClick: () => {
              Modal.confirm({
                title: 'Supprimer cette facture ?',
                content: `Montant : ${record.montant_total?.toLocaleString('fr-FR')} FCFA`,
                okText: 'Supprimer', okButtonProps: { danger: true },
                cancelText: 'Annuler',
                onOk: () => supprimerFacture(record.id)
              })
            }
          }
        ].filter(Boolean)

        return (
          <Space size={4}>
            <Button type="primary" icon={<EyeOutlined />} size="small"
              style={{ borderRadius: 6 }}
              onClick={() => voirFacture(record)}>
              Voir
            </Button>
            <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
              <Button size="small" icon={<MoreOutlined />} style={{ borderRadius: 6 }} />
            </Dropdown>
          </Space>
        )
      }
    }
  ]

  return (
    <div>
      {/* ✅ En-tête */}
      <div style={{
        background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
        borderRadius: 16, padding: '20px 28px', marginBottom: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <Title level={2} style={{ color: 'white', margin: 0 }}>
            🧾 Gestion des Factures
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
            Suivi complet de vos transactions et paiements
          </Text>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'white', fontSize: 22, fontWeight: 'bold' }}>
            {statsFactures.ca.toLocaleString()} FCFA
          </div>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
            CA total affiché
          </Text>
        </div>
      </div>

      {/* ✅ Cartes stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          {
            titre: 'Total Factures',
            valeur: statsFactures.total,
            icone: <FileTextOutlined />,
            couleur: '#1890ff', bg: '#e6f7ff'
          },
          {
            titre: 'Factures Payées',
            valeur: statsFactures.payees,
            icone: <CheckCircleOutlined />,
            couleur: '#52c41a', bg: '#f6ffed'
          },
          {
            titre: 'Crédits en cours',
            valeur: statsFactures.credits,
            icone: <CreditCardOutlined />,
            couleur: '#faad14', bg: '#fffbe6'
          },
          {
            titre: 'Paiements partiels',
            valeur: statsFactures.partielles,
            icone: <WarningOutlined />,
            couleur: '#ff7a45', bg: '#fff2e8'
          },
          {
            titre: 'Montant Dû Total',
            valeur: statsFactures.totalDu,
            suffix: 'FCFA',
            icone: <RiseOutlined />,
            couleur: '#ff4d4f', bg: '#fff2f0'
          }
        ].map((s, i) => (
          <Col xs={24} sm={12} md={i === 4 ? 8 : 4} key={i}>
            <Card style={{ borderRadius: 12, border: 'none', background: s.bg }}
              bodyStyle={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 22, color: s.couleur }}>{s.icone}</div>
                <div>
                  <Text style={{ color: '#888', fontSize: 11, display: 'block' }}>{s.titre}</Text>
                  <Text strong style={{ color: s.couleur, fontSize: 16 }}>
                    {(s.valeur || 0).toLocaleString()}
                    {s.suffix && <span style={{ fontSize: 11 }}> {s.suffix}</span>}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ✅ Filtres */}
      <Card style={{ marginBottom: 16, borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Row gutter={[16, 12]} align="middle">
          <Col xs={24} sm={12} md={5}>
            <Search
              placeholder="Rechercher par client ou N°..."
              allowClear
              prefix={<SearchOutlined style={{ color: '#1890ff' }} />}
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              size="large"
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Select placeholder="Client" allowClear
              style={{ width: '100%' }} size="large"
              value={filtreClient} onChange={setFiltreClient}>
              {clients.map(c => (
                <Option key={c.id} value={c.id}>{c.nom}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={8} md={3}>
            <Select placeholder="Mode paiement" allowClear
              style={{ width: '100%' }} size="large"
              value={filtrePaiement} onChange={setFiltrePaiement}>
              <Option value="especes">💵 Espèces</Option>
              <Option value="wave">🌊 Wave</Option>
              <Option value="orange_money">🟠 Orange Money</Option>
              <Option value="cheque">📝 Chèque</Option>
              <Option value="avoir">🏦 Compte prépayé</Option>
            </Select>
          </Col>
          <Col xs={12} sm={8} md={3}>
            <Select placeholder="Statut paiement" allowClear
              style={{ width: '100%' }} size="large"
              value={filtrePaiementStatut} onChange={setFiltrePaiementStatut}>
              <Option value="complet">✅ Payée</Option>
              <Option value="partiel">⚠️ Partiel</Option>
              <Option value="credit">📋 Crédit</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <RangePicker style={{ width: '100%' }} size="large"
              value={filtreDates} onChange={setFiltreDates}
              format="DD/MM/YYYY" placeholder={['Date début', 'Date fin']} />
          </Col>
          <Col xs={24} sm={12} md={5} style={{ display: 'flex', gap: 8 }}>
            <Button icon={<DownloadOutlined />} size="large"
              onClick={exporterCSV} style={{ flex: 1, borderRadius: 8 }}>
              Exporter
            </Button>
            <Button icon={<ClearOutlined />} size="large"
              onClick={reinitialiserFiltres} style={{ flex: 1, borderRadius: 8 }}>
              Reset
            </Button>
            <div style={{
              background: '#f0f5ff', padding: '8px 12px',
              borderRadius: 8, textAlign: 'center', minWidth: 60
            }}>
              <Text style={{ color: '#1890ff', fontWeight: 'bold', display: 'block' }}>
                {ventesFiltres.length}
              </Text>
              <Text style={{ color: '#888', fontSize: 10 }}>/ {ventes.length}</Text>
            </div>
          </Col>
        </Row>

        <Divider style={{ margin: '12px 0' }} />
        <FiltresPeriode onFiltreChange={setFiltrePeriode} />
      </Card>

      {/* ✅ Retours en attente — visible uniquement pour admin/gérant */}
      {peutFaireSurFacture(role, 'modifier') && retoursEnAttente.length > 0 && (
        <Card
          title={
            <Space>
              <RollbackOutlined style={{ color: '#fa8c16' }} />
              <span style={{ color: '#fa8c16', fontWeight: 700 }}>Retours en attente d'approbation</span>
              <Badge count={retoursEnAttente.length} style={{ background: '#fa8c16' }} />
            </Space>
          }
          style={{
            borderRadius: 12, marginBottom: 16,
            border: '1.5px solid #ffd591',
            boxShadow: '0 2px 12px rgba(250,140,22,0.10)',
            background: '#fffbe6'
          }}
          bodyStyle={{ padding: '8px 16px' }}
        >
          <Table
            dataSource={retoursEnAttente}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
            columns={[
              {
                title: 'N° Facture', dataIndex: 'vente_id', width: 100,
                render: id => <Tag color="orange">F-{String(id).padStart(4,'0')}</Tag>
              },
              {
                title: 'Client', dataIndex: 'client_nom', ellipsis: true,
                render: v => v || 'Anonyme'
              },
              {
                title: 'Montant', dataIndex: 'montant_retour', width: 130, align: 'right',
                render: v => <Text strong style={{ color: '#fa8c16' }}>{(v||0).toLocaleString('fr-FR')} F</Text>
              },
              {
                title: 'Raison', dataIndex: 'raison', ellipsis: true,
                render: v => v || <Text type="secondary">Non précisée</Text>
              },
              {
                title: 'Mode remboursement', dataIndex: 'mode_remboursement', width: 140,
                render: v => {
                  const cfg = { especes: 'Espèces', wave: 'Wave', orange_money: 'Orange Money', avoir: 'Avoir', cheque: 'Chèque' }
                  return cfg[v] || v
                }
              },
              {
                title: 'Soumis le', dataIndex: 'created_at', width: 100,
                render: v => <Text style={{ fontSize: 12, color: '#888' }}>{new Date(v).toLocaleDateString('fr-FR')}</Text>
              },
              {
                title: 'Actions', key: 'actions', fixed: 'right', width: 180,
                render: (_, r) => (
                  <Space size={6}>
                    <Button
                      type="primary" size="small" icon={<CheckCircleOutlined />}
                      loading={loadingApprob[r.id] === 'approuver'}
                      disabled={!!loadingApprob[r.id]}
                      style={{ background: '#52c41a', borderColor: '#52c41a', borderRadius: 6 }}
                      onClick={() => Modal.confirm({
                        title: 'Approuver ce retour ?',
                        content: `Montant : ${(r.montant_retour||0).toLocaleString('fr-FR')} FCFA — le stock, la trésorerie et le CA seront mis à jour.`,
                        okText: 'Approuver', okButtonProps: { style: { background: '#52c41a', borderColor: '#52c41a' } },
                        cancelText: 'Annuler',
                        onOk: () => approuverRetour(r.id)
                      })}
                    >
                      Approuver
                    </Button>
                    <Button
                      danger size="small" icon={<DeleteOutlined />}
                      loading={loadingApprob[r.id] === 'rejeter'}
                      disabled={!!loadingApprob[r.id]}
                      style={{ borderRadius: 6 }}
                      onClick={() => Modal.confirm({
                        title: 'Rejeter ce retour ?',
                        content: 'Le retour sera annulé. Aucun impact sur le stock ou le CA.',
                        okText: 'Rejeter', okButtonProps: { danger: true },
                        cancelText: 'Annuler',
                        onOk: () => rejeterRetour(r.id)
                      })}
                    >
                      Rejeter
                    </Button>
                  </Space>
                )
              }
            ]}
          />
        </Card>
      )}

      {/* ✅ Tableau */}
      <Card
        title={
          <Space>
            <FileTextOutlined style={{ color: '#1890ff' }} />
            <span>Liste des Factures</span>
            <Badge count={ventesFiltres.length} style={{ background: '#1890ff' }} />
          </Space>
        }
        style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
      >
        <Table
          dataSource={ventesFiltres}
          columns={columns}
          rowKey="id"
          scroll={{ x: 1050 }}
          size="middle"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} sur ${total} facture(s)`
          }}
          rowClassName={(record) =>
            record.est_pret === 1 ? 'row-credit' :
            record.montant_du > 0 ? 'row-partiel' : ''
          }
        />
      </Card>

      {/* ✅ Modal Apercu */}
      <Modal
        title={
          <Space>
            <div style={{
              background: 'linear-gradient(135deg, #1890ff, #722ed1)',
              borderRadius: 6, padding: '4px 8px', color: 'white', fontSize: 12
            }}>
              🧾
            </div>
            <span>Aperçu Facture</span>
            {factureSelectionnee && (
              <Tag color="blue">
                F-{String(factureSelectionnee.id).padStart(4, '0')}
              </Tag>
            )}
          </Space>
        }
        open={factureVisible}
        onCancel={() => setFactureVisible(false)}
        width={920}
        footer={[
          <Button key="fermer" onClick={() => setFactureVisible(false)}>
            Fermer
          </Button>,
          <Button key="pdf" icon={<FileTextOutlined />}
            loading={impression} onClick={imprimerPDF}>
            Télécharger PDF
          </Button>,
          <Button key="imprimer" type="primary" icon={<PrinterOutlined />}
            loading={impression} onClick={imprimerFactureDirectement}
            style={{
              background: 'linear-gradient(135deg, #1890ff, #722ed1)',
              border: 'none'
            }}>
            Imprimer
          </Button>
        ]}
      >
        {factureSelectionnee && (
          <FactureSelector facture={factureSelectionnee} parametres={parametres} domaine={domaineActive} formatManuel={parametres?.format_facture} />
        )}
      </Modal>

      {/* ✅ Modal Modifier */}
      <Modal
        title={
          <Space>
            <EditOutlined style={{ color: '#1890ff' }} />
            <span>Modifier Paiement</span>
            {factureEnModification && (
              <Tag color="blue">
                F-{String(factureEnModification.id).padStart(4, '0')}
              </Tag>
            )}
          </Space>
        }
        open={modalModifierVisible}
        onCancel={() => setModalModifierVisible(false)}
        width={480}
        footer={[
          <Button key="annuler" onClick={() => setModalModifierVisible(false)}>
            Annuler
          </Button>,
          <Button key="enregistrer" type="primary"
            onClick={() => formModifier.submit()}
            style={{ background: 'linear-gradient(135deg, #1890ff, #722ed1)', border: 'none' }}>
            Enregistrer
          </Button>
        ]}
      >
        {factureEnModification && (
          <Form form={formModifier} layout="vertical" onFinish={validerModification}>
            {/* Résumé facture */}
            <Card size="small" style={{
              background: 'linear-gradient(135deg, #f0f5ff, #f9f0ff)',
              border: '1px solid #d6e4ff', borderRadius: 10, marginBottom: 16
            }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Text style={{ color: '#888', fontSize: 11 }}>Facture</Text>
                  <div style={{ fontWeight: 'bold', color: '#1890ff' }}>
                    F-{String(factureEnModification.id).padStart(4, '0')}
                  </div>
                </Col>
                <Col span={8}>
                  <Text style={{ color: '#888', fontSize: 11 }}>Client</Text>
                  <div style={{ fontWeight: 'bold' }}>
                    {factureEnModification.client_nom || 'Anonyme'}
                  </div>
                </Col>
                <Col span={8}>
                  <Text style={{ color: '#888', fontSize: 11 }}>Total TTC</Text>
                  <div style={{ fontWeight: 'bold', color: '#52c41a' }}>
                    {factureEnModification.montant_total?.toLocaleString()} FCFA
                  </div>
                </Col>
              </Row>
            </Card>

            <Form.Item label="💵 Montant Payé (FCFA)" name="montant_paye"
              rules={[
                { required: true, message: 'Obligatoire' },
                {
                  validator: (_, value) => value > factureEnModification.montant_total
                    ? Promise.reject('Ne peut pas dépasser le total')
                    : Promise.resolve()
                }
              ]}>
              <InputNumber min={0} style={{ width: '100%', fontSize: 15 }}
                size="large" placeholder="0" precision={0}
                formatter={(val) => `${val?.toLocaleString()} FCFA`}
                parser={(str) => parseInt(str.replace(/\D/g, ''), 10) || 0} />
            </Form.Item>

            <Form.Item label="❗ Montant Dû (FCFA)" name="montant_du"
              rules={[{ required: true, message: 'Obligatoire' }]}>
              <InputNumber min={0} style={{ width: '100%', fontSize: 15 }}
                size="large" placeholder="0" precision={0}
                formatter={(val) => `${val?.toLocaleString()} FCFA`}
                parser={(str) => parseInt(str.replace(/\D/g, ''), 10) || 0} />
            </Form.Item>

            <Card size="small" style={{
              background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 8
            }}>
              <Text style={{ color: '#d48806', fontSize: 12 }}>
                💡 Montant Payé + Montant Dû = Total TTC
                ({factureEnModification.montant_total?.toLocaleString()} FCFA)
              </Text>
            </Card>
          </Form>
        )}
      </Modal>
      {/* ✅ Modal Retour */}
      <Modal
        title={
          <Space>
            <RollbackOutlined style={{ color: '#fa8c16' }} />
            <span>Enregistrer un Retour</span>
            {venteRetour && (
              <Tag color="orange">F-{String(venteRetour.id).padStart(4, '0')}</Tag>
            )}
          </Space>
        }
        open={modalRetourVisible}
        onCancel={() => setModalRetourVisible(false)}
        width={560}
        footer={[
          <Button key="annuler" onClick={() => setModalRetourVisible(false)}>
            Annuler
          </Button>,
          <Button key="valider" type="primary" loading={retourLoading}
            icon={<RollbackOutlined />}
            onClick={validerRetour}
            style={{ background: '#fa8c16', borderColor: '#fa8c16' }}>
            Valider le retour
          </Button>
        ]}
      >
        {venteRetour && (() => {
          const panier = JSON.parse(venteRetour.panier || '[]')
          return (
            <div>
              <Alert
                type="info" showIcon style={{ borderRadius: 10, marginBottom: 16 }}
                message="Le retour sera soumis pour approbation. Le stock et la trésorerie seront mis à jour uniquement après validation par un responsable."
              />

              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Articles de la vente — sélectionnez les quantités à retourner :
              </Text>

              {panier.map(item => (
                <div key={item.produit_id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', marginBottom: 8,
                  background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0'
                }}>
                  <div>
                    <Text strong style={{ display: 'block' }}>{item.nom}</Text>
                    <Text style={{ color: '#888', fontSize: 12 }}>
                      {item.prix_unitaire?.toLocaleString()} FCFA × {item.quantite} {item.unite || 'pcs'}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: '#888', fontSize: 12 }}>Retourner :</Text>
                    <InputNumber
                      min={0} max={item.quantite}
                      value={panierRetourQtes[item.produit_id] || 0}
                      onChange={(val) => setPanierRetourQtes(prev => ({
                        ...prev, [item.produit_id]: val || 0
                      }))}
                      size="small" style={{ width: 70 }}
                    />
                    <Text style={{ color: '#888', fontSize: 11 }}>/ {item.quantite}</Text>
                  </div>
                </div>
              ))}

              <Divider style={{ margin: '12px 0' }} />

              <Row gutter={16}>
                <Col span={14}>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong style={{ display: 'block', marginBottom: 4 }}>Raison du retour</Text>
                    <Input
                      placeholder="Ex: Produit défectueux, erreur de commande..."
                      value={raisonRetour}
                      onChange={e => setRaisonRetour(e.target.value)}
                    />
                  </div>
                </Col>
                <Col span={10}>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong style={{ display: 'block', marginBottom: 4 }}>Mode remboursement</Text>
                    <Select value={modeRemboursement} onChange={setModeRemboursement} style={{ width: '100%' }}>
                      <Option value="especes">💵 Espèces</Option>
                      <Option value="wave">🌊 Wave</Option>
                      <Option value="orange_money">🟠 Orange Money</Option>
                      <Option value="avoir">📋 Avoir</Option>
                    </Select>
                  </div>
                </Col>
              </Row>

              <Card size="small" style={{
                background: 'linear-gradient(135deg, #fff7e6, #fff2f0)',
                border: '1px solid #ffbb96', borderRadius: 10, marginTop: 12
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong>Montant à rembourser :</Text>
                  <Text strong style={{ fontSize: 18, color: '#fa8c16' }}>
                    {montantRetourCalcule().toLocaleString()} FCFA
                  </Text>
                </div>
              </Card>
            </div>
          )
        })()}
      </Modal>

      {/* ✅ Modal Remboursement Crédit */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <span>Remboursement Crédit</span>
            {facturePret && (
              <Tag color="orange">F-{String(facturePret.id).padStart(4, '0')}</Tag>
            )}
          </Space>
        }
        open={modalRembours}
        onCancel={() => setModalRembours(false)}
        width={480}
        footer={[
          <Button key="annuler" onClick={() => setModalRembours(false)}>
            Annuler
          </Button>,
          <Button key="valider" type="primary" loading={loadingRembours}
            icon={<CheckCircleOutlined />}
            onClick={validerRemboursement}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}>
            Enregistrer le remboursement
          </Button>
        ]}
      >
        {facturePret && (() => {
          const resteApres = Math.max(0, (facturePret.montant_du || 0) - (montantRembours || 0))
          return (
            <div>
              {/* Résumé facture */}
              <Card size="small" style={{
                background: 'linear-gradient(135deg, #fff7e6, #fffbe6)',
                border: '1px solid #ffd591', borderRadius: 10, marginBottom: 16
              }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Text style={{ color: '#888', fontSize: 11 }}>Client</Text>
                    <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>
                      {facturePret.client_nom || 'Anonyme'}
                    </div>
                  </Col>
                  <Col span={8}>
                    <Text style={{ color: '#888', fontSize: 11 }}>Total facture</Text>
                    <div style={{ fontWeight: 'bold', color: '#1890ff' }}>
                      {(facturePret.montant_total || 0).toLocaleString('fr-FR')} FCFA
                    </div>
                  </Col>
                  <Col span={8}>
                    <Text style={{ color: '#888', fontSize: 11 }}>Déjà payé</Text>
                    <div style={{ fontWeight: 'bold', color: '#52c41a' }}>
                      {(facturePret.montant_paye || 0).toLocaleString('fr-FR')} FCFA
                    </div>
                  </Col>
                </Row>
              </Card>

              {/* Dette restante */}
              <div style={{
                background: '#fff2f0', border: '1px solid #ffccc7',
                borderRadius: 10, padding: '12px 16px', marginBottom: 16,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <Text style={{ color: '#cf1322', fontWeight: 'bold' }}>
                  ❗ Reste dû actuellement :
                </Text>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#cf1322' }}>
                  {(facturePret.montant_du || 0).toLocaleString('fr-FR')} FCFA
                </Text>
              </div>

              {/* Montant à rembourser */}
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  💵 Montant remboursé aujourd'hui (FCFA)
                </Text>
                <InputNumber
                  min={1} max={facturePret.montant_du || 0}
                  value={montantRembours}
                  onChange={(val) => setMontantRembours(val || 0)}
                  style={{ width: '100%', fontSize: 18 }}
                  size="large"
                  precision={0}
                  formatter={(val) => `${(val || 0).toLocaleString('fr-FR')} FCFA`}
                  parser={(str) => parseInt(str.replace(/\D/g, ''), 10) || 0}
                />
              </div>

              {/* Mode paiement */}
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  Mode de paiement
                </Text>
                <Select value={modeRembours} onChange={setModeRembours} style={{ width: '100%' }} size="large">
                  <Option value="especes">💵 Espèces</Option>
                  <Option value="wave">🌊 Wave</Option>
                  <Option value="orange_money">🟠 Orange Money</Option>
                  <Option value="cheque">📝 Chèque</Option>
                </Select>
              </div>

              {/* Résumé après remboursement */}
              <Card size="small" style={{
                background: resteApres <= 0
                  ? 'linear-gradient(135deg, #f6ffed, #d9f7be)'
                  : 'linear-gradient(135deg, #f0f5ff, #e6f7ff)',
                border: `1px solid ${resteApres <= 0 ? '#b7eb8f' : '#91d5ff'}`,
                borderRadius: 10
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: resteApres <= 0 ? '#389e0d' : '#1890ff', fontWeight: 'bold' }}>
                    {resteApres <= 0 ? '✅ Crédit soldé intégralement !' : '📋 Reste dû après remboursement :'}
                  </Text>
                  {resteApres > 0 && (
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>
                      {resteApres.toLocaleString('fr-FR')} FCFA
                    </Text>
                  )}
                </div>
              </Card>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}

export default Factures