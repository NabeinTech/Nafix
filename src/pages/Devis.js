import React, { useState, useEffect, useMemo } from 'react'
import {
  Typography, Table, Button, Modal, Form,
  Select, InputNumber, Space, Tag, Card,
  Divider, Row, Col, message, Input, DatePicker, Popconfirm
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, CheckOutlined,
  CloseOutlined, EyeOutlined, FileDoneOutlined,
  UserAddOutlined, SearchOutlined, ClearOutlined,
  EditOutlined, TagOutlined, PrinterOutlined, FileTextOutlined,
  DownloadOutlined, UploadOutlined
} from '@ant-design/icons'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import NouveauClientModal from '../components/NouveauClientModal'
import NouveauProduitRapideModal from '../components/NouveauProduitRapideModal'
import FiltresPeriode from '../components/FiltresPeriode'
import dayjs from 'dayjs'
import { peutFaireSurDevis } from '../utils/permissions'
import { montantEnLettresFCFA } from '../utils/nombreEnLettres'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input
const { Search } = Input
const { RangePicker } = DatePicker
const ipcRenderer = typeof window !== 'undefined' ? window.ipcRenderer : null

function Devis({ utilisateur }) {
  const role = utilisateur?.role || 'caissier'

  const [devisList, setDevisList] = useState([])
  const [devisFiltres, setDevisFiltres] = useState([])
  const [produits, setProduits] = useState([])
  const [categories, setCategories] = useState([])
  const [clients, setClients] = useState([])
  const [parametres, setParametres] = useState({})
  const [modalVisible, setModalVisible] = useState(false)
  const [clientModalVisible, setClientModalVisible] = useState(false)
  const [produitModalVisible, setProduitModalVisible] = useState(false)
  const [rechercheProduit, setRechercheProduit] = useState('')
  const [apercuVisible, setApercuVisible] = useState(false)
  const [devisSelectionne, setDevisSelectionne] = useState(null)
  const [editingDevis, setEditingDevis] = useState(null)
  const [panier, setPanier] = useState([])
  const [impression, setImpression] = useState(false)
  const [enregistrement, setEnregistrement] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [filtreStatut, setFiltreStatut] = useState(null)
  const [filtreDates, setFiltreDates] = useState(null)
  const [importEnCours, setImportEnCours] = useState(false)
  const [modeleEnCours, setModeleEnCours] = useState(false)
  const [filtrePeriode, setFiltrePeriode] = useState(null)
  const [form] = Form.useForm()
  const [editingProduitId, setEditingProduitId] = useState(null)
  const [editingChamp, setEditingChamp] = useState(null)
  const [editingValeur, setEditingValeur] = useState(null)
  const [uniteSelectionnee, setUniteSelectionnee] = useState('pièce')

  // ── Vérification champs document ────────────────────────
  const champsDocumentManquants = useMemo(() => {
    const champs = []
    if (!parametres?.nom_entreprise?.trim()) champs.push('Nom entreprise')
    if (!parametres?.telephone?.trim()) champs.push('Téléphone')
    return champs
  }, [parametres])

  const verifierConformiteDocument = () => {
    if (champsDocumentManquants.length === 0) return true
    message.warning(
      `Paramètres incomplets : ${champsDocumentManquants.join(', ')}. ` +
      'Complétez-les dans Paramètres → Entreprise.'
    )
    return true // On laisse quand même générer
  }

  // ── Chargement ──────────────────────────────────────────
  const chargerDevis = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('devis:getAll') || []
    setDevisList(data)
    setDevisFiltres(data)
  }

  const chargerProduits = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('produits:getAll') || []
    setProduits(data)
  }

  const chargerClients = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('clients:getAll') || []
    setClients(data)
  }

  const chargerCategories = async () => {
    if (!ipcRenderer) return
    setCategories(await ipcRenderer.invoke('categories:getAll') || [])
  }

  const chargerParametres = async () => {
    if (!ipcRenderer) return
    setParametres(await ipcRenderer.invoke('parametres:get') || {})
  }

  useEffect(() => {
    chargerDevis()
    chargerProduits()
    chargerClients()
    chargerParametres()
    chargerCategories()
  }, [])

  // ── Filtrage ─────────────────────────────────────────────
  useEffect(() => {
    let resultat = [...devisList]

    if (recherche) {
      const terme = recherche.toLowerCase()
      resultat = resultat.filter(d =>
        d.client_nom?.toLowerCase().includes(terme) ||
        String(d.id).includes(terme)
      )
    }

    if (filtreStatut) {
      resultat = resultat.filter(d => d.statut === filtreStatut)
    }

    if (filtrePeriode?.[0] && filtrePeriode?.[1]) {
      const debut = filtrePeriode[0].startOf('day')
      const fin = filtrePeriode[1].endOf('day')
      resultat = resultat.filter(d => {
        const date = dayjs(d.created_at)
        return date.valueOf() >= debut.valueOf() && date.valueOf() <= fin.valueOf()
      })
    }

    if (filtreDates?.[0] && filtreDates?.[1]) {
      const debut = filtreDates[0].startOf('day')
      const fin = filtreDates[1].endOf('day')
      resultat = resultat.filter(d => {
        const date = dayjs(d.created_at)
        return date.valueOf() >= debut.valueOf() && date.valueOf() <= fin.valueOf()
      })
    }

    setDevisFiltres(resultat)
  }, [recherche, filtreStatut, filtreDates, filtrePeriode, devisList])

  const reinitialiserFiltres = () => {
    setRecherche('')
    setFiltreStatut(null)
    setFiltreDates(null)
    setFiltrePeriode(null)
  }

  // ── Import Excel — génère automatiquement un ou plusieurs devis ──────
  const telechargerModeleDevis = async () => {
    if (!ipcRenderer) return
    setModeleEnCours(true)
    try {
      const resultat = await ipcRenderer.invoke('devis:exporterModeleExcel')
      if (resultat?.annule) return
      if (resultat?.erreur) { message.error(`❌ ${resultat.erreur}`); return }
      message.success('✅ Modèle téléchargé !')
    } finally {
      setModeleEnCours(false)
    }
  }

  const importerDevisExcel = async () => {
    if (!ipcRenderer) return
    setImportEnCours(true)
    try {
      const resultat = await ipcRenderer.invoke('devis:importerExcel')
      if (resultat?.annule) return
      if (resultat?.erreur) { message.error(`❌ ${resultat.erreur}`); return }
      const { devisCrees, clientsCrees, erreurs } = resultat
      if (devisCrees > 0) {
        message.success(`✅ ${devisCrees} devis créé(s)${clientsCrees > 0 ? ` (dont ${clientsCrees} nouveau(x) client(s))` : ''} !`)
        chargerDevis()
      } else {
        message.warning('⚠️ Aucun devis créé à partir de ce fichier')
      }
      if (erreurs?.length) {
        Modal.warning({
          title: `${erreurs.length} ligne(s) non importée(s)`,
          content: (
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {erreurs.map((e, i) => <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>{e}</div>)}
            </div>
          )
        })
      }
    } finally {
      setImportEnCours(false)
    }
  }

  // ── Panier ───────────────────────────────────────────────
  const ajouterAuPanier = (values) => {
    const produit = produits.find(p => p.id === values.produit_id)
    if (!produit) return
    const unite = produit.unite || 'pièce'
    const existant = panier.find(p => p.produit_id === values.produit_id)
    if (existant) {
      setPanier(panier.map(p =>
        p.produit_id === values.produit_id
          ? { ...p, quantite: p.quantite + values.quantite, total: (p.quantite + values.quantite) * p.prix_unitaire }
          : p
      ))
    } else {
      setPanier([...panier, {
        produit_id: produit.id,
        nom: produit.nom,
        unite,
        quantite: values.quantite,
        prix_unitaire: produit.prix_vente,
        prix_catalogue: produit.prix_vente,
        total: values.quantite * produit.prix_vente
      }])
    }
    form.resetFields(['produit_id', 'quantite'])
    setUniteSelectionnee('pièce')
  }

  const modifierQuantitePanier = (produit_id, nouvelleQuantite) => {
    if (nouvelleQuantite <= 0) { retirerDuPanier(produit_id); return }
    setPanier(panier.map(p => p.produit_id === produit_id
      ? { ...p, quantite: nouvelleQuantite, total: nouvelleQuantite * p.prix_unitaire } : p))
    setEditingProduitId(null); setEditingChamp(null); setEditingValeur(null)
  }

  const modifierPrixPanier = (produit_id, nouveauPrix) => {
    if (nouveauPrix < 0) return
    setPanier(panier.map(p => p.produit_id === produit_id
      ? { ...p, prix_unitaire: nouveauPrix, total: p.quantite * nouveauPrix } : p))
    setEditingProduitId(null); setEditingChamp(null); setEditingValeur(null)
  }

  const retirerDuPanier = (produit_id) => {
    setPanier(panier.filter(p => p.produit_id !== produit_id))
  }

  const calculerTotal = () => panier.reduce((acc, item) => acc + item.total, 0)

  // ── Actions devis ────────────────────────────────────────
  const creerDevis = async (values) => {
    if (!ipcRenderer) {
      message.error('Impossible de communiquer avec le service de données.')
      return
    }
    if (panier.length === 0) { message.warning('Le panier est vide !'); return }
    setEnregistrement(true)
    try {
      const panierStr = JSON.stringify(panier)
      const total = calculerTotal()

      if (editingDevis) {
        const resultat = await ipcRenderer.invoke('devis:update', {
          id: editingDevis.id,
          client_id: values.client_id || null,
          validite: values.validite || 30,
          notes: values.notes || '',
          montant_total: total,
          panier: panierStr
        })
        if (resultat?.erreur) { message.error(`❌ ${resultat.erreur}`); return }
        message.success('✅ Devis mis à jour !')
        setPanier([])
        form.resetFields()
        setEditingDevis(null)
        setModalVisible(false)
        chargerDevis()
        return
      }

      const result = await ipcRenderer.invoke('devis:create', {
        client_id: values.client_id || null,
        validite: values.validite || 30,
        notes: values.notes || '',
        montant_total: total,
        panier: panierStr,
        statut: 'en_attente'
      })
      message.success('✅ Devis créé !')
      const client = clients.find(c => c.id === values.client_id)
      const nouveauDevis = {
        id: result?.id,
        client_id: values.client_id || null,
        client_nom: client?.nom || null,
        validite: values.validite || 30,
        notes: values.notes || '',
        montant_total: total,
        panier: panierStr,
        statut: 'en_attente',
        created_at: new Date().toISOString()
      }
      setPanier([])
      form.resetFields()
      setModalVisible(false)
      chargerDevis()
      Modal.confirm({
        title: 'Imprimer le devis ?',
        content: `Devis de ${total.toLocaleString('fr-FR')} FCFA créé.`,
        okText: 'Oui, imprimer',
        cancelText: 'Plus tard',
        onOk: () => {
          setDevisSelectionne(nouveauDevis)
          setApercuVisible(true)
          setTimeout(() => imprimerDevisDirectement(nouveauDevis), 500)
        }
      })
    } catch (e) {
      message.error(`❌ Erreur : ${e.message}`)
    } finally {
      setEnregistrement(false)
    }
  }

  // Reouvre le modal "Nouveau Devis" en mode edition, pre-rempli avec le
  // devis existant. Bloque sur un devis deja converti (voir
  // DevisDAO.update — meme regle cote serveur, verifiee ici seulement pour
  // eviter d'ouvrir un formulaire qui echouera de toute facon a la
  // soumission).
  const ouvrirModificationDevis = (devis) => {
    if (!peutFaireSurDevis(role, 'modifier')) {
      message.error('❌ Vous n\'avez pas la permission de modifier un devis')
      return
    }
    if (devis.converti === 1) {
      message.warning('Devis déjà converti en facture, non modifiable')
      return
    }
    const panierExistant = typeof devis.panier === 'string' ? JSON.parse(devis.panier || '[]') : (devis.panier || [])
    setPanier(panierExistant)
    setEditingDevis(devis)
    form.setFieldsValue({
      client_id: devis.client_id || undefined,
      validite: devis.validite || 30,
      notes: devis.notes || ''
    })
    setModalVisible(true)
  }

  const supprimerDevis = async (id) => {
    if (!peutFaireSurDevis(role, 'supprimer')) {
      message.error('❌ Vous n\'avez pas la permission de supprimer un devis')
      return
    }
    if (!ipcRenderer) {
      message.error('Impossible de communiquer avec le service de données.')
      return
    }
    try {
      await ipcRenderer.invoke('devis:delete', id)
      message.success('✅ Devis supprimé')
      chargerDevis()
    } catch (e) {
      message.error(`❌ Erreur : ${e.message}`)
    }
  }

  const changerStatut = async (id, statut) => {
    if (!ipcRenderer) {
      message.error('Impossible de communiquer avec le service de données.')
      return
    }
    await ipcRenderer.invoke('devis:updateStatut', { id, statut })
    message.success(statut === 'accepte' ? '✅ Devis accepté !' : '❌ Devis refusé !')
    chargerDevis()
  }

  const convertirEnFacture = async (devis) => {
    if (!ipcRenderer) {
      message.error('Impossible de communiquer avec le service de données.')
      return
    }
    if (devis.converti) { message.warning('Déjà converti en facture !'); return }
    const result = await ipcRenderer.invoke('devis:convertir', {
      client_id: devis.client_id || null,
      mode_paiement: 'especes',
      montant_total: devis.montant_total,
      panier: typeof devis.panier === 'string' ? devis.panier : JSON.stringify(devis.panier || []),
      devis_id: devis.id
    })
    if (result) {
      message.success('✅ Converti en facture !')
      chargerDevis()
    }
  }

  const voirApercu = (devis) => {
    verifierConformiteDocument()
    setDevisSelectionne(devis)
    setApercuVisible(true)
  }

  // Envoie directement le devis à l'imprimante physique (boîte de dialogue
  // native), sans passer par un fichier PDF à ouvrir/imprimer manuellement.
  const imprimerDevisDirectement = async (cible) => {
    setImpression(true)
    try {
      const element = document.getElementById('devis-pdf')
      if (!element) {
        message.error('Aperçu non disponible pour l\'impression.')
        return
      }
      const resultat = await ipcRenderer.invoke('impression:imprimerHTML', { html: element.outerHTML })
      if (resultat?.erreur) {
        message.error(`Erreur d'impression : ${resultat.erreur}`)
      } else if (resultat?.succes) {
        message.success('✅ Devis envoyé à l\'imprimante')
      }
    } catch (error) {
      message.error("Erreur lors de l'impression")
    }
    setImpression(false)
  }

  const imprimerPDF = async (cible) => {
    const devisCible = cible || devisSelectionne
    setImpression(true)
    try {
      const element = document.getElementById('devis-pdf')
      if (!element) {
        message.error('Aperçu non disponible pour l\'impression.')
        setImpression(false)
        return
      }
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(`Devis-D-${String(devisCible?.id || '0000').padStart(4, '0')}.pdf`)
      message.success('✅ PDF téléchargé !')
    } catch (err) {
      message.error('Erreur PDF')
    }
    setImpression(false)
  }

  const couleurStatut = (s) => s === 'accepte' ? 'green' : s === 'refuse' ? 'red' : 'orange'
  const libelleStatut = (s) => s === 'accepte' ? '✅ Accepté' : s === 'refuse' ? '❌ Refusé' : '⏳ En attente'

  // ── Colonnes ─────────────────────────────────────────────
  const columns = [
    {
      title: 'N° Devis', dataIndex: 'id', key: 'id',
      render: (id) => (
        <Tag style={{ background: '#f9f0ff', border: '1px solid #d3adf7',
          color: '#722ed1', fontWeight: 'bold', borderRadius: 6 }}>
          D-{String(id).padStart(4, '0')}
        </Tag>
      )
    },
    {
      title: 'Client', dataIndex: 'client_nom', key: 'client_nom',
      render: (val) => (
        <Space>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, #722ed1, #1890ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 'bold', fontSize: 12, flexShrink: 0
          }}>
            {val ? val[0].toUpperCase() : 'A'}
          </div>
          <Text>{val || 'Client anonyme'}</Text>
        </Space>
      )
    },
    {
      title: 'Montant', dataIndex: 'montant_total', key: 'montant_total',
      render: (val) => <Text strong style={{ color: '#722ed1' }}>{(val || 0).toLocaleString()} FCFA</Text>
    },
    {
      title: 'Validité', dataIndex: 'validite', key: 'validite',
      render: (val) => <Tag color="blue" style={{ borderRadius: 12 }}>{val} jours</Tag>
    },
    {
      title: 'Statut', dataIndex: 'statut', key: 'statut',
      render: (val, record) => (
        <Space>
          <Tag color={couleurStatut(val)} style={{ borderRadius: 12 }}>{libelleStatut(val)}</Tag>
          {record.converti === 1 && <Tag color="purple" style={{ borderRadius: 12 }}>📄 Facturé</Tag>}
        </Space>
      )
    },
    {
      title: 'Date', dataIndex: 'created_at', key: 'created_at',
      render: (val) => <Text style={{ color: '#888', fontSize: 12 }}>
        {new Date(val).toLocaleDateString('fr-FR')}
      </Text>
    },
    {
      title: 'Actions', key: 'actions',
      render: (_, record) => (
        <Space size={4}>
          <Button type="primary" icon={<EyeOutlined />} size="small"
            style={{ borderRadius: 6 }} onClick={() => voirApercu(record)}>
            Voir
          </Button>
          {record.statut === 'en_attente' && (
            <>
              <Button size="small" icon={<CheckOutlined />}
                style={{ background: '#52c41a', color: 'white', border: 'none', borderRadius: 6 }}
                onClick={() => changerStatut(record.id, 'accepte')}>
                Accepter
              </Button>
              <Button danger size="small" icon={<CloseOutlined />}
                style={{ borderRadius: 6 }}
                onClick={() => changerStatut(record.id, 'refuse')}>
                Refuser
              </Button>
            </>
          )}
          {record.statut === 'accepte' && record.converti !== 1 && (
            <Button size="small" icon={<FileDoneOutlined />}
              style={{ background: '#faad14', color: 'white', border: 'none', borderRadius: 6 }}
              onClick={() => convertirEnFacture(record)}>
              Facture
            </Button>
          )}
          {peutFaireSurDevis(role, 'modifier') && record.converti !== 1 && (
            <Button size="small" icon={<EditOutlined />}
              style={{ borderRadius: 6 }}
              onClick={() => ouvrirModificationDevis(record)}>
              Modifier
            </Button>
          )}
          {peutFaireSurDevis(role, 'supprimer') && (
            <Popconfirm title="Supprimer ce devis ?"
              onConfirm={() => supprimerDevis(record.id)}
              okText="Oui" cancelText="Non">
              <Button danger size="small" icon={<DeleteOutlined />} style={{ borderRadius: 6 }}>
                Supprimer
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  const colonnesPanier = [
    {
      title: 'Produit', dataIndex: 'nom', key: 'nom',
      render: (val, record) => {
        const prixNegoc = record.prix_unitaire < (record.prix_catalogue || record.prix_unitaire)
        return (
          <div>
            <Text strong>{val}</Text>
            {prixNegoc && (
              <Tag color="orange" style={{ marginLeft: 6, fontSize: 10, borderRadius: 8 }}>
                <TagOutlined /> Négocié
              </Tag>
            )}
          </div>
        )
      }
    },
    {
      title: 'Qté', dataIndex: 'quantite', key: 'quantite', width: 120,
      render: (val, record) => {
        return editingProduitId === record.produit_id && editingChamp === 'quantite' ? (
          <Space size={4}>
            <InputNumber value={editingValeur} onChange={setEditingValeur}
              min={0.001}
              step={1}
              precision={2}
              size="small" style={{ width: 70 }} autoFocus
              onPressEnter={() => modifierQuantitePanier(record.produit_id, editingValeur)} />
            <Button size="small" type="primary"
              onClick={() => modifierQuantitePanier(record.produit_id, editingValeur)}>✓</Button>
            <Button size="small"
              onClick={() => { setEditingProduitId(null); setEditingChamp(null) }}>✗</Button>
          </Space>
        ) : (
          <Tag color="blue" style={{ cursor: 'pointer', borderRadius: 8 }}
            onClick={() => { setEditingProduitId(record.produit_id); setEditingChamp('quantite'); setEditingValeur(val) }}>
            {val} {record.unite || ''} <EditOutlined style={{ fontSize: 10 }} />
          </Tag>
        )
      }
    },
    {
      title: 'Prix Unit.', dataIndex: 'prix_unitaire', key: 'prix_unitaire', width: 180,
      render: (val, record) =>
        editingProduitId === record.produit_id && editingChamp === 'prix' ? (
          <Space size={4}>
            <InputNumber value={editingValeur} onChange={setEditingValeur}
              min={0} size="small" style={{ width: 100 }} autoFocus
              formatter={v => `${v?.toLocaleString()} F`}
              parser={v => parseInt(v.replace(/\D/g, ''), 10) || 0}
              onPressEnter={() => modifierPrixPanier(record.produit_id, editingValeur)} />
            <Button size="small" type="primary"
              onClick={() => modifierPrixPanier(record.produit_id, editingValeur)}>✓</Button>
            <Button size="small"
              onClick={() => { setEditingProduitId(null); setEditingChamp(null) }}>✗</Button>
          </Space>
        ) : (
          <div>
            <Text style={{ cursor: 'pointer', color: val < (record.prix_catalogue || val) ? '#fa8c16' : '#1890ff' }}
              onClick={() => { setEditingProduitId(record.produit_id); setEditingChamp('prix'); setEditingValeur(val) }}>
              {val?.toLocaleString()} FCFA <EditOutlined style={{ fontSize: 10 }} />
            </Text>
            {val < (record.prix_catalogue || val) && (
              <div style={{ fontSize: 10, color: '#aaa', textDecoration: 'line-through' }}>
                {record.prix_catalogue?.toLocaleString()} FCFA
              </div>
            )}
          </div>
        )
    },
    {
      title: 'Total', dataIndex: 'total', key: 'total',
      render: (val, record) => {
        const estNegoc = record.prix_unitaire < (record.prix_catalogue || record.prix_unitaire)
        return (
          <Text strong style={{ color: estNegoc ? '#fa8c16' : '#52c41a' }}>
            {val?.toLocaleString()} FCFA
          </Text>
        )
      }
    },
    {
      title: '', key: 'action',
      render: (_, record) => (
        <Button danger size="small" icon={<DeleteOutlined />}
          onClick={() => retirerDuPanier(record.produit_id)} />
      )
    }
  ]

  // ── RENDU ────────────────────────────────────────────────
  return (
    <div>
      {/* En-tête */}
      <div style={{
        background: 'linear-gradient(135deg, #722ed1 0%, #1890ff 100%)',
        borderRadius: 16, padding: '20px 28px', marginBottom: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <Title level={2} style={{ color: 'white', margin: 0 }}>
            📝 Gestion des Devis
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>
            Créez et gérez vos devis professionnels
          </Text>
        </div>
        <Button icon={<PlusOutlined />} size="large"
          onClick={() => { setEditingDevis(null); setPanier([]); form.resetFields(); setModalVisible(true) }}
          style={{
            borderRadius: 10, fontWeight: 'bold', height: 44,
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)', color: 'white'
          }}>
          Nouveau Devis
        </Button>
      </div>

      {/* Stats rapides */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { titre: 'Total Devis', val: devisList.length, color: '#722ed1', bg: '#f9f0ff' },
          { titre: 'En attente', val: devisList.filter(d => d.statut === 'en_attente').length, color: '#faad14', bg: '#fffbe6' },
          { titre: 'Acceptés', val: devisList.filter(d => d.statut === 'accepte').length, color: '#52c41a', bg: '#f6ffed' },
          { titre: 'Convertis', val: devisList.filter(d => d.converti === 1).length, color: '#1890ff', bg: '#e6f7ff' }
        ].map((s, i) => (
          <Col span={6} key={i}>
            <Card style={{ borderRadius: 12, border: 'none', background: s.bg, textAlign: 'center' }}
              bodyStyle={{ padding: '14px' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: s.color }}>{s.val}</div>
              <Text style={{ color: '#888', fontSize: 12 }}>{s.titre}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filtres */}
      <Card style={{ marginBottom: 16, borderRadius: 12, border: 'none',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Row gutter={[16, 12]} align="middle">
          <Col span={6}>
            <Search placeholder="Client ou N° devis..."
              allowClear prefix={<SearchOutlined />}
              value={recherche} onChange={(e) => setRecherche(e.target.value)}
              size="large" />
          </Col>
          <Col span={5}>
            <Select placeholder="Statut" allowClear style={{ width: '100%' }}
              size="large" value={filtreStatut} onChange={setFiltreStatut}>
              <Option value="en_attente">⏳ En attente</Option>
              <Option value="accepte">✅ Accepté</Option>
              <Option value="refuse">❌ Refusé</Option>
            </Select>
          </Col>
          <Col span={6}>
            <RangePicker style={{ width: '100%' }} size="large"
              value={filtreDates} onChange={setFiltreDates}
              format="DD/MM/YYYY" placeholder={['Date début', 'Date fin']} />
          </Col>
          <Col span={3}>
            <Button icon={<ClearOutlined />} size="large"
              onClick={reinitialiserFiltres} style={{ width: '100%', borderRadius: 8 }}>
              Reset
            </Button>
          </Col>
          <Col span={4}>
            <div style={{ background: '#f0f5ff', padding: '8px 12px', borderRadius: 8, textAlign: 'center' }}>
              <Text style={{ color: '#722ed1', fontWeight: 'bold', display: 'block' }}>
                {devisFiltres.length} / {devisList.length}
              </Text>
              <Text style={{ color: '#888', fontSize: 11 }}>devis</Text>
            </div>
          </Col>
        </Row>
        <Divider style={{ margin: '12px 0' }} />
        <FiltresPeriode onFiltreChange={setFiltrePeriode} />
        <Divider style={{ margin: '12px 0' }} />
        <Space wrap size={8}>
          <Button icon={<UploadOutlined />} size="large" loading={importEnCours}
            onClick={importerDevisExcel} style={{ borderRadius: 8 }}>
            Importer Excel
          </Button>
          <Button icon={<DownloadOutlined />} size="large" loading={modeleEnCours}
            onClick={telechargerModeleDevis} style={{ borderRadius: 8 }}>
            Modèle Excel
          </Button>
        </Space>
      </Card>

      {/* Tableau */}
      <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Table dataSource={devisFiltres} columns={columns} rowKey="id"
          pagination={{ pageSize: 10, showTotal: (t) => `${t} devis au total` }} />
      </Card>

      {/* Modal Nouveau Devis / Modification (formulaire partagé, voir editingDevis) */}
      <Modal title={editingDevis ? `📝 Modifier Devis D-${String(editingDevis.id).padStart(4, '0')}` : '📝 Nouveau Devis'} open={modalVisible}
        onCancel={() => { setModalVisible(false); setPanier([]); setEditingDevis(null); form.resetFields() }}
        footer={null} width={820}>
        <Form form={form} layout="vertical" onFinish={creerDevis}>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="client_id" label="Client (optionnel)">
                <Select placeholder="Choisir un client" allowClear
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <div style={{ padding: '8px', borderTop: '1px solid #eee' }}>
                        <Button type="dashed" icon={<UserAddOutlined />}
                          style={{ width: '100%' }}
                          onClick={() => setClientModalVisible(true)}>
                          + Nouveau Client
                        </Button>
                      </div>
                    </>
                  )}>
                  {clients.map(c => (
                    <Option key={c.id} value={c.id}>{c.nom}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="validite" label="Validité (jours)">
                <InputNumber style={{ width: '100%' }} defaultValue={30} min={1} />
              </Form.Item>
            </Col>
          </Row>

          <Card size="small" title="➕ Ajouter des produits" style={{ marginBottom: 16 }}>
            <Row gutter={8}>
              <Col span={14}>
                <Form.Item name="produit_id" noStyle>
                  <Select
                    placeholder="🔍 Tapez le nom ou la référence du produit..."
                    style={{ width: '100%' }}
                    showSearch
                    filterOption={(input, option) => {
                      const p = produits.find(x => x.id === option.value)
                      if (!p) return false
                      const terme = input.toLowerCase()
                      return (
                        p.nom?.toLowerCase().includes(terme) ||
                        p.reference?.toLowerCase().includes(terme) ||
                        p.categorie?.toLowerCase().includes(terme)
                      )
                    }}
                    onSearch={setRechercheProduit}
                    onChange={(id) => {
                      const p = produits.find(x => x.id === id)
                      setUniteSelectionnee(p?.unite || 'pièce')
                    }}
                    dropdownRender={(menu) => (
                      <>
                        {menu}
                        <div style={{ padding: '8px', borderTop: '1px solid #eee' }}>
                          <Button type="dashed" icon={<PlusOutlined />}
                            style={{ width: '100%' }}
                            onClick={() => setProduitModalVisible(true)}>
                            + Nouveau produit{rechercheProduit ? ` "${rechercheProduit}"` : ''}
                          </Button>
                        </div>
                      </>
                    )}
                  >
                    {produits.map(p => (
                      <Option key={p.id} value={p.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>
                            <strong>{p.nom}</strong>
                            {p.reference && <span style={{ color: '#8c8c8c', fontSize: 11 }}> · {p.reference}</span>}
                            {p.categorie && <span style={{ color: '#8c8c8c', fontSize: 11 }}> · {p.categorie}</span>}
                          </span>
                          <span style={{ color: '#52c41a', fontWeight: 600 }}>
                            {p.prix_vente?.toLocaleString()} FCFA
                          </span>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="quantite" noStyle initialValue={1}>
                  <InputNumber
                    min={0.001}
                    step={1}
                    precision={2}
                    addonAfter={<span style={{ minWidth: 28, display: 'inline-block', textAlign: 'center', fontSize: 11 }}>{uniteSelectionnee}</span>}
                    style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Button type="dashed" icon={<PlusOutlined />} style={{ width: '100%' }}
                  onClick={() =>
                    form.validateFields(['produit_id', 'quantite'])
                      .then(values => ajouterAuPanier(values))
                  }>
                  Ajouter
                </Button>
              </Col>
            </Row>
          </Card>

          <Table dataSource={panier} columns={colonnesPanier}
            rowKey="produit_id" pagination={false} size="small"
            footer={() => (
              <div style={{ textAlign: 'right' }}>
                <Text strong style={{ fontSize: 18, color: '#722ed1' }}>
                  Total : {calculerTotal().toLocaleString()} FCFA
                </Text>
              </div>
            )} />

          <Divider />

          <Form.Item name="notes" label="Notes / Conditions">
            <TextArea rows={3} placeholder="Ex: Livraison sous 48h..." />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => { setModalVisible(false); setPanier([]); setEditingDevis(null); form.resetFields() }}>
                Annuler
              </Button>
              <Button type="primary" htmlType="submit" icon={<FileDoneOutlined />} size="large"
                loading={enregistrement}
                style={{ background: 'linear-gradient(135deg, #722ed1, #1890ff)', border: 'none' }}>
                {editingDevis ? 'Mettre à jour' : 'Créer le Devis'} — {calculerTotal().toLocaleString()} FCFA
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Aperçu */}
      <Modal title="📝 Aperçu du Devis" open={apercuVisible}
        onCancel={() => setApercuVisible(false)} width={920}
        footer={[
          <Button key="fermer" onClick={() => setApercuVisible(false)}>Fermer</Button>,
          <Button key="pdf" icon={<FileTextOutlined />}
            loading={impression} onClick={imprimerPDF}>
            Télécharger PDF
          </Button>,
          <Button key="imprimer" type="primary" icon={<PrinterOutlined />}
            loading={impression} onClick={() => imprimerDevisDirectement()}
            style={{ background: 'linear-gradient(135deg, #722ed1, #1890ff)', border: 'none' }}>
            Imprimer
          </Button>
        ]}>
        {devisSelectionne && (
          <DevisApercu devis={devisSelectionne} parametres={parametres} />
        )}
      </Modal>

      {/* Modal Nouveau Client */}
      <NouveauClientModal
        visible={clientModalVisible}
        onClose={() => setClientModalVisible(false)}
        onSuccess={() => chargerClients()}
      />

      {/* Modal Nouveau Produit — création rapide sans quitter le devis en cours */}
      <NouveauProduitRapideModal
        visible={produitModalVisible}
        onClose={() => setProduitModalVisible(false)}
        nomInitial={rechercheProduit}
        categoriesDomaine={categories}
        quantiteInitiale={form.getFieldValue('quantite') || 1}
        onSuccess={async (nouveauProduit) => {
          await chargerProduits()
          setRechercheProduit('')
          const quantite = form.getFieldValue('quantite') || 1
          setPanier(prev => [...prev, {
            produit_id: nouveauProduit.id,
            nom: nouveauProduit.nom,
            unite: nouveauProduit.unite || 'pièce',
            quantite,
            prix_unitaire: nouveauProduit.prix_vente,
            prix_catalogue: nouveauProduit.prix_vente,
            total: quantite * nouveauProduit.prix_vente
          }])
          form.resetFields(['produit_id', 'quantite'])
        }}
      />
    </div>
  )
}

// ── Aperçu PDF ───────────────────────────────────────────
// Meme identite visuelle "premium" que src/components/FacturePDF.js
// (en-tete sombre, bandeau d'accent teal, tableau a en-tete fonce,
// "arretee a la somme de", signatures) — demandee explicitement par
// l'utilisateur pour le devis, comme pour la facture.
const DEVIS_COULEUR_SOMBRE = '#132743'
const DEVIS_COULEUR_ACCENT = '#0d9488'
const DEVIS_COULEUR_LABEL = '#2f6fed'
const DEVIS_COULEUR_TEXTE = '#1f2937'
const DEVIS_COULEUR_TEXTE_ATTENUE = '#6b7280'

function DevisApercu({ devis, parametres }) {
  const panier = typeof devis.panier === 'string' ? JSON.parse(devis.panier || '[]') : devis.panier || []
  const date = new Date(devis.created_at).toLocaleDateString('fr-FR')
  const dateExpiration = new Date(
    new Date(devis.created_at).getTime() + Number(devis.validite || 0) * 24 * 60 * 60 * 1000
  ).toLocaleDateString('fr-FR')
  const numero = `D-${String(devis.id).padStart(4, '0')}`
  const tvaTaux = parametres?.tva_taux != null ? parseFloat(parametres.tva_taux) : 18
  const tva = tvaTaux / 100
  const montantHT = Math.round(tva ? devis.montant_total / (1 + tva) : devis.montant_total)
  const montantTVA = Math.round(devis.montant_total - montantHT)

  const ligneSeparation = (couleur = '#e5e7eb', epaisseur = '1px', marge = '20px 0') => (
    <div style={{ borderTop: `${epaisseur} solid ${couleur}`, margin: marge }} />
  )

  const statut = devis.statut === 'accepte'
    ? { texte: '✅ ACCEPTÉ', fond: '#f0fdfa', couleur: DEVIS_COULEUR_ACCENT }
    : devis.statut === 'refuse'
      ? { texte: '❌ REFUSÉ', fond: '#fff2f0', couleur: '#ff4d4f' }
      : { texte: '⏳ EN ATTENTE', fond: '#fffbe6', couleur: '#d48806' }

  return (
    <div id="devis-pdf" style={{
      width: '210mm',
      minHeight: '297mm',
      background: 'white',
      boxSizing: 'border-box',
      fontFamily: '"Segoe UI", Arial, sans-serif',
      color: DEVIS_COULEUR_TEXTE,
      fontSize: '13px',
      lineHeight: '1.6'
    }}>
      {/* ── En-tête sombre pleine largeur ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch' }}>
        <div style={{ background: DEVIS_COULEUR_SOMBRE, color: 'white', padding: '26px 30px', flex: '0 0 60%' }}>
          <div style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '2px' }}>
            {(parametres?.nom_entreprise || 'NAFIMAX STORE').toUpperCase()}
          </div>
          {parametres?.slogan && (
            <div style={{ fontSize: '12.5px', color: '#b8c4d9', marginBottom: '14px', letterSpacing: '0.3px' }}>
              {parametres.slogan}
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#dce3f0', lineHeight: '1.9' }}>
            {parametres?.adresse && <div>📍 {parametres.adresse}</div>}
            <div>
              📞 {parametres?.telephone || 'Non configuré'}
              {parametres?.telephone_secondaire ? ` • ${parametres.telephone_secondaire}` : ''}
            </div>
            {parametres?.email && <div>✉️ {parametres.email}</div>}
          </div>
        </div>
        <div style={{ flex: 1, padding: '26px 30px', textAlign: 'right' }}>
          <div style={{ fontSize: '38px', fontWeight: 800, color: DEVIS_COULEUR_SOMBRE, letterSpacing: '1px' }}>DEVIS</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: DEVIS_COULEUR_LABEL, marginTop: '6px' }}>N° {numero}</div>
          <div style={{ fontSize: '11.5px', color: DEVIS_COULEUR_TEXTE_ATTENUE, marginTop: '4px' }}>Émis le {date}</div>
          <div style={{ fontSize: '11.5px', color: DEVIS_COULEUR_TEXTE_ATTENUE }}>Valide jusqu'au {dateExpiration}</div>
        </div>
      </div>

      {/* ── Bandeau d'accent ── */}
      <div style={{ height: '6px', background: DEVIS_COULEUR_ACCENT }} />

      <div style={{ padding: '26px 30px' }}>
        {/* ── Client + détails ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '30px', marginBottom: '4px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: DEVIS_COULEUR_LABEL, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>
              Adressé à
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700 }}>
              {devis.client_nom || 'CLIENT ANONYME'}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: DEVIS_COULEUR_LABEL, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>
              Informations légales
            </div>
            <div style={{ fontSize: '12px', color: DEVIS_COULEUR_TEXTE, lineHeight: '1.8' }}>
              {parametres?.ninea && <div><strong>NINEA :</strong> {parametres.ninea}</div>}
              {parametres?.registre_commerce && <div><strong>RC :</strong> {parametres.registre_commerce}</div>}
              <div><strong>Devise :</strong> Franc CFA (XOF)</div>
            </div>
          </div>
        </div>

        {ligneSeparation()}

        {/* ── Statut ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '18px' }}>
          <span style={{ background: statut.fond, color: statut.couleur, padding: '6px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
            {statut.texte}
          </span>
        </div>

        {/* ── Articles ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4px' }}>
          <thead>
            <tr style={{ background: DEVIS_COULEUR_SOMBRE, color: 'white' }}>
              <th style={{ padding: '13px 14px', textAlign: 'left', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Désignation</th>
              <th style={{ padding: '13px 14px', textAlign: 'center', fontSize: '11.5px', width: '70px' }}>Qté</th>
              <th style={{ padding: '13px 14px', textAlign: 'right', fontSize: '11.5px', width: '110px' }}>Prix unitaire</th>
              <th style={{ padding: '13px 14px', textAlign: 'right', fontSize: '11.5px', width: '120px' }}>Montant</th>
            </tr>
          </thead>
          <tbody>
            {panier.map((item, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f6f8fb', borderBottom: '1px solid #ececec' }}>
                <td style={{ padding: '12px 14px', fontWeight: 700, fontSize: '13px' }}>{item.nom}</td>
                <td style={{ padding: '12px 14px', textAlign: 'center', color: DEVIS_COULEUR_TEXTE_ATTENUE }}>{item.quantite}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', color: DEVIS_COULEUR_TEXTE_ATTENUE }}>{item.prix_unitaire?.toLocaleString()} FCFA</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: DEVIS_COULEUR_SOMBRE }}>{item.total?.toLocaleString()} FCFA</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Conditions + Totaux ── */}
        <div style={{ display: 'flex', gap: '24px', marginTop: '22px' }}>
          <div style={{ flex: 1, background: '#f6f8fb', borderRadius: '8px', padding: '16px 18px', border: '1px solid #ececec' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: DEVIS_COULEUR_LABEL, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Conditions
            </div>
            <div style={{ fontSize: '12px', color: DEVIS_COULEUR_TEXTE }}>
              {devis.notes || 'Devis valable jusqu\'à la date indiquée ci-dessus. Merci de rappeler le numéro de devis lors de votre confirmation.'}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '12.5px' }}>
              <span>Montant HT :</span>
              <span style={{ fontWeight: 700 }}>{montantHT.toLocaleString()} FCFA</span>
            </div>
            {ligneSeparation('#e5e7eb', '1px', '0')}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '12.5px' }}>
              <span>TVA ({parametres?.tva_taux || 18}%) :</span>
              <span style={{ fontWeight: 700 }}>{montantTVA.toLocaleString()} FCFA</span>
            </div>
            {ligneSeparation(DEVIS_COULEUR_ACCENT, '2px', '0 0 12px 0')}
            <div style={{
              display: 'flex', justifyContent: 'space-between', background: DEVIS_COULEUR_ACCENT, color: 'white',
              borderRadius: '8px', padding: '13px 16px', fontSize: '17px', fontWeight: 800
            }}>
              <span>TOTAL TTC</span>
              <span>{devis.montant_total?.toLocaleString()} FCFA</span>
            </div>
          </div>
        </div>

        {/* ── Arrêtée à la somme de ── */}
        <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: '8px', padding: '14px 18px', margin: '22px 0' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>
            Arrêtée à la somme de
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, fontStyle: 'italic' }}>
            {montantEnLettresFCFA(devis.montant_total || 0)}
          </div>
        </div>

        {/* ── Signatures ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '10px' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: DEVIS_COULEUR_TEXTE_ATTENUE, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Le client
            </div>
            <div style={{ borderTop: '1px solid #d1d5db', width: '160px', margin: '46px auto 0' }} />
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: DEVIS_COULEUR_TEXTE_ATTENUE, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Pour {parametres?.nom_entreprise || 'Nafimax'}
            </div>
            <div style={{ borderTop: '1px solid #d1d5db', width: '160px', margin: '46px auto 0' }} />
          </div>
        </div>

        {ligneSeparation('#e5e7eb', '1px', '24px 0 14px 0')}

        {/* ── Pied de page ── */}
        <div style={{ textAlign: 'center', fontSize: '10.5px', color: DEVIS_COULEUR_TEXTE_ATTENUE, fontStyle: 'italic' }}>
          {parametres?.mention_facture || 'Merci pour votre confiance !'}
        </div>
      </div>
    </div>
  )
}

export default Devis