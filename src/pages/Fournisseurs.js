import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Typography, Table, Button, Modal, Form, Input, InputNumber,
  Select, Space, Popconfirm, Tag, message, Row, Col, Card,
  Statistic, Tabs, Drawer, Divider, DatePicker, Badge, Alert,
  Descriptions, Steps, Tooltip, Progress, Checkbox
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  TruckOutlined, ShoppingOutlined, DollarOutlined, WarningOutlined,
  PhoneOutlined, MailOutlined, EnvironmentOutlined, UserOutlined,
  CheckOutlined, EyeOutlined, ClearOutlined, FileTextOutlined,
  PrinterOutlined, LinkOutlined, ClockCircleOutlined, RocketOutlined,
  StarOutlined, InboxOutlined
} from '@ant-design/icons'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { peutAjouter, peutModifier, peutSupprimer } from '../utils/permissions'
import { getDomaine, getDomainTheme } from '../utils/domainConfig'
import BonAchatPDF from '../components/BonAchatPDF'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input
const ipcRenderer = window.ipcRenderer

// ─── Constantes ──────────────────────────────────────────────────────────────

const TYPE_FOURNISSEUR = [
  { value: 'grossiste',    label: '🏭 Grossiste',     color: 'blue'    },
  { value: 'fabricant',    label: '🏗️ Fabricant',     color: 'purple'  },
  { value: 'distributeur', label: '🚛 Distributeur',  color: 'cyan'    },
  { value: 'importateur',  label: '✈️ Importateur',   color: 'gold'    },
  { value: 'producteur',   label: '🌾 Producteur',    color: 'green'   },
  { value: 'autre',        label: '📦 Autre',         color: 'default' }
]

const CONDITIONS_PAIEMENT = [
  'Comptant', '7 jours', '15 jours', '30 jours', '45 jours', '60 jours', '90 jours'
]

const ETAPES = {
  brouillon:    { label: 'Brouillon',    color: 'default', icon: '📝', nextLabel: 'Commander',     step: 0 },
  commandé:     { label: 'Commandé',     color: 'blue',    icon: '📋', nextLabel: 'Expédié',       step: 1 },
  en_livraison: { label: 'En livraison', color: 'orange',  icon: '🚚', nextLabel: 'Réceptionner',  step: 2 },
  reçu:         { label: 'Reçu ✓',       color: 'cyan',    icon: '📦', nextLabel: 'Vérifier',      step: 3 },
  vérifié:      { label: 'Vérifié ✅',   color: 'green',   icon: '✅', nextLabel: null,            step: 4 }
}
const ORDRE_ETAPES = ['brouillon', 'commandé', 'en_livraison', 'reçu', 'vérifié']

const PRIORITES = [
  { value: 'basse',   label: '🟢 Basse',   color: 'success' },
  { value: 'normale', label: '🔵 Normale', color: 'processing' },
  { value: 'haute',   label: '🟡 Haute',   color: 'warning' },
  { value: 'urgente', label: '🔴 Urgente', color: 'error' }
]

// ─── Composant principal ──────────────────────────────────────────────────────

function Fournisseurs({ utilisateur }) {
  const role = utilisateur?.role || 'caissier'

  // États données
  const [fournisseurs, setFournisseurs]   = useState([])
  const [achats, setAchats]               = useState([])
  const [produits, setProduits]           = useState([])
  const [categories, setCategories]       = useState([])
  const [parametres, setParametres]       = useState({})
  const [domaineActive, setDomaineActive] = useState(null)

  // Filtres
  const [rechercheF, setRechercheF]               = useState('')
  const [rechercheA, setRechercheA]               = useState('')
  const [filtreTypeF, setFiltreTypeF]             = useState(null)
  const [filtreStatutA, setFiltreStatutA]         = useState(null)
  const [filtreEtapeA, setFiltreEtapeA]           = useState(null)
  const [filtresFournisseurA, setFiltresFournisseurA] = useState(null)

  // Modals / Drawers
  const [modalFVisible, setModalFVisible]             = useState(false)
  const [modalAVisible, setModalAVisible]             = useState(false)
  const [modalPayerVisible, setModalPayerVisible]     = useState(false)
  const [modalBonVisible, setModalBonVisible]         = useState(false)
  const [drawerFournisseur, setDrawerFournisseur]     = useState(null)
  const [editingF, setEditingF]                       = useState(null)
  const [achatEnPaiement, setAchatEnPaiement]         = useState(null)
  const [bonSelectionne, setBonSelectionne]           = useState(null)

  // Formulaires
  const [formF]     = Form.useForm()
  const [formA]     = Form.useForm()
  const [formPayer] = Form.useForm()

  // Panier achat
  const [panierAchat, setPanierAchat]           = useState([])
  const [produitRecherche, setProduitRecherche] = useState('')
  const [uniteAchatCode, setUniteAchatCode] = useState(null)  // unité choisie pour l'achat (multi-niveaux)
  const [montantPayeAchat, setMontantPayeAchat] = useState(0)
  const [modePaiementAchat, setModePaiementAchat] = useState('especes')
  const [categorieAchatActive, setCategorieAchatActive] = useState(null)
  const [produitActifAchatId, setProduitActifAchatId] = useState(null)
  const [articleLibreVisible, setArticleLibreVisible] = useState(false)
  const [articleLibreNom, setArticleLibreNom] = useState('')
  const [articleLibreUnite, setArticleLibreUnite] = useState('')
  const [articleLibreQte, setArticleLibreQte] = useState(1)
  const [articleLibrePrix, setArticleLibrePrix] = useState(0)

  // UI state
  const [loadingEtapeId, setLoadingEtapeId] = useState(null)
  const [impressionBon, setImpressionBon]   = useState(false)

  const montantTotalAchat = useMemo(
    () => panierAchat.reduce((acc, i) => acc + i.total, 0),
    [panierAchat]
  )

  // ─── Chargement ──────────────────────────────────────────────────────────

  const charger = async () => {
    if (!ipcRenderer) return
    setFournisseurs(await ipcRenderer.invoke('fournisseurs:getAll'))
    setAchats(await ipcRenderer.invoke('achats:getAll'))
  }

  const chargerProduits = async () => {
    if (!ipcRenderer) return
    setProduits(await ipcRenderer.invoke('produits:getAll'))
    setCategories(await ipcRenderer.invoke('categories:getAll'))
  }

  const chargerDomaine = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('domaine:get')
    if (data?.type) setDomaineActive(data.type)
  }

  const chargerParametres = async () => {
    if (!ipcRenderer) return
    setParametres(await ipcRenderer.invoke('parametres:get') || {})
  }

  useEffect(() => {
    charger()
    chargerProduits()
    chargerDomaine()
    chargerParametres()
  }, [])

  const domaine = getDomaine(domaineActive)
  const theme   = getDomainTheme(domaineActive || 'general')

  // ─── Filtrage ─────────────────────────────────────────────────────────────

  const fournisseursFiltres = useMemo(() => {
    let res = [...fournisseurs]
    if (rechercheF) {
      const t = rechercheF.toLowerCase()
      res = res.filter(f =>
        f.nom?.toLowerCase().includes(t) ||
        f.telephone?.toLowerCase().includes(t) ||
        f.contact_nom?.toLowerCase().includes(t)
      )
    }
    if (filtreTypeF) res = res.filter(f => f.type === filtreTypeF)
    return res
  }, [fournisseurs, rechercheF, filtreTypeF])

  const achatsFiltres = useMemo(() => {
    let res = [...achats]
    if (rechercheA) {
      const t = rechercheA.toLowerCase()
      res = res.filter(a =>
        a.fournisseur_nom?.toLowerCase().includes(t) ||
        a.reference?.toLowerCase().includes(t)
      )
    }
    if (filtreStatutA)       res = res.filter(a => a.statut === filtreStatutA)
    if (filtreEtapeA)        res = res.filter(a => (a.etape || 'commandé') === filtreEtapeA)
    if (filtresFournisseurA) res = res.filter(a => a.fournisseur_id === filtresFournisseurA)
    return res
  }, [achats, rechercheA, filtreStatutA, filtreEtapeA, filtresFournisseurA])

  // ─── KPIs globaux ─────────────────────────────────────────────────────────

  const totalDu      = fournisseurs.reduce((a, f) => a + (f.total_du || 0), 0)
  const totalPaye    = fournisseurs.reduce((a, f) => a + (f.total_paye || 0), 0)
  const totalAchats  = achats.reduce((a, b) => a + (b.montant_total || 0), 0)
  const nbEnCours    = achats.filter(a => !['vérifié', 'reçu'].includes(a.etape || '')).length

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const typeInfo = (type) => TYPE_FOURNISSEUR.find(t => t.value === type) || TYPE_FOURNISSEUR[5]

  const statutTag = (statut) => {
    if (statut === 'paye')     return <Tag color="green"  style={{ borderRadius: 10 }}>✅ Payé</Tag>
    if (statut === 'partiel')  return <Tag color="orange" style={{ borderRadius: 10 }}>⚠️ Partiel</Tag>
    return <Tag color="red" style={{ borderRadius: 10 }}>🔴 Impayé</Tag>
  }

  const etapeTag = (etape) => {
    const e = ETAPES[etape] || ETAPES.commandé
    return <Tag color={e.color} style={{ borderRadius: 10, fontSize: 11 }}>{e.icon} {e.label}</Tag>
  }

  const scorePaiement = (achatsDuFourn) => {
    const total = achatsDuFourn.reduce((a, b) => a + (b.montant_total || 0), 0)
    const paye  = achatsDuFourn.reduce((a, b) => a + (b.montant_paye || 0), 0)
    return total > 0 ? Math.round((paye / total) * 100) : 100
  }

  const obtenirCategorieInfo = useCallback(
    (nom) => categories.find(c => c.nom === nom) || { icone: '📦' },
    [categories]
  )


  // ─── Grille d'articles (sélection rapide, façon caisse) ─────────────────────
  const categoriesGrilleAchat = useMemo(() => {
    const noms = [...new Set(produits.map(p => p.categorie || 'Sans catégorie'))]
    return noms.map(nom => ({ nom, icone: obtenirCategorieInfo(nom).icone }))
  }, [produits, obtenirCategorieInfo])

  const produitsGrilleAchat = useMemo(() => {
    let filtres = produits
    if (categorieAchatActive) filtres = filtres.filter(p => (p.categorie || 'Sans catégorie') === categorieAchatActive)
    if (produitRecherche) {
      const t = produitRecherche.toLowerCase()
      filtres = filtres.filter(p => p.nom?.toLowerCase().includes(t) || p.reference?.toLowerCase().includes(t))
    }
    return filtres
  }, [produits, categorieAchatActive, produitRecherche])

  const selectionnerProduitGrilleAchat = (produit) => {
    const unites = Array.isArray(produit.unites_multiples) && produit.unites_multiples.length >= 2
      ? produit.unites_multiples : null
    setProduitActifAchatId(produit.id)
    if (unites) {
      // Par défaut, on propose le plus gros conditionnement (achat en gros).
      setUniteAchatCode(unites[unites.length - 1].code)
      return
    }
    setUniteAchatCode(null)
    ajouterAuPanier(produit.id, 1, null)
  }

  // ─── Réapprovisionnement suggéré (stock ≤ seuil d'alerte) ───────────────────
  // Le stock (déjà chargé pour la grille) sert directement à composer le bon,
  // au lieu de rechercher/retaper article par article ceux qui manquent.
  const produitsEnAlerte = useMemo(
    () => produits.filter(p => p.stock_actuel <= (p.stock_minimum || 0)),
    [produits]
  )
  const [alerteExclus, setAlerteExclus] = useState(new Set())
  const [alerteQteOverride, setAlerteQteOverride] = useState({})

  const suggestionQteReappro = (p) => Math.max(1, Math.ceil((p.stock_minimum || 1) * 2 - p.stock_actuel))

  const ajouterAlertesSelectionnees = () => {
    const aAjouter = produitsEnAlerte.filter(p => !alerteExclus.has(p.id))
    if (aAjouter.length === 0) return
    aAjouter.forEach(p => {
      const qte = alerteQteOverride[p.id] ?? suggestionQteReappro(p)
      // La quantité suggérée est calculée en unité de base (comme stock_actuel
      // et stock_minimum) — on force explicitement cette unité, sinon
      // ajouterAuPanier peut retenir une unité de gros laissée active par une
      // précédente sélection dans la grille et multiplier la quantité par son
      // facteur de conversion, faussant l'impact réel sur le stock.
      const unites = Array.isArray(p.unites_multiples) && p.unites_multiples.length >= 2
        ? p.unites_multiples : null
      const uniteBase = unites
        ? (unites.find(u => u.facteur === 1) || [...unites].sort((a, b) => a.facteur - b.facteur)[0])
        : null
      ajouterAuPanier(p.id, qte, uniteBase?.code || null)
    })
    message.success(`${aAjouter.length} article(s) en stock faible ajouté(s) au bon`)
  }

  // ─── Panier achat ─────────────────────────────────────────────────────────

  const ajouterAuPanier = (produit_id, quantiteEntree, uniteCodeOverride) => {
    if (!produit_id || !quantiteEntree || quantiteEntree <= 0) return
    const produit = produits.find(p => p.id === Number(produit_id))
    if (!produit) return

    // ── Multi-niveaux prioritaire ───────────────────────────────────
    const unites = Array.isArray(produit.unites_multiples) && produit.unites_multiples.length >= 2
      ? produit.unites_multiples : null

    let uniteObj = null
    if (unites) {
      const code = uniteCodeOverride || uniteAchatCode || unites[unites.length - 1].code  // par défaut: plus grande unité
      uniteObj = unites.find(u => u.code === code) || unites[unites.length - 1]
    }

    // ── Fallback : ancien système unite_achat / facteur_conversion ──
    const isDualLegacy = !unites && produit.facteur_conversion > 0 && produit.unite_achat

    let quantiteBase, uniteCode, uniteLabel, facteur
    if (uniteObj) {
      facteur      = uniteObj.facteur
      uniteCode    = uniteObj.code
      uniteLabel   = uniteObj.label
      quantiteBase = quantiteEntree * facteur
    } else if (isDualLegacy) {
      facteur      = produit.facteur_conversion
      uniteCode    = produit.unite_achat
      uniteLabel   = produit.unite_achat
      quantiteBase = quantiteEntree * facteur
    } else {
      facteur      = 1
      uniteCode    = produit.unite || 'pièce'
      uniteLabel   = produit.unite || 'pièce'
      quantiteBase = quantiteEntree
    }

    const prixDefaut = (uniteObj?.prix) || produit.prix_achat || 0

    const existant = panierAchat.find(p => p.produit_id === produit.id && p.unite_achat === uniteCode)
    if (existant) {
      const nqSaisie = (existant.quantite_achat || 0) + quantiteEntree
      const nqBase   = nqSaisie * facteur
      setPanierAchat(panierAchat.map(p =>
        (p.produit_id === produit.id && p.unite_achat === uniteCode)
          ? { ...p, quantite: nqBase, quantite_achat: nqSaisie, total: nqSaisie * p.prix_unitaire }
          : p
      ))
    } else {
      setPanierAchat(prev => [...prev, {
        produit_id:         produit.id,
        nom:                produit.nom,
        reference:          produit.reference || '',
        unite:              produit.unite || 'pièce',   // unité de vente (stock)
        unite_achat:        uniteCode,                  // unité saisie pour l'achat
        unite_achat_label:  uniteLabel,
        facteur_conversion: facteur,
        quantite:           quantiteBase,    // en unité de base — pour le stock
        quantite_achat:     quantiteEntree,  // en unité d'achat — pour l'affichage
        prix_unitaire:      prixDefaut,
        total:              quantiteEntree * prixDefaut
      }])
    }
    formA.resetFields(['produit_id', 'quantite_achat'])
    setUniteAchatCode(null)
    setProduitRecherche('')
  }

  // Article commandé au fournisseur mais absent du catalogue (produit pas
  // encore créé, échantillon, emballage...). Un identifiant négatif unique
  // tient lieu de produit_id — jamais utilisé par un vrai produit (id série
  // positif), donc sans risque de collision avec le reste du panier ou avec
  // la mise à jour de stock (qui ne trouvera simplement aucune ligne à jour).
  // Un simple compteur (pas Date.now(), qui dépasse la limite d'un entier
  // PostgreSQL standard) suffit : l'unicité n'est nécessaire que le temps de
  // composer ce bon, panierAchat étant vidé à chaque ouverture/fermeture.
  const compteurArticleLibre = useRef(0)
  const ajouterArticleLibre = () => {
    if (!articleLibreNom.trim() || !articleLibreQte || articleLibreQte <= 0) return
    compteurArticleLibre.current += 1
    const idLibre = -compteurArticleLibre.current
    setPanierAchat(prev => [...prev, {
      produit_id:         idLibre,
      nom:                articleLibreNom.trim(),
      reference:          '',
      unite:              articleLibreUnite.trim() || 'unité',
      unite_achat:        articleLibreUnite.trim() || 'unité',
      unite_achat_label:  articleLibreUnite.trim() || 'unité',
      facteur_conversion: 1,
      quantite:           articleLibreQte,
      quantite_achat:     articleLibreQte,
      prix_unitaire:      articleLibrePrix || 0,
      total:              articleLibreQte * (articleLibrePrix || 0),
      hors_stock:         true
    }])
    setArticleLibreNom(''); setArticleLibreUnite(''); setArticleLibreQte(1); setArticleLibrePrix(0)
    setArticleLibreVisible(false)
  }

  const retirerDuPanier = (produit_id, uniteCode) =>
    setPanierAchat(panierAchat.filter(p =>
      !(p.produit_id === produit_id && (!uniteCode || p.unite_achat === uniteCode))
    ))

  const modifierPrixPanier = (produit_id, prix, uniteCode) =>
    setPanierAchat(panierAchat.map(p => {
      if (p.produit_id !== produit_id || (uniteCode && p.unite_achat !== uniteCode)) return p
      const base = p.quantite_achat != null ? p.quantite_achat : p.quantite
      return { ...p, prix_unitaire: prix, total: base * prix }
    }))

  const modifierQtePanier = (produit_id, qte, uniteCode) =>
    setPanierAchat(panierAchat.map(p => {
      if (p.produit_id !== produit_id || (uniteCode && p.unite_achat !== uniteCode)) return p
      const facteur  = p.facteur_conversion || 1
      const qteBase  = qte * facteur
      return { ...p, quantite_achat: qte, quantite: qteBase, total: qte * p.prix_unitaire }
    }))

  // ─── CRUD Fournisseur ─────────────────────────────────────────────────────

  const ouvrirModalF = (f = null) => {
    setEditingF(f)
    if (f) formF.setFieldsValue({ ...f, delai_livraison_jours: f.delai_livraison_jours || 7 })
    else formF.resetFields()
    setModalFVisible(true)
  }

  const sauvegarderFournisseur = async (values) => {
    if (!ipcRenderer) return
    if (editingF) {
      await ipcRenderer.invoke('fournisseurs:update', { ...values, id: editingF.id })
      message.success('✅ Fournisseur modifié !')
    } else {
      await ipcRenderer.invoke('fournisseurs:create', values)
      message.success('✅ Fournisseur ajouté !')
    }
    charger()
    setModalFVisible(false)
    setEditingF(null)
    formF.resetFields()
  }

  const supprimerFournisseur = async (id) => {
    await ipcRenderer.invoke('fournisseurs:delete', id)
    message.success('✅ Fournisseur supprimé !')
    charger()
  }

  // ─── CRUD Achat ───────────────────────────────────────────────────────────

  const resetAchat = () => {
    formA.resetFields()
    setPanierAchat([])
    setMontantPayeAchat(0)
    setModePaiementAchat('especes')
    setProduitRecherche('')
    setCategorieAchatActive(null)
    setProduitActifAchatId(null)
    setUniteAchatCode(null)
    setArticleLibreVisible(false)
    setArticleLibreNom(''); setArticleLibreUnite(''); setArticleLibreQte(1); setArticleLibrePrix(0)
    compteurArticleLibre.current = 0
    setAlerteExclus(new Set())
    setAlerteQteOverride({})
  }

  const validerAchat = async (values) => {
    if (panierAchat.length === 0) {
      message.error('❌ Ajoutez au moins un produit !')
      return
    }
    const montantDu = Math.max(0, montantTotalAchat - montantPayeAchat)
    const statut    = montantPayeAchat === 0 ? 'en_attente' : montantDu > 0 ? 'partiel' : 'paye'

    const achat = {
      fournisseur_id:       values.fournisseur_id || null,
      reference:            values.reference || `BC-${Date.now().toString().slice(-6)}`,
      montant_total:        montantTotalAchat,
      montant_paye:         montantPayeAchat,
      montant_du:           montantDu,
      mode_paiement:        modePaiementAchat,
      statut,
      etape:                'commandé',
      priorite:             values.priorite || 'normale',
      notes:                values.notes || '',
      panier:               JSON.stringify(panierAchat),
      date_achat:           values.date_achat ? values.date_achat.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      date_livraison_prevue: values.date_livraison_prevue
        ? values.date_livraison_prevue.format('YYYY-MM-DD')
        : null
    }

    await ipcRenderer.invoke('achats:create', achat)
    message.success(`✅ Bon de commande créé ! Stock mis à jour pour ${panierAchat.length} article(s).`)
    charger()
    chargerProduits()
    setModalAVisible(false)
    resetAchat()
  }

  const supprimerAchat = async (id) => {
    await ipcRenderer.invoke('achats:delete', id)
    message.success('✅ Commande supprimée — stock restauré.')
    charger()
    chargerProduits()
  }

  const changerEtape = async (id, etapeActuelle) => {
    const idx = ORDRE_ETAPES.indexOf(etapeActuelle || 'brouillon')
    if (idx < 0 || idx >= ORDRE_ETAPES.length - 1) return
    const prochaineEtape = ORDRE_ETAPES[idx + 1]
    setLoadingEtapeId(id)
    try {
      await ipcRenderer.invoke('achats:changerEtape', { id, etape: prochaineEtape })
      message.success(`✅ Avancé : "${ETAPES[prochaineEtape]?.label}"`)
      charger()
    } finally {
      setLoadingEtapeId(null)
    }
  }

  const ouvrirPaiement = (achat) => {
    setAchatEnPaiement(achat)
    formPayer.setFieldsValue({ montant_paye_plus: 0 })
    setModalPayerVisible(true)
  }

  const enregistrerPaiement = async (values) => {
    const nouveauPaye = achatEnPaiement.montant_paye + (values.montant_paye_plus || 0)
    const nouveauDu   = Math.max(0, achatEnPaiement.montant_total - nouveauPaye)
    const statut      = nouveauDu === 0 ? 'paye' : 'partiel'
    await ipcRenderer.invoke('achats:update', {
      id:           achatEnPaiement.id,
      montant_paye: nouveauPaye,
      montant_du:   nouveauDu,
      statut
    })
    message.success('✅ Paiement enregistré !')
    setModalPayerVisible(false)
    setAchatEnPaiement(null)
    charger()
  }

  const voirBonAchat = (achat) => {
    setBonSelectionne(achat)
    setModalBonVisible(true)
  }

  const imprimerBonAchat = async () => {
    setImpressionBon(true)
    try {
      const el     = document.getElementById('bon-achat-pdf')
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#fff' })
      const img    = canvas.toDataURL('image/png')
      const pdf    = new jsPDF('p', 'mm', 'a4')
      const w      = 210
      const h      = (canvas.height * w) / canvas.width
      pdf.addImage(img, 'PNG', 0, 0, w, h)
      const num = bonSelectionne?.reference || `BC-${String(bonSelectionne?.id).padStart(4, '0')}`
      pdf.save(`BonCommande-${num}.pdf`)
      message.success('✅ PDF téléchargé !')
    } catch {
      message.error('Erreur génération PDF')
    }
    setImpressionBon(false)
  }

  // ─── Colonnes fournisseurs ─────────────────────────────────────────────────

  const colonneFournisseurs = [
    {
      title: 'Fournisseur', key: 'fournisseur',
      render: (_, f) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, flexShrink: 0,
            background: theme.gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 18, fontWeight: 'bold'
          }}>
            {f.nom?.[0]?.toUpperCase()}
          </div>
          <div>
            <Text strong style={{ display: 'block' }}>{f.nom}</Text>
            <Space size={4}>
              {f.contact_nom && (
                <Text style={{ fontSize: 11, color: '#888' }}>👤 {f.contact_nom}</Text>
              )}
              {f.conditions_paiement && (
                <Tag style={{ fontSize: 10, borderRadius: 8 }} color="geekblue">
                  💳 {f.conditions_paiement}
                </Tag>
              )}
            </Space>
          </div>
        </div>
      )
    },
    {
      title: 'Type', dataIndex: 'type', key: 'type',
      render: (type) => {
        const t = typeInfo(type)
        return <Tag color={t.color} style={{ borderRadius: 10 }}>{t.label}</Tag>
      }
    },
    {
      title: 'Contact', key: 'contact',
      render: (_, f) => (
        <div style={{ fontSize: 12 }}>
          {f.telephone && <div><PhoneOutlined /> {f.telephone}</div>}
          {f.email && <div style={{ color: '#888' }}><MailOutlined /> {f.email}</div>}
          {f.delai_livraison_jours && (
            <div style={{ color: '#888' }}>
              <ClockCircleOutlined /> {f.delai_livraison_jours}j délai livraison
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Commandes', key: 'commandes',
      render: (_, f) => (
        <div style={{ textAlign: 'center' }}>
          <Badge count={f.nb_achats} style={{ background: theme.primaryColor }} showZero />
          {f.derniere_commande && (
            <div style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>
              Dernière: {new Date(f.derniere_commande).toLocaleDateString('fr-FR')}
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Solde dû', dataIndex: 'total_du', key: 'total_du',
      render: (val) => (
        <Text style={{ color: val > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 'bold' }}>
          {val > 0 ? `${val?.toLocaleString()} FCFA` : '✅ Soldé'}
        </Text>
      )
    },
    {
      title: 'Actions', key: 'actions',
      render: (_, f) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />}
            onClick={() => setDrawerFournisseur(f)} style={{ borderRadius: 6 }}>
            Détails
          </Button>
          {peutModifier(role) && (
            <Button type="primary" size="small" icon={<EditOutlined />}
              onClick={() => ouvrirModalF(f)} style={{ borderRadius: 6 }}>
              Modifier
            </Button>
          )}
          {peutSupprimer(role) && (
            <Popconfirm title="Supprimer ce fournisseur ?"
              onConfirm={() => supprimerFournisseur(f.id)} okText="Oui" cancelText="Non">
              <Button danger size="small" icon={<DeleteOutlined />} style={{ borderRadius: 6 }} />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  // ─── Colonnes achats ───────────────────────────────────────────────────────

  const colonneAchats = [
    {
      title: 'Référence', dataIndex: 'reference', key: 'reference',
      render: (val, rec) => (
        <div>
          <Tag style={{
            background: theme.lightBg, border: `1px solid ${theme.borderColor}`,
            color: theme.primaryColor, borderRadius: 6, fontWeight: 'bold'
          }}>
            {val || `BC-${String(rec.id).padStart(4, '0')}`}
          </Tag>
          {rec.priorite && rec.priorite !== 'normale' && (
            <div style={{ marginTop: 3 }}>
              {PRIORITES.find(p => p.value === rec.priorite) && (
                <Badge
                  status={PRIORITES.find(p => p.value === rec.priorite).color}
                  text={
                    <span style={{ fontSize: 10, color: '#888' }}>
                      {PRIORITES.find(p => p.value === rec.priorite).label}
                    </span>
                  }
                />
              )}
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Fournisseur', dataIndex: 'fournisseur_nom', key: 'fournisseur_nom',
      render: (val) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', background: theme.gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 11, fontWeight: 'bold', flexShrink: 0
          }}>
            {val ? val[0].toUpperCase() : '?'}
          </div>
          <Text>{val || '—'}</Text>
        </div>
      )
    },
    {
      title: 'Articles', key: 'articles',
      render: (_, rec) => {
        try {
          const p = JSON.parse(rec.panier || '[]')
          return (
            <div style={{ fontSize: 12 }}>
              {p.slice(0, 2).map((item, i) => (
                <div key={i} style={{ color: '#555' }}>
                  • {item.nom} ×{' '}
                  {item.facteur_conversion
                    ? <>{item.quantite_achat} {item.unite_achat} <span style={{ color: '#13c2c2' }}>(→ {item.quantite} {item.unite})</span></>
                    : <>{item.quantite} {item.unite || 'pcs'}</>
                  }
                </div>
              ))}
              {p.length > 2 && (
                <Text style={{ color: '#1890ff', fontSize: 11 }}>+{p.length - 2} autres</Text>
              )}
            </div>
          )
        } catch { return '—' }
      }
    },
    {
      title: 'Montant', key: 'montant',
      render: (_, rec) => (
        <div>
          <Text strong style={{ color: '#ff4d4f', display: 'block' }}>
            {rec.montant_total?.toLocaleString()} FCFA
          </Text>
          {rec.montant_du > 0 && (
            <Text style={{ color: '#fa8c16', fontSize: 11 }}>
              Dû: {rec.montant_du?.toLocaleString()} FCFA
            </Text>
          )}
        </div>
      )
    },
    {
      title: 'Statut', key: 'statut',
      render: (_, rec) => (
        <Space direction="vertical" size={2}>
          {statutTag(rec.statut)}
          <div style={{ fontSize: 10, color: '#888' }}>
            {rec.date_achat ? new Date(rec.date_achat).toLocaleDateString('fr-FR') : '—'}
          </div>
        </Space>
      )
    },
    {
      title: 'Étape', dataIndex: 'etape', key: 'etape',
      render: (etape, rec) => {
        const e = ETAPES[etape || 'commandé'] || ETAPES.commandé
        const isLast = !e.nextLabel
        return (
          <Space direction="vertical" size={3}>
            {etapeTag(etape || 'commandé')}
            {!isLast && (
              <Button size="small" type="dashed"
                loading={loadingEtapeId === rec.id}
                onClick={() => changerEtape(rec.id, etape || 'commandé')}
                style={{ fontSize: 10, height: 22, borderRadius: 6 }}>
                → {e.nextLabel}
              </Button>
            )}
            {rec.date_livraison_prevue && (
              <Text style={{ fontSize: 10, color: '#888' }}>
                <ClockCircleOutlined /> {new Date(rec.date_livraison_prevue).toLocaleDateString('fr-FR')}
              </Text>
            )}
          </Space>
        )
      }
    },
    {
      title: 'Actions', key: 'actions',
      render: (_, rec) => (
        <Space size={4} wrap>
          <Tooltip title="Voir le Bon de Commande">
            <Button size="small" icon={<FileTextOutlined />}
              onClick={() => voirBonAchat(rec)} style={{ borderRadius: 6 }}>
              Bon
            </Button>
          </Tooltip>
          {rec.montant_du > 0 && peutAjouter(role) && (
            <Button size="small" type="primary" icon={<DollarOutlined />}
              onClick={() => ouvrirPaiement(rec)} style={{ borderRadius: 6 }}>
              Payer
            </Button>
          )}
          {peutSupprimer(role) && (
            <Popconfirm title="Supprimer cette commande ?"
              description="Le stock sera restauré."
              onConfirm={() => supprimerAchat(rec.id)} okText="Oui" cancelText="Non">
              <Button danger size="small" icon={<DeleteOutlined />} style={{ borderRadius: 6 }} />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  // ─── RENDU ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* En-tête */}
      <div style={{
        background: theme.gradient, borderRadius: 16, padding: '20px 28px', marginBottom: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 36, background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '8px 12px' }}>
            🚛
          </div>
          <div>
            <Title level={2} style={{ color: 'white', margin: 0 }}>
              Gestion des Fournisseurs
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
              {domaine ? `${domaine.nom} · ` : ''}Achats, bons de commande & traçabilité fournisseurs
            </Text>
          </div>
        </div>
        <Space>
          {peutAjouter(role) && (
            <Button icon={<ShoppingOutlined />} size="large"
              onClick={() => { resetAchat(); setModalAVisible(true) }}
              style={{
                borderRadius: 10, fontWeight: 'bold', height: 44,
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)', color: 'white'
              }}>
              Nouvelle Commande
            </Button>
          )}
          {peutAjouter(role) && (
            <Button icon={<PlusOutlined />} size="large"
              onClick={() => ouvrirModalF()}
              style={{
                borderRadius: 10, fontWeight: 'bold', height: 44,
                background: 'rgba(255,255,255,0.9)', color: theme.primaryColor, border: 'none'
              }}>
              Nouveau Fournisseur
            </Button>
          )}
        </Space>
      </div>

      {/* KPIs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { titre: 'Fournisseurs',    val: fournisseurs.length, suf: '',      bg: theme.lightBg,  col: theme.primaryColor, icone: <TruckOutlined /> },
          { titre: 'Total Achats',    val: totalAchats,          suf: ' FCFA', bg: '#f6ffed',      col: '#52c41a',          icone: <ShoppingOutlined /> },
          { titre: 'Total Payé',      val: totalPaye,            suf: ' FCFA', bg: '#fff7e6',      col: '#faad14',          icone: <CheckOutlined /> },
          { titre: 'Reste à Payer',   val: totalDu,              suf: ' FCFA', bg: '#fff2f0',      col: '#ff4d4f',          icone: <WarningOutlined /> },
          { titre: 'Cmdes en cours',  val: nbEnCours,            suf: '',      bg: '#f0f5ff',      col: '#722ed1',          icone: <RocketOutlined /> }
        ].map((k, i) => (
          <Col span={i === 4 ? 4 : 5} key={i}>
            <Card style={{ borderRadius: 12, border: 'none', background: k.bg }} bodyStyle={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 22, color: k.col }}>{k.icone}</div>
                <div>
                  <Text style={{ color: '#888', fontSize: 11, display: 'block' }}>{k.titre}</Text>
                  <Text strong style={{ color: k.col, fontSize: k.suf ? 13 : 18 }}>
                    {k.val?.toLocaleString()}{k.suf}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Tabs */}
      <Tabs defaultActiveKey="fournisseurs" items={[
        // ── Onglet Fournisseurs ──────────────────────────────────────────────
        {
          key: 'fournisseurs',
          label: <span><TruckOutlined /> Fournisseurs ({fournisseursFiltres.length})</span>,
          children: (
            <>
              <Card style={{ marginBottom: 12, borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <Row gutter={16} align="middle">
                  <Col span={10}>
                    <Input prefix={<SearchOutlined style={{ color: theme.primaryColor }} />}
                      placeholder="Rechercher nom, téléphone, contact..."
                      allowClear value={rechercheF} onChange={e => setRechercheF(e.target.value)}
                      size="large" />
                  </Col>
                  <Col span={6}>
                    <Select placeholder="Type de fournisseur" allowClear
                      style={{ width: '100%' }} size="large"
                      value={filtreTypeF} onChange={setFiltreTypeF}>
                      {TYPE_FOURNISSEUR.map(t => (
                        <Option key={t.value} value={t.value}>{t.label}</Option>
                      ))}
                    </Select>
                  </Col>
                  <Col span={4}>
                    <Button icon={<ClearOutlined />} size="large"
                      onClick={() => { setRechercheF(''); setFiltreTypeF(null) }}>
                      Réinitialiser
                    </Button>
                  </Col>
                </Row>
              </Card>
              <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <Table dataSource={fournisseursFiltres} columns={colonneFournisseurs}
                  rowKey="id" pagination={{ pageSize: 10 }} />
              </Card>
            </>
          )
        },

        // ── Onglet Commandes ─────────────────────────────────────────────────
        {
          key: 'commandes',
          label: (
            <span>
              <ShoppingOutlined /> Bons de Commande ({achatsFiltres.length})
              {totalDu > 0 && <Badge count="!" style={{ background: '#ff4d4f', marginLeft: 6 }} />}
            </span>
          ),
          children: (
            <>
              <Card style={{ marginBottom: 12, borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <Row gutter={[12, 12]} align="middle">
                  <Col span={7}>
                    <Input prefix={<SearchOutlined style={{ color: theme.primaryColor }} />}
                      placeholder="Rechercher fournisseur ou référence..."
                      allowClear value={rechercheA} onChange={e => setRechercheA(e.target.value)}
                      size="large" />
                  </Col>
                  <Col span={4}>
                    <Select placeholder="Fournisseur" allowClear style={{ width: '100%' }} size="large"
                      value={filtresFournisseurA} onChange={setFiltresFournisseurA} showSearch
                      filterOption={(input, option) => option.children?.toLowerCase().includes(input.toLowerCase())}>
                      {fournisseurs.map(f => (
                        <Option key={f.id} value={f.id}>{f.nom}</Option>
                      ))}
                    </Select>
                  </Col>
                  <Col span={4}>
                    <Select placeholder="Étape" allowClear style={{ width: '100%' }} size="large"
                      value={filtreEtapeA} onChange={setFiltreEtapeA}>
                      {ORDRE_ETAPES.map(e => (
                        <Option key={e} value={e}>{ETAPES[e].icon} {ETAPES[e].label}</Option>
                      ))}
                    </Select>
                  </Col>
                  <Col span={4}>
                    <Select placeholder="Statut paiement" allowClear style={{ width: '100%' }} size="large"
                      value={filtreStatutA} onChange={setFiltreStatutA}>
                      <Option value="paye">✅ Payé</Option>
                      <Option value="partiel">⚠️ Partiel</Option>
                      <Option value="en_attente">🔴 Impayé</Option>
                    </Select>
                  </Col>
                  <Col span={3}>
                    <Button icon={<ClearOutlined />} size="large"
                      onClick={() => {
                        setRechercheA(''); setFiltreStatutA(null)
                        setFiltreEtapeA(null); setFiltresFournisseurA(null)
                      }}>
                      Reset
                    </Button>
                  </Col>
                </Row>
              </Card>
              <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <Table dataSource={achatsFiltres} columns={colonneAchats}
                  rowKey="id" pagination={{ pageSize: 10 }} />
              </Card>
            </>
          )
        }
      ]} />

      {/* ══════ Modal Fournisseur ══════════════════════════════════════════════ */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TruckOutlined style={{ color: theme.primaryColor }} />
            {editingF ? 'Modifier le Fournisseur' : 'Nouveau Fournisseur'}
          </div>
        }
        open={modalFVisible}
        onCancel={() => { setModalFVisible(false); setEditingF(null); formF.resetFields() }}
        footer={null} width={640}
      >
        <Form form={formF} layout="vertical" onFinish={sauvegarderFournisseur} style={{ marginTop: 12 }}>
          {/* Identité */}
          <Divider orientation="left" style={{ fontSize: 12, color: '#888' }}>Identité</Divider>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="nom" label="Nom du fournisseur"
                rules={[{ required: true, message: 'Nom obligatoire' }]}>
                <Input prefix={<TruckOutlined />} placeholder="Ex: Distributions Diallo & Fils" size="large" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="type" label="Type" initialValue="grossiste">
                <Select size="large">
                  {TYPE_FOURNISSEUR.map(t => (
                    <Option key={t.value} value={t.value}>{t.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="ninea" label="NINEA">
                <Input placeholder="NINEA du fournisseur" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="registre_commerce" label="Registre de Commerce">
                <Input placeholder="Numéro RC" />
              </Form.Item>
            </Col>
          </Row>

          {/* Contacts */}
          <Divider orientation="left" style={{ fontSize: 12, color: '#888' }}>Contacts</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="telephone" label="Téléphone">
                <Input prefix={<PhoneOutlined />} placeholder="+221 77 000 00 00" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input prefix={<MailOutlined />} placeholder="contact@fournisseur.sn" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contact_nom" label="Nom du contact">
                <Input prefix={<UserOutlined />} placeholder="Responsable commercial" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="site_web" label="Site Web">
                <Input prefix={<LinkOutlined />} placeholder="https://..." />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="adresse" label="Adresse">
            <Input prefix={<EnvironmentOutlined />} placeholder="Quartier, Ville" />
          </Form.Item>

          {/* Conditions commerciales */}
          <Divider orientation="left" style={{ fontSize: 12, color: '#888' }}>Conditions commerciales</Divider>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="conditions_paiement" label="Conditions de paiement" initialValue="Comptant">
                <Select size="large">
                  {CONDITIONS_PAIEMENT.map(c => (
                    <Option key={c} value={c}>💳 {c}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="delai_livraison_jours" label="Délai livraison habituel" initialValue={7}>
                <InputNumber min={0} max={365} style={{ width: '100%' }} size="large"
                  addonAfter="jours" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Notes internes">
            <TextArea rows={2} placeholder="Conditions spéciales, remarques..." />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => { setModalFVisible(false); formF.resetFields() }}>Annuler</Button>
              <Button type="primary" htmlType="submit"
                style={{ background: theme.primaryColor, borderColor: theme.primaryColor }}>
                {editingF ? '✏️ Modifier' : '➕ Ajouter'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ══════ Modal Commande d'Achat ════════════════════════════════════════ */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: theme.gradient, borderRadius: 8, padding: '6px 10px', color: 'white' }}>
              <ShoppingOutlined />
            </div>
            <span>Nouvelle Commande Fournisseur</span>
          </div>
        }
        open={modalAVisible}
        onCancel={() => { setModalAVisible(false); resetAchat() }}
        footer={null} width={900}
      >
        <Form form={formA} layout="vertical" onFinish={validerAchat}>
          <Row gutter={16}>
            <Col span={10}>
              <Form.Item name="fournisseur_id" label="🚛 Fournisseur">
                <Select showSearch placeholder="Sélectionner un fournisseur..." allowClear size="large"
                  filterOption={(input, option) =>
                    option.children?.toLowerCase().includes(input.toLowerCase())
                  }>
                  {fournisseurs.map(f => (
                    <Option key={f.id} value={f.id}>
                      {typeInfo(f.type).label} {f.nom}
                      {f.conditions_paiement ? ` · ${f.conditions_paiement}` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item name="reference" label="Référence BC">
                <Input placeholder={`BC-${Date.now().toString().slice(-6)}`} />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item name="priorite" label="Priorité" initialValue="normale">
                <Select size="large">
                  {PRIORITES.map(p => (
                    <Option key={p.value} value={p.value}>{p.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="date_achat" label="Date" initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} size="large" format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="date_livraison_prevue" label="📅 Date livraison souhaitée">
                <DatePicker style={{ width: '100%' }} size="large" format="DD/MM/YYYY"
                  placeholder="Optionnel" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="notes" label="Notes de commande">
                <Input placeholder="Conditions, remarques, instructions livraison..." />
              </Form.Item>
            </Col>
          </Row>

          {/* Réapprovisionnement suggéré — stock déjà sous le seuil d'alerte */}
          {produitsEnAlerte.length > 0 && (
            <Card size="small" style={{ marginBottom: 12, borderRadius: 10, background: '#fff2f0', border: '1px solid #ffccc7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text strong style={{ color: '#cf1322', fontSize: 13 }}>
                  ⚠️ {produitsEnAlerte.length} article(s) en stock faible
                </Text>
                <Button size="small" type="primary" danger onClick={ajouterAlertesSelectionnees}>
                  Ajouter la sélection au bon
                </Button>
              </div>
              <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                {produitsEnAlerte.map(p => {
                  const exclu = alerteExclus.has(p.id)
                  return (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
                      borderBottom: '1px solid #ffe1df'
                    }}>
                      <Checkbox checked={!exclu} onChange={(e) => {
                        setAlerteExclus(prev => {
                          const next = new Set(prev)
                          if (e.target.checked) next.delete(p.id); else next.add(p.id)
                          return next
                        })
                      }} />
                      <div style={{ flex: 1, fontSize: 12, minWidth: 0 }}>
                        <Text strong>{p.nom}</Text>
                        <Text style={{ color: '#999', marginLeft: 6, fontSize: 11 }}>
                          (stock: {p.stock_actuel} / seuil: {p.stock_minimum} {p.unite})
                        </Text>
                      </div>
                      <InputNumber size="small" min={0.001} style={{ width: 90 }}
                        value={alerteQteOverride[p.id] ?? suggestionQteReappro(p)}
                        onChange={(v) => setAlerteQteOverride(prev => ({ ...prev, [p.id]: v || 0 }))}
                        disabled={exclu}
                      />
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Sélection d'articles — grille cliquable façon caisse */}
          <Card size="small" style={{
            marginBottom: 12, borderRadius: 10,
            background: theme.lightBg, border: `1px solid ${theme.borderColor}`
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8, color: theme.primaryColor }}>
              {domaine?.icone || '📦'} Ajouter des articles
            </div>
            <Input.Search
              placeholder="🔍 Rechercher un article par nom ou référence..."
              allowClear size="large"
              value={produitRecherche}
              onChange={(e) => setProduitRecherche(e.target.value)}
              style={{ marginBottom: 10 }}
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <Button size="small" shape="round"
                type={!categorieAchatActive ? 'primary' : 'default'}
                onClick={() => setCategorieAchatActive(null)}>
                Tout ({produits.length})
              </Button>
              {categoriesGrilleAchat.map(c => (
                <Button key={c.nom} size="small" shape="round"
                  type={categorieAchatActive === c.nom ? 'primary' : 'default'}
                  onClick={() => setCategorieAchatActive(c.nom)}>
                  {c.icone} {c.nom}
                </Button>
              ))}
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 10, maxHeight: 320, overflowY: 'auto', padding: 4
            }}>
              {produitsGrilleAchat.map(p => {
                const niveaux = Array.isArray(p.unites_multiples) && p.unites_multiples.length >= 2
                  ? [...p.unites_multiples].sort((a, b) => a.facteur - b.facteur)
                  : null
                const prixGros = niveaux ? niveaux[niveaux.length - 1] : null
                const estActif = produitActifAchatId === p.id
                return (
                  <Card
                    key={p.id}
                    hoverable
                    onClick={() => selectionnerProduitGrilleAchat(p)}
                    style={{
                      borderRadius: 12, textAlign: 'center', cursor: 'pointer',
                      border: estActif ? `2px solid ${theme.primaryColor}` : '1px solid #f0f0f0'
                    }}
                    bodyStyle={{ padding: '10px 8px' }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{obtenirCategorieInfo(p.categorie).icone}</div>
                    <Text strong style={{ display: 'block', fontSize: 12, lineHeight: 1.3, minHeight: 30 }}>
                      {p.nom}
                    </Text>
                    <div style={{ color: '#ff4d4f', fontWeight: 'bold', marginTop: 4, fontSize: 12 }}>
                      {p.prix_achat?.toLocaleString()} F
                    </div>
                    {prixGros && (
                      <div style={{ fontSize: 10, color: '#722ed1', marginTop: 1 }}>
                        {prixGros.label} : {prixGros.prix?.toLocaleString()} F
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
                      Stock: {p.stock_actuel} {p.unite || ''}
                    </div>
                  </Card>
                )
              })}
              {produitsGrilleAchat.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 24, color: '#999' }}>
                  Aucun article trouvé
                </div>
              )}
            </div>

            {/* Article commandé mais absent du catalogue (nouveau produit,
                échantillon, emballage...) */}
            {!articleLibreVisible ? (
              <Button type="dashed" block size="small" icon={<PlusOutlined />}
                style={{ marginTop: 10 }}
                onClick={() => setArticleLibreVisible(true)}>
                Article hors catalogue (pas encore dans le stock)
              </Button>
            ) : (
              <Card size="small" style={{ marginTop: 10, borderRadius: 8, background: '#fff7e6', border: '1px solid #ffd591' }}>
                <div style={{ fontSize: 11, color: '#ad6800', marginBottom: 8 }}>
                  📦 Article hors catalogue — ne sera pas ajouté au stock automatiquement
                </div>
                <Row gutter={8}>
                  <Col span={10}>
                    <Input placeholder="Nom de l'article" size="small"
                      value={articleLibreNom} onChange={e => setArticleLibreNom(e.target.value)} />
                  </Col>
                  <Col span={5}>
                    <Input placeholder="Unité (kg, carton...)" size="small"
                      value={articleLibreUnite} onChange={e => setArticleLibreUnite(e.target.value)} />
                  </Col>
                  <Col span={4}>
                    <InputNumber placeholder="Qté" min={0.001} step={1} size="small" style={{ width: '100%' }}
                      value={articleLibreQte} onChange={v => setArticleLibreQte(v || 0)} />
                  </Col>
                  <Col span={5}>
                    <InputNumber placeholder="Prix unit." min={0} size="small" style={{ width: '100%' }}
                      value={articleLibrePrix} onChange={v => setArticleLibrePrix(v || 0)} />
                  </Col>
                </Row>
                <Space style={{ marginTop: 8 }}>
                  <Button type="primary" size="small" onClick={ajouterArticleLibre}
                    disabled={!articleLibreNom.trim() || !articleLibreQte}>
                    Ajouter au bon
                  </Button>
                  <Button size="small" onClick={() => setArticleLibreVisible(false)}>Annuler</Button>
                </Space>
              </Card>
            )}

            {/* Sélecteur d'unité pour un article à plusieurs conditionnements */}
            {(() => {
              const produit = produits.find(p => p.id === produitActifAchatId)
              const unites = produit?.unites_multiples?.length >= 2 ? produit.unites_multiples : null
              if (!unites) return null
              const sorted = [...unites].sort((a, b) => b.facteur - a.facteur)
              return (
                <Card size="small" style={{ marginTop: 10, borderRadius: 8, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                  <div style={{ fontSize: 11, color: '#389e0d', marginBottom: 6 }}>
                    <strong>{produit.nom}</strong> — unité d'approvisionnement :
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {sorted.map(u => {
                      const stockDispo = Math.floor((produit.stock_actuel || 0) / u.facteur)
                      const estActif = uniteAchatCode === u.code
                      return (
                        <Button key={u.code} size="small"
                          type={estActif ? 'primary' : 'default'}
                          onClick={() => setUniteAchatCode(u.code)}
                          style={{ borderRadius: 6, borderColor: estActif ? undefined : '#b7eb8f' }}>
                          <span style={{ fontWeight: 600 }}>{u.label}</span>
                          {u.prix > 0 && <span style={{ marginLeft: 4, fontSize: 10 }}>{u.prix.toLocaleString('fr-FR')} FCFA</span>}
                          <span style={{
                            marginLeft: 5, fontSize: 10,
                            color: estActif ? 'rgba(255,255,255,0.85)' : (stockDispo > 0 ? '#52c41a' : '#faad14')
                          }}>
                            ({stockDispo} en stock)
                          </span>
                        </Button>
                      )
                    })}
                    <Space.Compact>
                      <InputNumber id="qte-achat-multi" size="small" min={0.001} step={1} style={{ width: 90 }} defaultValue={1} />
                      <Button type="primary" size="small" onClick={() => {
                        const input = document.getElementById('qte-achat-multi')
                        const qty = Number(input?.value) || 1
                        ajouterAuPanier(produit.id, qty, uniteAchatCode)
                        setProduitActifAchatId(null)
                      }}>
                        Ajouter
                      </Button>
                    </Space.Compact>
                  </div>
                </Card>
              )
            })()}
          </Card>

          {/* Tableau panier */}
          {panierAchat.length > 0 ? (
            <Table
              dataSource={panierAchat} rowKey={r => `${r.produit_id}_${r.unite_achat || r.unite}`}
              pagination={false} size="small" style={{ marginBottom: 12 }}
              columns={[
                {
                  title: 'Article', dataIndex: 'nom', key: 'nom',
                  render: (val, rec) => (
                    <div>
                      <Text strong>{val}</Text>
                      {rec.hors_stock && (
                        <Tag color="orange" style={{ marginLeft: 6, fontSize: 10, borderRadius: 6 }}>Hors stock</Tag>
                      )}
                      <Text style={{ fontSize: 11, color: '#888', display: 'block' }}>
                        {rec.reference && `Réf: ${rec.reference} · `}Unité: {rec.unite}
                      </Text>
                    </div>
                  )
                },
                {
                  title: 'Qté', dataIndex: 'quantite', key: 'quantite', width: 150,
                  render: (val, rec) => {
                    const qteSaisie  = rec.quantite_achat != null ? rec.quantite_achat : val
                    const uniteLabel = rec.unite_achat_label || rec.unite_achat || rec.unite
                    const isConv     = (rec.facteur_conversion || 1) > 1
                    return (
                      <div>
                        <InputNumber
                          value={qteSaisie}
                          min={0.001} step={0.5} size="small"
                          style={{ width: 118 }}
                          addonAfter={<span style={{ fontSize: 11 }}>{uniteLabel}</span>}
                          onChange={v => modifierQtePanier(rec.produit_id, v || 0.001, rec.unite_achat)}
                        />
                        {isConv && (
                          <div style={{ fontSize: 10, color: '#52c41a', marginTop: 2 }}>
                            → {((qteSaisie || 0) * rec.facteur_conversion).toLocaleString('fr-FR')} {rec.unite}
                          </div>
                        )}
                      </div>
                    )
                  }
                },
                {
                  title: 'P.U. Achat (FCFA)', dataIndex: 'prix_unitaire', key: 'prix_unitaire', width: 160,
                  render: (val, rec) => (
                    <InputNumber value={val} min={0} size="small" style={{ width: 140 }}
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      onChange={v => modifierPrixPanier(rec.produit_id, v || 0)} />
                  )
                },
                {
                  title: 'Total', dataIndex: 'total', key: 'total', width: 130,
                  render: (val) => (
                    <Text strong style={{ color: '#ff4d4f' }}>{val?.toLocaleString()} FCFA</Text>
                  )
                },
                {
                  title: '', key: 'del', width: 36,
                  render: (_, rec) => (
                    <Button danger size="small" icon={<DeleteOutlined />}
                      onClick={() => retirerDuPanier(rec.produit_id, rec.unite_achat)} />
                  )
                }
              ]}
              footer={() => (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Text strong style={{ fontSize: 16, color: '#ff4d4f' }}>
                    Total commande : {montantTotalAchat.toLocaleString()} FCFA
                  </Text>
                </div>
              )}
            />
          ) : (
            <div style={{
              textAlign: 'center', padding: 24, background: '#fafbfc',
              borderRadius: 8, marginBottom: 12, color: '#ccc'
            }}>
              <InboxOutlined style={{ fontSize: 32 }} />
              <p style={{ margin: '8px 0 0' }}>Aucun article ajouté</p>
            </div>
          )}

          <Divider />

          {/* Règlement */}
          <Card size="small" style={{ borderRadius: 10, background: '#fafbfc', marginBottom: 12 }}
            title={<Text strong>💰 Règlement fournisseur</Text>}>
            <Row gutter={[16, 12]}>
              <Col span={24}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong style={{ fontSize: 14 }}>💵 Montant versé aujourd'hui</Text>
                  <Space>
                    <Button size="small" onClick={() => setMontantPayeAchat(0)}>À crédit</Button>
                    <Button size="small" type="primary" ghost
                      onClick={() => setMontantPayeAchat(montantTotalAchat)}>
                      Tout payer
                    </Button>
                  </Space>
                </div>
                <InputNumber
                  value={montantPayeAchat} onChange={v => setMontantPayeAchat(v || 0)}
                  min={0} max={montantTotalAchat} style={{ width: '100%' }} size="large"
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={str => parseInt(str.replace(/\D/g, ''), 10) || 0}
                  placeholder="0" precision={0} />
              </Col>
              <Col span={24}>
                <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                  🏦 Mode de paiement
                </Text>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { key: 'especes',      label: '💵 Espèces'      },
                    { key: 'wave',         label: '🌊 Wave'          },
                    { key: 'orange_money', label: '🟠 Orange Money'  },
                    { key: 'cheque',       label: '📝 Chèque'        }
                  ].map(m => (
                    <Button key={m.key} size="large"
                      type={modePaiementAchat === m.key ? 'primary' : 'default'}
                      onClick={() => setModePaiementAchat(m.key)}
                      style={{ height: 44, fontWeight: 'bold', borderRadius: 8, fontSize: 12 }}>
                      {m.label}
                    </Button>
                  ))}
                </div>
              </Col>
              <Col span={24}>
                <Card size="small" style={{
                  background: (montantTotalAchat - montantPayeAchat) > 0 ? '#fff2f0' : '#f6ffed',
                  border: `2px solid ${(montantTotalAchat - montantPayeAchat) > 0 ? '#ff7875' : '#95de64'}`,
                  borderRadius: 8
                }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Statistic title="Total BC" value={montantTotalAchat} suffix="FCFA"
                        valueStyle={{ color: '#ff4d4f', fontSize: 14 }} />
                    </Col>
                    <Col span={8}>
                      <Statistic title="Versé" value={montantPayeAchat} suffix="FCFA"
                        valueStyle={{ color: '#52c41a', fontSize: 14 }} />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title={montantTotalAchat - montantPayeAchat > 0 ? '⚠️ Reste dû' : '✅ Soldé'}
                        value={Math.max(0, montantTotalAchat - montantPayeAchat)} suffix="FCFA"
                        valueStyle={{
                          color: (montantTotalAchat - montantPayeAchat) > 0 ? '#fa8c16' : '#52c41a',
                          fontSize: 14, fontWeight: 'bold'
                        }} />
                    </Col>
                  </Row>
                </Card>
              </Col>
            </Row>
          </Card>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => { setModalAVisible(false); resetAchat() }}>Annuler</Button>
              <Button type="primary" htmlType="submit" size="large"
                disabled={panierAchat.length === 0}
                style={{ background: theme.primaryColor, borderColor: theme.primaryColor }}>
                ✅ Créer le Bon de Commande
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ══════ Modal Bon de Commande PDF ════════════════════════════════════ */}
      <Modal
        title={
          <Space>
            <div style={{
              background: theme.gradient, borderRadius: 6,
              padding: '4px 10px', color: 'white', fontSize: 13
            }}>
              📋
            </div>
            <span>Bon de Commande Fournisseur</span>
            {bonSelectionne && (
              <Tag color="blue">
                {bonSelectionne.reference || `BC-${String(bonSelectionne.id).padStart(4, '0')}`}
              </Tag>
            )}
            {bonSelectionne && etapeTag(bonSelectionne.etape)}
          </Space>
        }
        open={modalBonVisible}
        onCancel={() => { setModalBonVisible(false); setBonSelectionne(null) }}
        width={920}
        footer={[
          <Button key="fermer" onClick={() => setModalBonVisible(false)}>Fermer</Button>,
          <Button key="pdf" type="primary" icon={<PrinterOutlined />}
            loading={impressionBon} onClick={imprimerBonAchat}
            style={{ background: theme.primaryColor, border: 'none' }}>
            Télécharger PDF
          </Button>
        ]}
      >
        {bonSelectionne && (
          <BonAchatPDF
            achat={bonSelectionne}
            fournisseur={fournisseurs.find(f => f.id === bonSelectionne.fournisseur_id) || {}}
            parametres={parametres}
          />
        )}
      </Modal>

      {/* ══════ Modal Paiement ════════════════════════════════════════════════ */}
      <Modal
        title={<><DollarOutlined style={{ color: '#52c41a' }} /> Enregistrer un paiement</>}
        open={modalPayerVisible}
        onCancel={() => { setModalPayerVisible(false); setAchatEnPaiement(null) }}
        footer={null} width={420}
      >
        {achatEnPaiement && (
          <Form form={formPayer} layout="vertical" onFinish={enregistrerPaiement}>
            <Alert
              message={`Fournisseur : ${achatEnPaiement.fournisseur_nom || '—'}`}
              description={
                <div>
                  <div>Total : <strong>{achatEnPaiement.montant_total?.toLocaleString()} FCFA</strong></div>
                  <div>Déjà payé : <strong style={{ color: '#52c41a' }}>{achatEnPaiement.montant_paye?.toLocaleString()} FCFA</strong></div>
                  <div>Reste : <strong style={{ color: '#ff4d4f' }}>{achatEnPaiement.montant_du?.toLocaleString()} FCFA</strong></div>
                </div>
              }
              type="info" showIcon style={{ marginBottom: 16 }} />
            <Form.Item name="montant_paye_plus" label="Montant à payer"
              rules={[{ required: true, message: 'Montant obligatoire' }]}>
              <InputNumber min={1} max={achatEnPaiement.montant_du}
                style={{ width: '100%' }} size="large"
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                addonAfter="FCFA"
                placeholder={`Max: ${achatEnPaiement.montant_du?.toLocaleString()} FCFA`} />
            </Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setModalPayerVisible(false)}>Annuler</Button>
              <Button type="primary" htmlType="submit"
                style={{ background: '#52c41a', borderColor: '#52c41a' }}>
                ✅ Confirmer le paiement
              </Button>
            </Space>
          </Form>
        )}
      </Modal>

      {/* ══════ Drawer Détails Fournisseur ════════════════════════════════════ */}
      <Drawer
        title={
          drawerFournisseur ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: theme.gradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 'bold', fontSize: 16
              }}>
                {drawerFournisseur.nom?.[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 'bold' }}>{drawerFournisseur.nom}</div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  {typeInfo(drawerFournisseur.type).label}
                </div>
              </div>
            </div>
          ) : 'Détails'
        }
        open={!!drawerFournisseur}
        onClose={() => setDrawerFournisseur(null)}
        width={520}
      >
        {drawerFournisseur && (() => {
          const achatsDuFourn  = achats.filter(a => a.fournisseur_id === drawerFournisseur.id)
          const totalDuFourn   = achatsDuFourn.reduce((a, b) => a + (b.montant_du || 0), 0)
          const totalPayeFourn = achatsDuFourn.reduce((a, b) => a + (b.montant_paye || 0), 0)
          const totalFourn     = achatsDuFourn.reduce((a, b) => a + (b.montant_total || 0), 0)
          const montantMoyen   = achatsDuFourn.length > 0 ? Math.round(totalFourn / achatsDuFourn.length) : 0
          const score          = scorePaiement(achatsDuFourn)
          const t              = typeInfo(drawerFournisseur.type)

          return (
            <>
              {/* Infos commerciales */}
              <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Type">
                  <Tag color={t.color}>{t.label}</Tag>
                </Descriptions.Item>
                {drawerFournisseur.telephone && (
                  <Descriptions.Item label="Téléphone">
                    <PhoneOutlined /> {drawerFournisseur.telephone}
                  </Descriptions.Item>
                )}
                {drawerFournisseur.email && (
                  <Descriptions.Item label="Email">
                    <MailOutlined /> {drawerFournisseur.email}
                  </Descriptions.Item>
                )}
                {drawerFournisseur.contact_nom && (
                  <Descriptions.Item label="Contact">
                    <UserOutlined /> {drawerFournisseur.contact_nom}
                  </Descriptions.Item>
                )}
                {drawerFournisseur.adresse && (
                  <Descriptions.Item label="Adresse">
                    <EnvironmentOutlined /> {drawerFournisseur.adresse}
                  </Descriptions.Item>
                )}
                {drawerFournisseur.conditions_paiement && (
                  <Descriptions.Item label="Paiement">
                    💳 {drawerFournisseur.conditions_paiement}
                  </Descriptions.Item>
                )}
                {drawerFournisseur.delai_livraison_jours != null && (
                  <Descriptions.Item label="Délai livraison">
                    <ClockCircleOutlined /> {drawerFournisseur.delai_livraison_jours} jours
                  </Descriptions.Item>
                )}
                {drawerFournisseur.ninea && (
                  <Descriptions.Item label="NINEA">{drawerFournisseur.ninea}</Descriptions.Item>
                )}
                {drawerFournisseur.registre_commerce && (
                  <Descriptions.Item label="RC">{drawerFournisseur.registre_commerce}</Descriptions.Item>
                )}
                {drawerFournisseur.site_web && (
                  <Descriptions.Item label="Site Web">
                    <a href={drawerFournisseur.site_web} target="_blank" rel="noreferrer">
                      <LinkOutlined /> {drawerFournisseur.site_web}
                    </a>
                  </Descriptions.Item>
                )}
                {drawerFournisseur.notes && (
                  <Descriptions.Item label="Notes">{drawerFournisseur.notes}</Descriptions.Item>
                )}
              </Descriptions>

              {/* KPIs fournisseur */}
              <Row gutter={[10, 10]} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <Card size="small" style={{ background: theme.lightBg, borderRadius: 8, textAlign: 'center' }}>
                    <Text style={{ color: '#888', fontSize: 11, display: 'block' }}>Commandes</Text>
                    <Text strong style={{ color: theme.primaryColor, fontSize: 20 }}>
                      {achatsDuFourn.length}
                    </Text>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" style={{ background: '#f6ffed', borderRadius: 8, textAlign: 'center' }}>
                    <Text style={{ color: '#888', fontSize: 11, display: 'block' }}>Total payé</Text>
                    <Text strong style={{ color: '#52c41a', fontSize: 13 }}>
                      {totalPayeFourn.toLocaleString()}
                    </Text>
                    <Text style={{ color: '#aaa', fontSize: 10 }}> FCFA</Text>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small" style={{ background: totalDuFourn > 0 ? '#fff2f0' : '#f6ffed', borderRadius: 8, textAlign: 'center' }}>
                    <Text style={{ color: '#888', fontSize: 11, display: 'block' }}>Reste dû</Text>
                    <Text strong style={{ color: totalDuFourn > 0 ? '#ff4d4f' : '#52c41a', fontSize: 13 }}>
                      {totalDuFourn.toLocaleString()}
                    </Text>
                    <Text style={{ color: '#aaa', fontSize: 10 }}> FCFA</Text>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" style={{ background: '#fff7e6', borderRadius: 8 }}>
                    <Text style={{ color: '#888', fontSize: 11, display: 'block' }}>Moy. par commande</Text>
                    <Text strong style={{ color: '#fa8c16', fontSize: 13 }}>
                      {montantMoyen.toLocaleString()} FCFA
                    </Text>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" style={{
                    background: score >= 80 ? '#f6ffed' : score >= 50 ? '#fff7e6' : '#fff2f0',
                    borderRadius: 8
                  }}>
                    <Text style={{ color: '#888', fontSize: 11, display: 'block' }}>
                      <StarOutlined /> Score paiement
                    </Text>
                    <Progress
                      percent={score}
                      size="small"
                      strokeColor={score >= 80 ? '#52c41a' : score >= 50 ? '#faad14' : '#ff4d4f'}
                      format={p => <span style={{ fontSize: 11 }}>{p}%</span>}
                    />
                  </Card>
                </Col>
              </Row>

              {/* Historique commandes */}
              <Divider style={{ margin: '12px 0' }}>
                Historique commandes ({achatsDuFourn.length})
              </Divider>
              {achatsDuFourn.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#bbb', padding: 24 }}>
                  <ShoppingOutlined style={{ fontSize: 28, display: 'block', marginBottom: 8 }} />
                  Aucune commande pour ce fournisseur
                </div>
              ) : (
                achatsDuFourn.map(a => {
                  const panier = (() => { try { return JSON.parse(a.panier || '[]') } catch { return [] } })()
                  const e      = ETAPES[a.etape || 'commandé'] || ETAPES.commandé
                  return (
                    <Card key={a.id} size="small" style={{ marginBottom: 10, borderRadius: 10 }}
                      styles={{ body: { padding: '10px 14px' } }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Space wrap size={4} style={{ marginBottom: 4 }}>
                            <Text strong style={{ fontSize: 13 }}>
                              {a.reference || `BC-${String(a.id).padStart(4, '0')}`}
                            </Text>
                            <Tag color={e.color} style={{ fontSize: 10, borderRadius: 8 }}>
                              {e.icon} {e.label}
                            </Tag>
                            {statutTag(a.statut)}
                          </Space>
                          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>
                            📅 {a.date_achat ? new Date(a.date_achat).toLocaleDateString('fr-FR') : '—'}
                            {a.date_livraison_prevue && (
                              <span style={{ marginLeft: 8 }}>
                                → Livraison: {new Date(a.date_livraison_prevue).toLocaleDateString('fr-FR')}
                              </span>
                            )}
                          </div>
                          {/* Détail articles */}
                          <div style={{ background: '#fafbfc', borderRadius: 6, padding: '6px 8px' }}>
                            {panier.map((item, i) => (
                              <div key={i} style={{
                                display: 'flex', justifyContent: 'space-between',
                                fontSize: 11, color: '#555', marginBottom: 2
                              }}>
                                <span>• {item.nom} × {item.quantite} {item.unite || 'pcs'}</span>
                                <span style={{ color: '#1890ff', fontWeight: 'bold' }}>
                                  {item.total?.toLocaleString()} FCFA
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 12 }}>
                          <Text strong style={{ display: 'block', color: '#ff4d4f', fontSize: 14 }}>
                            {a.montant_total?.toLocaleString()} FCFA
                          </Text>
                          {a.montant_paye > 0 && (
                            <Text style={{ fontSize: 11, color: '#52c41a', display: 'block' }}>
                              ✅ {a.montant_paye?.toLocaleString()} FCFA
                            </Text>
                          )}
                          {a.montant_du > 0 && (
                            <Text style={{ fontSize: 11, color: '#fa8c16', display: 'block' }}>
                              Dû: {a.montant_du?.toLocaleString()} FCFA
                            </Text>
                          )}
                          <Button size="small" style={{ marginTop: 6, borderRadius: 6 }}
                            icon={<FileTextOutlined />}
                            onClick={() => voirBonAchat(a)}>
                            Bon PDF
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )
                })
              )}
            </>
          )
        })()}
      </Drawer>
    </div>
  )
}

export default Fournisseurs
