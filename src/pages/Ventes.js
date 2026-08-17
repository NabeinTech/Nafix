import React, { useState, useEffect, useMemo } from 'react'
import {
  Typography, Table, Button, Modal, Form,
  Select, InputNumber, Space, Tag, Card,
  Divider, Row, Col, message, Input, DatePicker,
  Statistic, Alert, Popconfirm, Badge
} from 'antd'
import {
  DeleteOutlined, CheckOutlined, EditOutlined,
  UserAddOutlined, SearchOutlined, ClearOutlined,
  DollarOutlined, CreditCardOutlined, FileTextOutlined,
  ExclamationOutlined, InfoCircleOutlined, LockOutlined,
  ShoppingCartOutlined, RiseOutlined, PrinterOutlined, ThunderboltOutlined,
  WarningOutlined, PlusOutlined
} from '@ant-design/icons'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import NouveauClientModal from '../components/NouveauClientModal'
import NouveauProduitRapideModal from '../components/NouveauProduitRapideModal'
import FiltresPeriode from '../components/FiltresPeriode'
import FactureSelector, { getFormatFacture } from '../components/FactureSelector'
import { peutAjouter, peutFaireSurVente } from '../utils/permissions'
import { getDomaine, getDomainTheme } from '../utils/domainConfig'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select
const { Search } = Input
const { RangePicker } = DatePicker
const ipcRenderer = window.ipcRenderer

function Ventes({ utilisateur }) {
  const role = utilisateur?.role || 'caissier'
  const [vue, setVue] = useState('caisse') // caisse | historique
  const [categorieActive, setCategorieActive] = useState(null)
  const [ventes, setVentes] = useState([])
  const [ventesFiltres, setVentesFiltres] = useState([])
  const [produits, setProduits] = useState([])
  const [categories, setCategories] = useState([])
  const [clients, setClients] = useState([])
  const [modalVisible, setModalVisible] = useState(false)
  const [clientModalVisible, setClientModalVisible] = useState(false)
  const [produitModalVisible, setProduitModalVisible] = useState(false)
  const [panier, setPanier] = useState([])
  const [panelVenteAgrandi, setPanelVenteAgrandi] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [filtrePaiement, setFiltrePaiement] = useState(null)
  const [filtreDates, setFiltreDates] = useState(null)
  const [filtrePeriode, setFiltrePeriode] = useState(null)
  const [filtrePaiementStatut, setFiltrePaiementStatut] = useState(null)
  const [form] = Form.useForm()
  const [montantPaye, setMontantPaye] = useState(0)
  const [modePaiement, setModePaiement] = useState('especes')
  const [estPret, setEstPret] = useState(false)
  const [datePret, setDatePret] = useState(null)
  const [editingProduitId, setEditingProduitId] = useState(null)
  const [editingPrix, setEditingPrix] = useState(null)
  const [editingQuantite, setEditingQuantite] = useState(null)
  const [produitsAjoutes, setProduitsAjoutes] = useState(new Set())
  const [produitRecherche, setProduitRecherche] = useState('')
  const [escompte, setEscompte] = useState(0)
  const [typeEscompte, setTypeEscompte] = useState('pourcentage')
  const [editingVente, setEditingVente] = useState(null)
  const [parametres, setParametres] = useState({})
  const [domaineActive, setDomaineActive] = useState(null)
  const [uniteSelectionnee, setUniteSelectionnee]   = useState('pièce')
  const [uniteVenteCode, setUniteVenteCode]         = useState(null)   // code de l'unité choisie (multi-niveaux)
  const [produitActifId, setProduitActifId]         = useState(null)   // id du produit sélectionné dans le form
  const [factureAutoVisible, setFactureAutoVisible] = useState(false)
  const [factureAuto, setFactureAuto] = useState(null)
  const [impressionFacture, setImpressionFacture] = useState(false)
  const [modeRapide, setModeRapide] = useState(true)
  const [quantiteRapide, setQuantiteRapide] = useState(1)
  const [paiementAuto, setPaiementAuto] = useState(true)
  const [enregistrement, setEnregistrement] = useState(false)
  const [clientSelectionne, setClientSelectionne] = useState(null)
  // Champs spécifiques par domaine
  const [numeroTable, setNumeroTable] = useState('')
  const [typeCommande, setTypeCommande] = useState('sur_place')
  const [refChantier, setRefChantier] = useState('')

  const estCaissier = role === 'caissier'
  const aujourdhuiStr = new Date().toISOString().slice(0, 10)

  const montantTotal = useMemo(() =>
    panier.reduce((acc, item) => {
      // total est toujours la source principale
      // fallback: quantite_saisie (unité choisie) × prix — jamais quantite (unité de base)
      const qteSaisie = item.quantite_saisie != null ? item.quantite_saisie : item.quantite
      const t = item.total != null ? item.total : (item.prix_unitaire || 0) * (qteSaisie || 1)
      return acc + (Number(t) || 0)
    }, 0), [panier])

  const paymentState = useMemo(() => {
    const escompteAmount = typeEscompte === 'pourcentage'
      ? Math.floor(montantTotal * (escompte / 100))
      : escompte
    const totalApresEscompte = Math.max(0, montantTotal - escompteAmount)
    const total = totalApresEscompte
    const paye = estPret ? 0 : montantPaye
    const reste = Math.max(0, total - paye)
    const monnaie = Math.max(0, paye - total)
    const estValide = estPret
      ? datePret !== null
      : (paye > 0 && paye <= total) || paye >= total
    return {
      total, totalAvantEscompte: montantTotal, escompteAmount,
      paye, reste, monnaie, estValide,
      estComplet: paye >= total,
      estPartiel: paye > 0 && paye < total,
      estExact: paye === total,
      message: estPret ? 'Prêt créé' : paye === 0 ? 'Aucun paiement'
        : reste === 0 && monnaie === 0 ? '✅ Paiement exact'
        : reste > 0 ? `⚠️ ${reste.toLocaleString()} FCFA dû`
        : `💵 Monnaie: ${monnaie.toLocaleString()} FCFA`,
      couleur: estPret ? 'default' : paye === 0 ? 'error' : reste > 0 ? 'warning' : 'success',
      icon: estPret ? <FileTextOutlined /> : paye >= total ? <CheckOutlined /> : <CreditCardOutlined />
    }
  }, [montantTotal, montantPaye, estPret, datePret, escompte, typeEscompte])

  const chargerVentes = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('ventes:getAll')
    setVentes(data)
    setVentesFiltres(data)
  }

  const chargerProduits = async () => {
    if (!ipcRenderer) return
    setProduits(await ipcRenderer.invoke('produits:getAll'))
  }

  const chargerCategories = async () => {
    if (!ipcRenderer) return
    setCategories(await ipcRenderer.invoke('categories:getAll'))
  }

  const chargerClients = async () => {
    if (!ipcRenderer) return
    setClients(await ipcRenderer.invoke('clients:getAll'))
  }

  const chargerParametres = async () => {
    if (!ipcRenderer) return
    setParametres(await ipcRenderer.invoke('parametres:get') || {})
  }

  const chargerDomaine = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('domaine:get')
    if (data?.type) setDomaineActive(data.type)
  }

  useEffect(() => {
    chargerVentes(); chargerProduits(); chargerCategories(); chargerClients(); chargerParametres(); chargerDomaine()
  }, [])

  useEffect(() => {
    if (domaineActive === 'btp' || domaineActive === 'quincaillerie') {
      setModeRapide(false)
    } else {
      setModeRapide(true)
    }
  }, [domaineActive])

  const champsFactureManquants = useMemo(() => {
    const champs = []
    if (!parametres?.registre_commerce?.trim()) champs.push('Registre de Commerce')
    if (!parametres?.ninea?.trim()) champs.push('NINEA')
    if (!parametres?.telephone?.trim()) champs.push('Telephone 1')
    if (!parametres?.telephone_secondaire?.trim()) champs.push('Telephone 2')
    return champs
  }, [parametres])

  const verifierConformiteFacture = () => {
    if (champsFactureManquants.length === 0) return true
    message.error(
      `Configuration incomplète pour la facture: ${champsFactureManquants.join(', ')}. ` +
      'Veuillez compléter ces champs dans Parametres > Entreprise.'
    )
    return false
  }

  // Envoie directement la facture à l'imprimante physique (boîte de dialogue
  // native), sans passer par un fichier PDF à ouvrir/imprimer manuellement.
  const imprimerFactureDirectement = async (factureCible = factureAuto) => {
    if (!verifierConformiteFacture()) return
    if (!factureCible) {
      message.error('Facture introuvable')
      return
    }
    setImpressionFacture(true)
    try {
      const element = document.getElementById('facture-pdf')
      if (!element) throw new Error('Apercu facture non disponible')
      const resultat = await ipcRenderer.invoke('impression:imprimerHTML', {
        html: element.outerHTML,
        numero: `F-${String(factureCible.id).padStart(4, '0')}`,
        client: factureCible.client_nom || 'Client de passage',
        montant: factureCible.montant_total,
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
    setImpressionFacture(false)
  }

  const imprimerFactureAutoPDF = async (factureCible = factureAuto) => {
    if (!verifierConformiteFacture()) return
    if (!factureCible) {
      message.error('Facture introuvable')
      return
    }

    setImpressionFacture(true)
    try {
      const element = document.getElementById('facture-pdf')
      if (!element) throw new Error('Apercu facture non disponible')

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      })
      const imgData = canvas.toDataURL('image/png')
      const formatDoc = getFormatFacture(domaineActive, parametres?.format_facture)
      const isTicket = formatDoc === 'ticket'
      const isA5 = formatDoc === 'a5'
      const pdfWidth = isTicket ? 80 : isA5 ? 148 : 210
      const pdfHeight = isTicket
        ? (canvas.height * pdfWidth) / canvas.width
        : isA5 ? 210 : 297
      const pdf = isTicket
        ? new jsPDF('p', 'mm', [pdfWidth, (canvas.height * pdfWidth) / canvas.width])
        : new jsPDF('p', 'mm', isA5 ? 'a5' : 'a4')
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, isTicket ? (canvas.height * pdfWidth) / canvas.width : pdfHeight)

      const prefix = isTicket ? 'T' : 'F'
      const numero = `${prefix}-${String(factureCible.id).padStart(4, '0')}`
      pdf.save(`${isTicket ? 'Ticket' : 'Facture'}-${numero}.pdf`)
      message.success('✅ Facture PDF téléchargée')
    } catch (error) {
      message.error('Erreur lors de la génération du PDF')
    }
    setImpressionFacture(false)
  }

  useEffect(() => {
    form.setFieldValue('mode_paiement', modePaiement)
  }, [modePaiement, form])

  // montantPaye reste à 0 à l'ouverture — le caissier saisit le montant reçu
  useEffect(() => {
    if (modalVisible) setMontantPaye(0)
  }, [modalVisible])

  useEffect(() => {
    let resultat = [...ventes]
    // Le caissier voit uniquement les ventes du jour
    if (estCaissier) {
      resultat = resultat.filter(v => {
        const d = v.created_at ? new Date(v.created_at).toISOString().slice(0, 10) : ''
        return d === aujourdhuiStr
      })
    }
    if (recherche) {
      const terme = recherche.toLowerCase()
      resultat = resultat.filter(v =>
        v.client_nom?.toLowerCase().includes(terme) || String(v.id).includes(terme))
    }
    if (filtrePaiement) resultat = resultat.filter(v => v.mode_paiement === filtrePaiement)
    // Filtre de statut de paiement
    if (filtrePaiementStatut) {
      resultat = resultat.filter(v => {
        if (filtrePaiementStatut === 'credit') return v.est_pret === 1
        if (filtrePaiementStatut === 'partiel') return v.montant_du > 0 && v.est_pret === 0
        if (filtrePaiementStatut === 'complet') return v.montant_du === 0 && v.est_pret === 0
        return true
      })
    }
    // Filtre de période (shortcuts jour/semaine/mois/année)
    if (filtrePeriode?.[0] && filtrePeriode?.[1]) {
      const debut = filtrePeriode[0].startOf('day')
      const fin = filtrePeriode[1].endOf('day')
      resultat = resultat.filter(v => {
        const date = dayjs(v.created_at)
        return date.isAfter(debut) && date.isBefore(fin)
      })
    }
    // Filtre de plage de dates (RangePicker)
    if (filtreDates?.[0] && filtreDates?.[1]) {
      const debut = filtreDates[0].startOf('day')
      const fin = filtreDates[1].endOf('day')
      resultat = resultat.filter(v => {
        const date = dayjs(v.created_at)
        return date.isAfter(debut) && date.isBefore(fin)
      })
    }
    setVentesFiltres(resultat)
  }, [recherche, filtrePaiement, filtreDates, filtrePeriode, filtrePaiementStatut, ventes, estCaissier, aujourdhuiStr])

  const reinitialiserFiltres = () => {
    setRecherche(''); setFiltrePaiement(null); setFiltreDates(null); setFiltrePeriode(null); setFiltrePaiementStatut(null)
  }

  const calculerTotalFiltres = () =>
    ventesFiltres.reduce((acc, v) => acc + (v.montant_total || 0), 0)

  const ajouterAuPanier = (values) => {
    const produit = produits.find(p => p.id === values.produit_id)
    if (!produit || !values.quantite || values.quantite <= 0) return

    // ── Résolution unité / conversion vers unité de base ────────────
    const unites = Array.isArray(produit.unites_multiples) && produit.unites_multiples.length >= 2
      ? produit.unites_multiples
      : null

    let uniteObj = null
    if (unites) {
      // Défaut : unité de base (facteur=1) ou celle qui correspond à produit.unite
      const uniteBase = unites.find(u => u.facteur === 1)
                     || unites.find(u => u.code === produit.unite)
                     || [...unites].sort((a, b) => a.facteur - b.facteur)[0]
      const code = values.unite_code || uniteVenteCode || uniteBase?.code
      uniteObj = unites.find(u => u.code === code) || uniteBase
    }

    const facteur       = uniteObj ? uniteObj.facteur : 1
    const uniteCode     = uniteObj ? uniteObj.code    : (produit.unite || 'pièce')
    const uniteLabel    = uniteObj ? uniteObj.label   : (produit.unite || 'pièce')
    const prixUnitaire  = uniteObj ? (uniteObj.prix || produit.prix_vente) : produit.prix_vente
    const qteBase       = values.quantite * facteur   // en unité de base (stock)

    const existant = panier.find(p => p.produit_id === produit.id && p.unite === uniteCode)
    if (existant) {
      const nvSaisie = (existant.quantite_saisie || existant.quantite / (existant.facteur_unite || 1)) + values.quantite
      const nvBase   = nvSaisie * facteur
      setPanier(panier.map(p =>
        (p.produit_id === produit.id && p.unite === uniteCode)
          ? { ...p, quantite: nvBase, quantite_saisie: nvSaisie, total: nvSaisie * p.prix_unitaire }
          : p
      ))
    } else {
      setPanier(prev => [...prev, {
        produit_id:      produit.id,
        nom:             produit.nom,
        reference:       produit.reference || '',
        unite:           uniteCode,
        unite_label:     uniteLabel,
        facteur_unite:   facteur,
        quantite:        qteBase,         // en unité de base — pour le stock
        quantite_saisie: values.quantite, // ce que l'utilisateur a tapé — pour l'affichage
        prix_unitaire:   prixUnitaire,
        total:           values.quantite * prixUnitaire
      }])
      setProduitsAjoutes(new Set([...produitsAjoutes, produit.id]))
    }
    setUniteSelectionnee(uniteLabel)
  }

  const modifierQuantitePanier = (produit_id, nouvelleQuantite, uniteCode) => {
    if (nouvelleQuantite <= 0) { retirerDuPanier(produit_id, uniteCode); return }
    setPanier(panier.map(p => {
      if (p.produit_id !== produit_id || (uniteCode && p.unite !== uniteCode)) return p
      const facteur = p.facteur_unite || 1
      const qteBase = nouvelleQuantite * facteur
      return { ...p, quantite: qteBase, quantite_saisie: nouvelleQuantite, total: nouvelleQuantite * p.prix_unitaire }
    }))
    setEditingProduitId(null); setEditingQuantite(null)
  }

  const modifierPrixPanier = (produit_id, nouveauPrix, uniteCode) => {
    setPanier(panier.map(p => {
      if (p.produit_id !== produit_id || (uniteCode && p.unite !== uniteCode)) return p
      const qteSaisie = p.quantite_saisie != null ? p.quantite_saisie : p.quantite
      return { ...p, prix_unitaire: nouveauPrix, total: qteSaisie * nouveauPrix }
    }))
    setEditingProduitId(null); setEditingPrix(null)
  }

  const retirerDuPanier = (produit_id, uniteCode) =>
    setPanier(panier.filter(p => !(p.produit_id === produit_id && (!uniteCode || p.unite === uniteCode))))

  const obtenirCategorieInfo = React.useCallback((nomCategorie) => {
    return categories.find(c => c.nom === nomCategorie) || { icone: '📦', nom: 'Sans catégorie' }
  }, [categories])


  // Liste plate + catégories dispo pour la grille de caisse (clic pour ajouter)
  // Filtre sur la colonne `domaine` de la catégorie (même logique que la
  // section Produits) plutôt que sur une liste figée de noms — sinon toute
  // catégorie personnalisée créée par l'utilisateur (ex: "Divers") disparaît
  // silencieusement de la caisse alors qu'elle existe bien dans le catalogue.
  const produitsDuDomaine = useMemo(() => {
    if (!domaineActive || domaineActive === 'general') return produits
    const catsDuDomaine = new Set(
      categories.filter(c => c.domaine === domaineActive).map(c => c.nom)
    )
    return produits.filter(p => catsDuDomaine.has(p.categorie))
  }, [produits, categories, domaineActive])

  // Catégories utilisables pour un produit créé rapidement depuis la caisse —
  // doivent appartenir au domaine actif, sinon le produit resterait invisible
  // dans cette même grille juste après sa création.
  const categoriesDomaineActif = useMemo(
    () => (!domaineActive || domaineActive === 'general')
      ? categories
      : categories.filter(c => c.domaine === domaineActive),
    [categories, domaineActive]
  )

  const categoriesGrille = useMemo(() => {
    const noms = [...new Set(produitsDuDomaine.map(p => p.categorie || 'Sans catégorie'))]
    return noms.map(nom => ({ nom, icone: obtenirCategorieInfo(nom).icone }))
  }, [produitsDuDomaine, obtenirCategorieInfo])

  const produitsGrille = useMemo(() => {
    let filtres = produitsDuDomaine
    if (categorieActive) filtres = filtres.filter(p => (p.categorie || 'Sans catégorie') === categorieActive)
    if (produitRecherche) {
      const terme = produitRecherche.toLowerCase()
      filtres = filtres.filter(p =>
        p.nom?.toLowerCase().includes(terme) ||
        p.reference?.toLowerCase().includes(terme))
    }
    return filtres
  }, [produitsDuDomaine, categorieActive, produitRecherche])

  const selectionnerProduitGrille = (produit) => {
    const unites = Array.isArray(produit.unites_multiples) && produit.unites_multiples.length >= 2
      ? produit.unites_multiples
      : null
    setProduitActifId(produit.id)
    if (unites) {
      const base = unites.find(u => u.facteur === 1)
                || unites.find(u => u.code === produit.unite)
                || [...unites].sort((a, b) => a.facteur - b.facteur)[0]
      setUniteVenteCode(base.code)
      setUniteSelectionnee(base.label)
      // Produit à plusieurs unités : on laisse choisir le niveau avant d'ajouter.
      return
    }
    setUniteVenteCode(null)
    if (produit.unite) setUniteSelectionnee(produit.unite)
    ajouterAuPanier({ produit_id: produit.id, quantite: quantiteRapide, unite_code: null })
  }

  const validerVente = async (values, options = {}) => {
    const { continuer = false } = options
    if (panier.length === 0) { message.error('❌ Le panier est vide !'); return }
    if (montantTotal <= 0) { message.error('❌ Montant invalide'); return }
    if (!modePaiement) { message.error('❌ Choisissez un mode de paiement'); return }
    if (estPret && !datePret) { message.error('❌ Sélectionnez une date de remboursement'); return }
    const isAvoir = modePaiement === 'avoir'
    if (!estPret && !isAvoir && montantPaye <= 0) { message.error('❌ Montant payé doit être > 0'); return }
    if ((paymentState.estPartiel || estPret) && !values.client_id) {
      message.error('❌ Client obligatoire pour paiement partiel ou crédit !'); return
    }
    // Pour le mode avoir, le montant total est prélevé du compte prépayé (pas de cash)
    const montantPayeEffectif = isAvoir ? paymentState.total : (estPret ? 0 : Math.min(montantPaye, paymentState.total))
    const montantRecuEffectif = isAvoir ? paymentState.total : (estPret ? 0 : montantPaye)
    const montantDuEffectif   = isAvoir ? 0 : paymentState.reste
    const vente = {
      client_id: values.client_id || null,
      mode_paiement: estPret ? 'pret' : modePaiement,
      montant_total_original: paymentState.totalAvantEscompte,
      escompte_montant: paymentState.escompteAmount,
      escompte_type: typeEscompte,
      escompte_pourcentage: typeEscompte === 'pourcentage' ? escompte : 0,
      montant_total: paymentState.total,
      montant_paye: montantPayeEffectif,
      montant_recu: montantRecuEffectif,
      montant_du: montantDuEffectif,
      est_pret: estPret ? 1 : 0,
      est_partiel: paymentState.estPartiel ? 1 : 0,
      date_pret: estPret ? datePret?.format('YYYY-MM-DD') : null,
      panier: JSON.stringify(panier),
      vendeur: utilisateur?.nom || utilisateur?.username || null,
      notes: (() => {
        const n = {}
        if (isRestaurant) { if (numeroTable) n.table = numeroTable; if (typeCommande) n.type = typeCommande }
        if (isAlimentaire && typeCommande) n.type = typeCommande
        if (isBTP && refChantier) n.chantier = refChantier
        return Object.keys(n).length ? JSON.stringify(n) : null
      })()
    }
    setEnregistrement(true)
    try {
      if (editingVente) {
        // ── MODE ÉDITION ──────────────────────────────────────────
        await ipcRenderer.invoke('ventes:fullUpdate', { ...vente, id: editingVente.id })
        message.success('✅ Vente V-' + String(editingVente.id).padStart(4, '0') + ' mise à jour !')
        setPanier([]); form.resetFields(); setModalVisible(false); resetPaymentState()
        setClientSelectionne(null); setEditingVente(null)
        chargerVentes()
        return
      }

      // ── MODE CRÉATION ─────────────────────────────────────────
      const result = await ipcRenderer.invoke('ventes:create', vente)
      let msg = estPret
        ? `✅ Crédit: ${paymentState.total.toLocaleString()} FCFA — dû le ${datePret.format('DD/MM/YYYY')}`
        : paymentState.estPartiel
          ? `✅ Partiel ! Payé: ${paymentState.paye.toLocaleString()} FCFA, Dû: ${paymentState.reste.toLocaleString()} FCFA`
          : `✅ Vente: ${paymentState.total.toLocaleString()} FCFA`
      message.success(msg)

      const client = clients.find(c => c.id === vente.client_id)
      const factureGeneree = {
        id: result?.id || Date.now(),
        client_nom: client?.nom || 'Client anonyme',
        mode_paiement: vente.mode_paiement,
        montant_total: vente.montant_total,
        montant_paye: vente.montant_paye,
        montant_recu: vente.montant_recu,
        montant_du: vente.montant_du,
        est_pret: vente.est_pret,
        panier: vente.panier,
        created_at: new Date().toISOString()
      }

      Modal.confirm({
        title: 'Imprimer la facture ?',
        content: `Vente de ${paymentState.total.toLocaleString('fr-FR')} FCFA enregistrée.`,
        okText: 'Oui, imprimer',
        cancelText: 'Plus tard',
        onOk: () => {
          if (!verifierConformiteFacture()) return
          setFactureAuto(factureGeneree)
          setFactureAutoVisible(true)
          setTimeout(() => imprimerFactureDirectement(factureGeneree), 500)
        }
      })

      if (ipcRenderer && ipcRenderer.send) {
        ipcRenderer.send('statistiques:refresh')
      }
      if (continuer) {
        setPanier([])
        form.resetFields(['produit_id', 'quantite', 'client_id'])
        setClientSelectionne(null)
        setMontantPaye(0)
        setPaiementAuto(true)
        setDatePret(null)
        setEstPret(false)
        setModePaiement('especes')
        message.success('✅ Vente enregistrée. Prêt pour la vente suivante.')
      } else {
        setPanier([]); form.resetFields(); setModalVisible(false); resetPaymentState()
        setClientSelectionne(null)
      }
      chargerVentes()
    } catch (error) {
      message.error(`❌ Erreur: ${error.message}`)
    } finally {
      setEnregistrement(false)
    }
  }

  const validerEtContinuer = () => {
    form.validateFields().then((values) => {
      validerVente(values, { continuer: true })
    })
  }

  const resetPaymentState = () => {
    setMontantPaye(0); setModePaiement('especes'); setEstPret(false); setDatePret(null)
    setProduitRecherche(''); setEditingProduitId(null); setEditingPrix(null)
    setProduitActifId(null); setUniteVenteCode(null)
    setEditingQuantite(null); setEscompte(0); setTypeEscompte('pourcentage')
    setNumeroTable(''); setTypeCommande('sur_place'); setRefChantier('')
  }

  const supprimerVente = async (id) => {
    if (!peutFaireSurVente(role, 'supprimer')) {
      message.error('❌ Permission refusée'); return
    }
    try {
      await ipcRenderer.invoke('ventes:delete', id)
      message.success('✅ Vente supprimée'); chargerVentes()
    } catch (error) { message.error(`❌ Erreur: ${error.message}`) }
  }

  // 🛠️ Ouvrir modal modification complète
  const ouvrirModification = (vente) => {
    if (!peutFaireSurVente(role, 'modifier')) {
      message.error('❌ Vous n\'avez pas la permission de modifier une vente')
      return
    }
    // Pré-remplir le panier
    const panierVente = (() => {
      try { return JSON.parse(vente.panier || '[]') } catch { return [] }
    })()
    setPanier(panierVente)

    // Client
    const clientTrouve = clients.find(c => c.id === vente.client_id) || null
    setClientSelectionne(clientTrouve)
    form.setFieldValue('client_id', vente.client_id || undefined)

    // Type de transaction
    const isPret = vente.est_pret === 1
    setEstPret(isPret)
    if (isPret) {
      setModePaiement('especes')
      setMontantPaye(0)
      setDatePret(vente.date_pret ? dayjs(vente.date_pret) : null)
    } else {
      setModePaiement(vente.mode_paiement || 'especes')
      setMontantPaye(vente.montant_paye || 0)
      setDatePret(null)
    }

    // Escompte
    const et = vente.escompte_type || 'pourcentage'
    setTypeEscompte(et)
    setEscompte(et === 'pourcentage' ? (vente.escompte_pourcentage || 0) : (vente.escompte_montant || 0))

    setPaiementAuto(false)
    setEditingVente(vente)
    setModalVisible(true)
  }


  const domaine = getDomaine(domaineActive)
  const theme = getDomainTheme(domaineActive || 'general')

  // Helpers domaine
  const isRestaurant = domaineActive === 'restauration'
  const isAlimentaire = domaineActive === 'alimentaire'
  const isTicketDomain = isRestaurant || isAlimentaire
  const isBTP = domaineActive === 'btp' || domaineActive === 'quincaillerie'

  // Stats pour les cartes
  const totalCA = ventes.reduce((acc, v) => acc + (v.montant_total || 0), 0)
  const ventesCredit = ventes.filter(v => v.est_pret).length
  const montantDu = ventes.reduce((acc, v) => acc + (v.montant_du || 0), 0)

  // Stats du jour pour le caissier
  const ventesAujourdhui = ventes.filter(v => {
    const d = v.created_at ? new Date(v.created_at).toISOString().slice(0, 10) : ''
    return d === aujourdhuiStr
  })
  const caJour = ventesAujourdhui.reduce((acc, v) => acc + (v.montant_total || 0), 0)
  const ventesJourCount = ventesAujourdhui.length
  const panierMoyenJour = ventesJourCount > 0 ? caJour / ventesJourCount : 0

  const columns = [
    {
      title: 'N° Vente',
      dataIndex: 'id',
      key: 'id',
      render: (id) => (
        <Tag style={{
          background: '#e6f7ff', border: '1px solid #91d5ff',
          color: '#1890ff', borderRadius: 6, fontWeight: 'bold'
        }}>
          V-{String(id).padStart(4, '0')}
        </Tag>
      )
    },
    {
      title: 'Client',
      dataIndex: 'client_nom',
      key: 'client_nom',
      render: (val) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1890ff, #722ed1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 12, fontWeight: 'bold', flexShrink: 0
          }}>
            {val ? val[0].toUpperCase() : 'A'}
          </div>
          <Text>{val || 'Client anonyme'}</Text>
        </div>
      )
    },
    {
      title: 'Montant',
      dataIndex: 'montant_total',
      key: 'montant_total',
      render: (val) => (
        <Text strong style={{ color: '#52c41a', fontSize: 14 }}>
          {val?.toLocaleString()} FCFA
        </Text>
      )
    },
    {
      title: 'Statut',
      key: 'statut_paiement',
      render: (_, record) => {
        if (record.est_pret) {
          return <Tag color="orange" style={{ borderRadius: 12 }}>📋 Crédit</Tag>
        } else if (record.montant_du > 0) {
          return <Tag color="red" style={{ borderRadius: 12 }}>⚠️ Partiel — {record.montant_du?.toLocaleString()} FCFA dû</Tag>
        }
        return <Tag color="green" style={{ borderRadius: 12 }}>✅ Complet</Tag>
      }
    },
    {
      title: 'Paiement',
      dataIndex: 'mode_paiement',
      key: 'mode_paiement',
      render: (val) => (
        <Tag color={
          val === 'especes' ? 'green' : val === 'wave' ? 'blue' :
          val === 'orange_money' ? 'orange' : val === 'cheque' ? 'purple' :
          val === 'avoir' ? 'cyan' : 'default'
        } style={{ borderRadius: 12 }}>
          {val === 'especes' ? '💵 Espèces' : val === 'wave' ? '🌊 Wave' :
           val === 'orange_money' ? '🟠 Orange Money' : val === 'cheque' ? '📝 Chèque' :
           val === 'avoir' ? '🏦 Compte prépayé' : val}
        </Tag>
      )
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val) => new Date(val).toLocaleDateString('fr-FR')
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          {peutFaireSurVente(role, 'modifier') && (
            <Button type="primary" size="small" icon={<EditOutlined />}
              onClick={() => ouvrirModification(record)}
            >
              Modifier
            </Button>
          )}
{peutFaireSurVente(role, 'supprimer') && (
            <Popconfirm
              title="Supprimer cette vente ?"
              description={`Montant: ${record.montant_total?.toLocaleString()} FCFA`}
              onConfirm={() => supprimerVente(record.id)}
              okText="Oui" cancelText="Non" okButtonProps={{ danger: true }}
            >
              <Button danger size="small" icon={<DeleteOutlined />}>Supprimer</Button>
            </Popconfirm>
          )}
          {!peutFaireSurVente(role, 'modifier') && !peutFaireSurVente(role, 'supprimer') && (
            <Button type="text" size="small" icon={<LockOutlined />} style={{ color: '#8c8c8c' }} disabled>
              Verrouillé
            </Button>
          )}
        </Space>
      )
    }
  ]

  const colonnesPanier = [
    ...(isBTP ? [{
      title: 'Réf.',
      dataIndex: 'reference',
      key: 'reference',
      width: 75,
      render: (val) => (
        <Text style={{ fontSize: 10, color: '#8c8c8c', fontFamily: 'monospace' }}>
          {val || '—'}
        </Text>
      )
    }] : []),
    {
      title: 'Produit', dataIndex: 'nom', key: 'nom',
      render: (val) => <Text strong>{val}</Text>
    },
    {
      title: 'Qté',
      dataIndex: 'quantite',
      key: 'quantite',
      render: (val, record) => {
        // Afficher quantite_saisie (en unité choisie) si disponible
        const qteSaisie = record.quantite_saisie != null ? record.quantite_saisie : val
        const uniteAff  = record.unite_label || record.unite || 'pièce'
        const isMulti   = record.facteur_unite > 1
        return (
        editingProduitId === record.produit_id && editingQuantite !== null ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <InputNumber value={editingQuantite} onChange={setEditingQuantite}
              min={0.001} step={1} precision={2}
              size="small" style={{ width: 90 }} autoFocus />
            <Button size="small" type="primary"
              onClick={() => modifierQuantitePanier(record.produit_id, editingQuantite, record.unite)}>✓</Button>
            <Button size="small"
              onClick={() => { setEditingProduitId(null); setEditingQuantite(null) }}>✗</Button>
          </div>
        ) : (
          <div>
            <Tag color="blue" style={{ cursor: 'pointer', borderRadius: 8 }}
              onClick={() => { setEditingProduitId(record.produit_id); setEditingQuantite(qteSaisie) }}>
              {qteSaisie} {uniteAff} ✏️
            </Tag>
            {isMulti && (
              <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 2 }}>
                = {val} {record.facteur_unite && record.unite_label ? (
                  // trouver l'unité de base
                  (() => {
                    const produit = produits.find(p => p.id === record.produit_id)
                    const base = produit?.unites_multiples?.find(u => u.facteur === 1)
                    return base?.label || 'u. base'
                  })()
                ) : record.unite}
              </div>
            )}
          </div>
        )
        )
      }
    },
    {
      title: 'Prix Unit.',
      dataIndex: 'prix_unitaire',
      key: 'prix_unitaire',
      render: (val, record) => {
        const uniteAff = record.unite_label || record.unite || 'pièce'
        return (
        editingProduitId === record.produit_id && editingQuantite === null ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <InputNumber value={editingPrix} onChange={setEditingPrix}
              min={0} size="small" style={{ width: 100 }} autoFocus />
            <Button size="small" type="primary"
              onClick={() => modifierPrixPanier(record.produit_id, editingPrix, record.unite)}>✓</Button>
            <Button size="small"
              onClick={() => { setEditingProduitId(null); setEditingPrix(null) }}>✗</Button>
          </div>
        ) : (
          <Text style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={() => { setEditingProduitId(record.produit_id); setEditingPrix(val) }}>
            {val?.toLocaleString()} FCFA/{uniteAff} ✏️
          </Text>
        )
        )
      }
    },
    {
      title: 'Total', dataIndex: 'total', key: 'total',
      render: (val) => <Text strong style={{ color: '#52c41a' }}>{val?.toLocaleString()} FCFA</Text>
    },
    {
      title: '', key: 'action',
      render: (_, record) => (
        <Button danger size="small" icon={<DeleteOutlined />}
          onClick={() => retirerDuPanier(record.produit_id, record.unite)} />
      )
    }
  ]

  // ── Corps partagé (grille produits + ticket de caisse) ──────────────
  // Utilisé à la fois en plein écran (nouvelle vente) et dans la fenêtre de
  // modification d'une vente passée — pour ne jamais dupliquer cette logique.
  const renderCorpsCaisse = () => (
    <Row gutter={20} align="top">
      {/* ── Colonne gauche : catalogue produits ── */}
      <Col xs={24} lg={panelVenteAgrandi ? 6 : 14} style={{ transition: 'all 0.25s ease' }}>
        <Card style={{ borderRadius: 12, marginBottom: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
          bodyStyle={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text strong style={{ fontSize: 15 }}>{domaine?.icone || '📦'} {domaine?.nom || 'Catalogue'}</Text>
            {!isTicketDomain && (
              <Button size="small" type={modeRapide ? 'primary' : 'default'}
                onClick={() => setModeRapide(!modeRapide)}>
                {modeRapide ? '⚡ Rapide' : '📝 Détaillé'}
              </Button>
            )}
          </div>
          <Search
            placeholder="Rechercher un produit ou une référence..."
            allowClear size="large" prefix={<SearchOutlined style={{ color: theme.primaryColor }} />}
            value={produitRecherche}
            onChange={(e) => setProduitRecherche(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button size="small" shape="round"
              type={!categorieActive ? 'primary' : 'default'}
              onClick={() => setCategorieActive(null)}>
              Tout ({produitsDuDomaine.length})
            </Button>
            {categoriesGrille.map(c => (
              <Button key={c.nom} size="small" shape="round"
                type={categorieActive === c.nom ? 'primary' : 'default'}
                onClick={() => setCategorieActive(c.nom)}>
                {c.icone} {c.nom}
              </Button>
            ))}
          </div>
        </Card>

        {/* Grille de produits — clic pour ajouter au panier */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 10, maxHeight: 460, overflowY: 'auto', padding: 4, marginBottom: 12
        }}>
          {produitsGrille.map(p => {
            const enCommande = Number(p.en_commande) || 0
            const stockDispo = Math.max(0, p.stock_actuel - enCommande)
            const epuise = stockDispo <= 0
            const estActif = produitActifId === p.id
            const niveaux = Array.isArray(p.unites_multiples) && p.unites_multiples.length >= 2
              ? [...p.unites_multiples].sort((a, b) => a.facteur - b.facteur)
              : null
            // Pour un produit multi-niveaux, le "prix_vente" générique peut être
            // trompeur (obsolète ou différent du prix réel du niveau de base) —
            // on affiche le vrai prix du niveau de base + qu'il existe du gros.
            const prixBase = niveaux ? (niveaux[0].prix || p.prix_vente) : p.prix_vente
            const prixGros = niveaux ? niveaux[niveaux.length - 1] : null
            return (
              <Card
                key={p.id}
                hoverable={!epuise}
                onClick={() => !epuise && selectionnerProduitGrille(p)}
                style={{
                  borderRadius: 12, textAlign: 'center', cursor: epuise ? 'not-allowed' : 'pointer',
                  opacity: epuise ? 0.5 : 1,
                  border: estActif ? `2px solid ${theme.primaryColor}` : '1px solid #f0f0f0',
                  transition: 'transform 0.1s',
                  position: 'relative'
                }}
                bodyStyle={{ padding: '12px 8px' }}
              >
                {niveaux && (
                  <Tag color="purple" style={{
                    position: 'absolute', top: 4, right: 4, margin: 0,
                    fontSize: 9, lineHeight: '14px', padding: '0 4px', borderRadius: 6
                  }}>
                    {niveaux.length} tarifs
                  </Tag>
                )}
                <div style={{ fontSize: 26, marginBottom: 4 }}>{obtenirCategorieInfo(p.categorie).icone}</div>
                <Text strong style={{ display: 'block', fontSize: 12.5, lineHeight: 1.3, minHeight: 32 }}>
                  {p.nom}
                </Text>
                <div style={{ color: theme.primaryColor, fontWeight: 'bold', marginTop: 4, fontSize: 13 }}>
                  {niveaux ? `dès ${prixBase?.toLocaleString()} F` : `${prixBase?.toLocaleString()} F`}
                </div>
                {prixGros && (
                  <div style={{ fontSize: 10.5, color: '#722ed1', marginTop: 1 }}>
                    {prixGros.label} : {prixGros.prix?.toLocaleString()} F
                  </div>
                )}
                <div style={{ fontSize: 10.5, color: epuise ? '#ff4d4f' : '#8c8c8c', marginTop: 2 }}>
                  {epuise ? 'Rupture' : `${stockDispo} ${p.unite || ''}`}
                </div>
              </Card>
            )
          })}
          {produitsGrille.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: '#8c8c8c' }}>
              <div style={{ marginBottom: 12 }}>Aucun produit trouvé{produitRecherche ? ` pour « ${produitRecherche} »` : ''}</div>
              {peutAjouter(role) && (
                <Button type="dashed" icon={<PlusOutlined />} onClick={() => setProduitModalVisible(true)}>
                  Créer "{produitRecherche || 'ce produit'}" et l'ajouter à la vente
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Sélecteur d'unité pour un produit à plusieurs niveaux de vente */}
        {(() => {
          const produit = produits.find(p => p.id === produitActifId)
          const unites = produit?.unites_multiples?.length >= 2 ? produit.unites_multiples : null
          if (!unites) return null
          const sorted = [...unites].sort((a, b) => a.facteur - b.facteur)
          return (
            <Card size="small" style={{ marginBottom: 12, borderRadius: 10, border: `1px solid ${theme.borderColor}` }}>
              <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8 }}>
                <strong>{produit.nom}</strong> — choisir le niveau de vente :
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {sorted.map(u => {
                  const stockDispo = Math.floor((produit.stock_actuel || 0) / u.facteur)
                  const estActif = uniteVenteCode === u.code
                  const estEpuise = stockDispo === 0
                  return (
                    <Button key={u.code} size="middle"
                      type={estActif ? 'primary' : 'default'}
                      disabled={estEpuise}
                      onClick={() => { setUniteVenteCode(u.code); setUniteSelectionnee(u.label) }}
                      style={{ borderRadius: 8, opacity: estEpuise ? 0.45 : 1 }}>
                      <span style={{ fontWeight: 600 }}>{u.label}</span>
                      {u.prix > 0 && <span style={{ marginLeft: 4, fontSize: 11 }}>{u.prix.toLocaleString('fr-FR')} FCFA</span>}
                      <span style={{ marginLeft: 6, fontSize: 11, color: estActif ? 'rgba(255,255,255,0.85)' : (estEpuise ? '#ff4d4f' : '#52c41a') }}>
                        ({stockDispo} dispo)
                      </span>
                    </Button>
                  )
                })}
                <Space.Compact>
                  <InputNumber min={0.001} step={1} precision={2} size="middle" style={{ width: 100 }}
                    defaultValue={quantiteRapide}
                    id="qte-unite-multi"
                  />
                  <Button type="primary" onClick={() => {
                    const input = document.getElementById('qte-unite-multi')
                    const val = Number(input?.value) || quantiteRapide
                    ajouterAuPanier({ produit_id: produit.id, quantite: val, unite_code: uniteVenteCode })
                    setProduitActifId(null); setUniteVenteCode(null)
                  }}>
                    Ajouter
                  </Button>
                </Space.Compact>
              </div>
            </Card>
          )
        })()}

        <Card size="small" style={{ borderRadius: 10, marginBottom: 12 }}>
          <Space wrap>
            <Text style={{ fontSize: 12, color: '#666' }}>Quantité rapide :</Text>
            {[1, 2, 3, 5, 10].map((qte) => (
              <Button key={qte} size="small"
                type={quantiteRapide === qte ? 'primary' : 'default'}
                onClick={() => setQuantiteRapide(qte)}>
                x{qte}
              </Button>
            ))}
          </Space>
        </Card>

        {/* Champs spécifiques au domaine */}
        {isRestaurant && (
          <Card size="small" style={{ marginBottom: 12, borderRadius: 10, background: '#fff1f0', border: '1px solid #ffa39e' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 10, color: '#cf1322', fontSize: 13 }}>
              🍽️ Détails de la commande
            </div>
            <Row gutter={12}>
              <Col span={12}>
                <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>N° Table</Text>
                <Select value={numeroTable} onChange={setNumeroTable}
                  placeholder="Choisir table" size="large"
                  style={{ width: '100%' }} allowClear>
                  {[...Array(20)].map((_, i) => (
                    <Option key={i + 1} value={String(i + 1)}>Table {i + 1}</Option>
                  ))}
                  <Option value="comptoir">🪑 Comptoir</Option>
                  <Option value="terrasse">🌿 Terrasse</Option>
                  <Option value="vip">⭐ Salon VIP</Option>
                </Select>
              </Col>
              <Col span={12}>
                <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Type</Text>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { key: 'sur_place', label: '🪑 Sur place' },
                    { key: 'emporter', label: '🥡 À emporter' },
                    { key: 'livraison', label: '🛵 Livraison' }
                  ].map(t => (
                    <Button key={t.key} size="small"
                      type={typeCommande === t.key ? 'primary' : 'default'}
                      danger={typeCommande === t.key}
                      onClick={() => setTypeCommande(t.key)}
                      style={{ flex: 1, fontSize: 11 }}>
                      {t.label}
                    </Button>
                  ))}
                </div>
              </Col>
            </Row>
          </Card>
        )}

        {isBTP && (
          <Card size="small" style={{ marginBottom: 12, borderRadius: 10, background: '#f5f5f5', border: '1px solid #d9d9d9' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#2c3e50', fontSize: 13 }}>
              🏗️ Référence Chantier <span style={{ fontWeight: 'normal', color: '#8c8c8c', fontSize: 11 }}>(optionnel)</span>
            </div>
            <Input value={refChantier} onChange={(e) => setRefChantier(e.target.value)}
              placeholder="Ex: Résidence Palm Beach, Villa N°12, Chantier Route Nationale..."
              size="large" prefix={<span style={{ fontSize: 12 }}>📋</span>} />
          </Card>
        )}
      </Col>

      {/* ── Colonne droite : ticket / caisse (fixe) ── */}
      <Col xs={24} lg={panelVenteAgrandi ? 18 : 10} style={{ transition: 'all 0.25s ease' }}>
        <div style={{ position: 'sticky', top: 12 }}>
          {/* Poignée — double-clic pour agrandir/réduire ce panneau */}
          <div
            onDoubleClick={() => setPanelVenteAgrandi(v => !v)}
            title="Double-cliquez pour agrandir ou réduire ce panneau"
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 12px', marginBottom: 10, borderRadius: 8,
              background: '#fafafa', cursor: 'pointer', userSelect: 'none'
            }}>
            <Text strong style={{ fontSize: 12, color: '#8c8c8c', letterSpacing: 0.5 }}>
              🧾 TICKET DE VENTE
            </Text>
            <Text style={{ fontSize: 11, color: '#bfbfbf' }}>
              {panelVenteAgrandi ? '⤡ Réduire (double-clic)' : '⤢ Agrandir (double-clic)'}
            </Text>
          </div>

          {/* Client */}
          <Form.Item name="client_id" label="👤 Client (optionnel)">
            <Select
              showSearch
              placeholder="🔍 Tapez le nom ou téléphone du client..."
              allowClear
              size="large"
              filterOption={(input, option) => {
                const c = clients.find(x => x.id === option.value)
                if (!c) return false
                const q = input.toLowerCase()
                return (
                  c.nom?.toLowerCase().includes(q) ||
                  c.telephone?.toLowerCase().includes(q) ||
                  c.email?.toLowerCase().includes(q)
                )
              }}
              onSelect={(id) => {
                const c = clients.find(x => x.id === id)
                setClientSelectionne(c || null)
              }}
              onClear={() => setClientSelectionne(null)}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <div style={{ padding: '8px', borderTop: '1px solid #eee' }}>
                    <Button type="dashed" icon={<UserAddOutlined />} style={{ width: '100%' }}
                      onClick={() => setClientModalVisible(true)}>
                      + Nouveau Client
                    </Button>
                  </div>
                </>
              )}
            >
              {clients.map(c => (
                <Option key={c.id} value={c.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold' }}>{c.nom}</span>
                    <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                      {c.telephone ? `📞 ${c.telephone}` : ''}
                      {c.type ? ` · ${c.type}` : ''}
                    </span>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* Fiche vérification client */}
          {clientSelectionne && (
            <Card
              size="small"
              style={{
                marginTop: -8,
                marginBottom: 16,
                borderRadius: 12,
                background: '#f0f5ff',
                border: 'none',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #1890ff, #722ed1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 18, fontWeight: 'bold'
                }}>
                  {clientSelectionne.nom?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text strong style={{ fontSize: 15 }}>{clientSelectionne.nom}</Text>
                    <Tag color={clientSelectionne.type === 'entreprise' ? 'purple' : 'blue'}
                      style={{ borderRadius: 10, fontSize: 10 }}>
                      {clientSelectionne.type || 'particulier'}
                    </Tag>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                    {clientSelectionne.telephone && (
                      <Text style={{ fontSize: 12, color: '#8c8c8c' }}>📞 {clientSelectionne.telephone}</Text>
                    )}
                    {clientSelectionne.email && (
                      <Text style={{ fontSize: 12, color: '#8c8c8c' }}>✉️ {clientSelectionne.email}</Text>
                    )}
                    {clientSelectionne.adresse && (
                      <Text style={{ fontSize: 12, color: '#8c8c8c' }}>📍 {clientSelectionne.adresse}</Text>
                    )}
                  </div>
                </div>
                <Tag color="green" style={{ borderRadius: 10, fontWeight: 'bold', fontSize: 12 }}>
                  ✅ Vérifié
                </Tag>
              </div>
            </Card>
          )}

          {/* Panier */}
          {panier.length > 0 ? (
            <Table dataSource={panier} columns={colonnesPanier} rowKey={r => `${r.produit_id}_${r.unite}`}
              pagination={false} size="small"
              style={{ marginBottom: 8 }}
              scroll={{ y: 220 }}
              footer={() => (
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', padding: '4px 0'
                }}>
                  <Text style={{ color: '#8c8c8c' }}>{panier.length} article(s)</Text>
                  <Text strong style={{ fontSize: 18, color: '#1890ff' }}>
                    Total : {montantTotal.toLocaleString()} FCFA
                  </Text>
                </div>
              )} />
          ) : (
            <div style={{
              textAlign: 'center', padding: '24px',
              background: '#fafbfc', borderRadius: 12,
              marginBottom: 16, color: '#8c8c8c'
            }}>
              <ShoppingCartOutlined style={{ fontSize: 32, color: '#d9d9d9' }} />
              <p style={{ margin: '8px 0 0' }}>Le panier est vide — cliquez sur un produit à gauche</p>
            </div>
          )}

          <Divider style={{ margin: '12px 0' }} />

          {/* Total principal */}
          <Card size="small" style={{
            marginBottom: 16, borderRadius: 12,
            background: '#e6f7ff',
            border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                <Text strong style={{ fontSize: 16, color: '#1890ff' }}>MONTANT TOTAL</Text>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 36, fontWeight: 'bold', color: '#1890ff', lineHeight: 1 }}>
                  {montantTotal.toLocaleString()} FCFA
                </div>
                <Text style={{ color: '#8c8c8c', fontSize: 12 }}>
                  {panier.length} article(s)
                </Text>
              </div>
            </div>
          </Card>

          {/* Type de transaction */}
          <Card size="small" style={{ marginBottom: 16, borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
            title={<Text strong>💳 Type de Transaction</Text>}>
            <Row gutter={8}>
              <Col span={12}>
                <Button block size="large"
                  type={!estPret ? 'primary' : 'default'}
                  onClick={() => { setEstPret(false); setDatePret(null); setMontantPaye(montantTotal) }}
                  style={{ height: 52, fontSize: 14, fontWeight: 'bold', borderRadius: 8 }}>
                  💵 PAIEMENT NORMAL
                </Button>
              </Col>
              <Col span={12}>
                <Button block size="large"
                  type={estPret ? 'primary' : 'default'}
                  onClick={() => { setEstPret(true); setMontantPaye(0) }}
                  style={{ height: 52, fontSize: 14, fontWeight: 'bold', borderRadius: 8 }}>
                  📋 CRÉDIT CLIENT
                </Button>
              </Col>
            </Row>
          </Card>

          {/* Alert info — crédit uniquement */}
          {estPret && (
            <Alert style={{ marginBottom: 16, borderRadius: 8 }}
              message="📋 MODE CRÉDIT — Aucun encaissement aujourd'hui"
              description="Client et date de remboursement obligatoires"
              type="error" showIcon />
          )}

          {/* ══ CAISSE ══ */}
          {!estPret && (
            <Card size="small" style={{ marginBottom: 16, borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
              bodyStyle={{ padding: '12px 16px' }}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>💰</span>
                  <Text strong style={{ fontSize: 15, color: '#1890ff' }}>CAISSE</Text>
                </div>
              }>

              {/* ── Réduction ─────────────────────────────────── */}
              {(!modeRapide || isBTP) && !isTicketDomain && (
                <div style={{
                  background: '#fffbe6', border: '1px solid #ffe58f',
                  borderRadius: 8, padding: '10px 12px', marginBottom: 12
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Text strong style={{ fontSize: 12, color: '#ad6800', minWidth: 72 }}>🎁 Réduction</Text>
                    <Button size="small"
                      type={typeEscompte === 'pourcentage' ? 'primary' : 'default'}
                      onClick={() => setTypeEscompte('pourcentage')} style={{ minWidth: 36 }}>%</Button>
                    <Button size="small"
                      type={typeEscompte === 'montant' ? 'primary' : 'default'}
                      onClick={() => setTypeEscompte('montant')} style={{ minWidth: 50 }}>FCFA</Button>
                    <InputNumber value={escompte} onChange={(val) => setEscompte(val || 0)}
                      min={0} size="small" style={{ flex: 1 }} placeholder="0" />
                    {paymentState.escompteAmount > 0 && (
                      <Tag color="orange">−{paymentState.escompteAmount.toLocaleString('fr-FR')} FCFA</Tag>
                    )}
                  </div>
                </div>
              )}

              {/* ── Total à payer ──────────────────────────────── */}
              <div style={{
                background: 'linear-gradient(135deg, #1890ff, #096dd9)',
                borderRadius: 10, padding: '14px 18px', marginBottom: 14,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>
                    TOTAL À PAYER
                  </div>
                  {paymentState.escompteAmount > 0 && (
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textDecoration: 'line-through' }}>
                      {paymentState.totalAvantEscompte.toLocaleString('fr-FR')} FCFA
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: 1 }}>
                  {paymentState.total.toLocaleString('fr-FR')} <span style={{ fontSize: 14, fontWeight: 600 }}>FCFA</span>
                </div>
              </div>

              {/* ── Montant reçu (masqué si mode avoir) ─────────── */}
              {modePaiement === 'avoir' ? (
                <div style={{
                  background: '#e6fffb',
                  border: '1px solid #13c2c2', borderRadius: 10,
                  padding: '14px 18px', marginBottom: 10, textAlign: 'center'
                }}>
                  <div style={{ fontSize: 13, color: '#08979c', fontWeight: 700, marginBottom: 4 }}>
                    🏦 Paiement sur compte prépayé
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#13c2c2' }}>
                    {(paymentState.total || 0).toLocaleString('fr-FR')} <span style={{ fontSize: 13 }}>FCFA</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>
                    Montant débité du solde du compte prépayé
                  </div>
                </div>
              ) : (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text strong style={{ fontSize: 13 }}>💵 Montant reçu du client</Text>
                  <Button size="small" type="primary" ghost
                    onClick={() => { setPaiementAuto(false); setMontantPaye(paymentState.total) }}>
                    Montant exact
                  </Button>
                </div>
                <InputNumber
                  value={montantPaye || null}
                  onChange={(val) => { setPaiementAuto(false); setMontantPaye(val || 0) }}
                  min={0} size="large"
                  style={{ width: '100%', fontSize: 22, fontWeight: 'bold' }}
                  placeholder="Saisir le montant reçu..."
                  precision={0}
                  formatter={(val) => val ? Number(val).toLocaleString('fr-FR') : ''}
                  parser={(str) => parseInt((str || '').replace(/\s/g, '').replace(/[^\d]/g, ''), 10) || 0}
                />
                {/* Raccourcis billets */}
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {[500, 1000, 2000, 5000, 10000, 25000, 50000]
                    .filter(b => b >= (paymentState.total * 0.4))
                    .slice(0, 5)
                    .map(billet => (
                      <Button key={billet} size="small"
                        type={montantPaye === billet ? 'primary' : 'default'}
                        onClick={() => { setPaiementAuto(false); setMontantPaye(billet) }}
                        style={{ flex: 1, minWidth: 48, fontWeight: 600 }}>
                        {billet >= 1000 ? `${billet / 1000}k` : billet}
                      </Button>
                    ))}
                </div>
              </div>
              )}

              {/* ── Résultat caisse (masqué si mode avoir) ──────── */}
              {modePaiement !== 'avoir' && (montantPaye === 0 ? (
                <div style={{
                  borderRadius: 8, padding: '14px 16px', textAlign: 'center',
                  background: '#f5f5f5', border: '1.5px dashed #d9d9d9'
                }}>
                  <Text style={{ color: '#8c8c8c', fontSize: 13 }}>
                    ↑ Saisissez le montant remis par le client
                  </Text>
                </div>
              ) : paymentState.monnaie > 0 ? (
                <div style={{
                  borderRadius: 10, padding: '14px 18px',
                  background: '#f6ffed', border: '1px solid #52c41a',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ color: '#389e0d', fontWeight: 700, fontSize: 14 }}>💚 MONNAIE À RENDRE</div>
                    <div style={{ color: '#73d13d', fontSize: 11, marginTop: 2 }}>Remettre au client</div>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#52c41a' }}>
                    {paymentState.monnaie.toLocaleString('fr-FR')}
                    <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 4 }}>FCFA</span>
                  </div>
                </div>
              ) : paymentState.reste > 0 ? (
                <div style={{
                  borderRadius: 10, padding: '14px 18px',
                  background: '#fff2f0', border: '1px solid #ff4d4f',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ color: '#cf1322', fontWeight: 700, fontSize: 14 }}>
                      ⚠️ {paymentState.estPartiel ? 'RESTE À PAYER' : 'MONTANT INSUFFISANT'}
                    </div>
                    <div style={{ color: '#ff7875', fontSize: 11, marginTop: 2 }}>
                      {paymentState.estPartiel ? 'Paiement partiel accepté avec un client' : 'Montant reçu inférieur au total'}
                    </div>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#ff4d4f' }}>
                    {paymentState.reste.toLocaleString('fr-FR')}
                    <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 4 }}>FCFA</span>
                  </div>
                </div>
              ) : (
                <div style={{
                  borderRadius: 10, padding: '14px 18px',
                  background: '#f6ffed', border: '1px solid #52c41a',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ color: '#389e0d', fontWeight: 700, fontSize: 14 }}>✅ PAIEMENT EXACT</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#52c41a' }}>Parfait !</div>
                </div>
              ))}

              {/* ── Mode de paiement ───────────────────────────── */}
              <div style={{ marginTop: 14 }}>
                <Text strong style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 8, letterSpacing: 1 }}>
                  MODE DE PAIEMENT
                </Text>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { key: 'especes', label: '💵 Espèces' },
                    { key: 'wave', label: '🌊 Wave' },
                    { key: 'orange_money', label: '🟠 Orange Money' },
                    { key: 'cheque', label: '📝 Chèque' }
                  ].map(mode => (
                    <Button key={mode.key} size="large"
                      type={modePaiement === mode.key ? 'primary' : 'default'}
                      onClick={() => { setModePaiement(mode.key); form.setFieldValue('mode_paiement', mode.key) }}
                      style={{
                        height: 42, fontWeight: 'bold', borderRadius: 8, fontSize: 13,
                        border: modePaiement === mode.key ? '2px solid #1890ff' : '1.5px solid #d9d9d9'
                      }}>
                      {mode.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Form.Item name="mode_paiement" noStyle initialValue="especes">
                <Input type="hidden" />
              </Form.Item>
            </Card>
          )}

          {/* Bloc Crédit */}
          {estPret && (
            <Card size="small" style={{ marginBottom: 16, borderRadius: 12, background: '#fff1f0', border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
              title={<Text strong>📋 Crédit Client</Text>}>
              <Row gutter={[16, 12]}>
                <Col span={24}>
                  <Alert message="⚠️ Aucun paiement aujourd'hui — Le client remboursera plus tard."
                    type="warning" showIcon style={{ borderRadius: 6 }} />
                </Col>

                <Col span={24}>
                  <Card size="small" style={{ background: '#fff7f0', border: '1px solid #ff7a45', borderRadius: 10 }}>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Statistic title="Prix original" value={paymentState.totalAvantEscompte}
                          suffix="FCFA" valueStyle={{ color: '#8c8c8c', fontSize: 13 }} />
                      </Col>
                      <Col span={8}>
                        <Statistic title="Réduction" value={paymentState.escompteAmount}
                          suffix="FCFA" valueStyle={{ color: '#faad14', fontSize: 13 }} />
                      </Col>
                      <Col span={8}>
                        <Statistic title="Crédit TTC" value={paymentState.total}
                          suffix="FCFA" valueStyle={{ color: '#ff7a45', fontSize: 20, fontWeight: 'bold' }} />
                      </Col>
                    </Row>
                  </Card>
                </Col>

                <Col span={24}>
                  <Text strong style={{ fontSize: 14 }}>📅 Date de remboursement</Text>
                  <DatePicker value={datePret} onChange={setDatePret}
                    format="DD/MM/YYYY"
                    disabledDate={(current) => current && current.isBefore(dayjs().endOf('day'))}
                    size="large" style={{ width: '100%', marginTop: 6 }}
                    placeholder="Sélectionnez une date" />
                </Col>

                <Col span={24}>
                  <Card size="small" style={{
                    background: datePret ? '#f6ffed' : '#fff7e6',
                    border: `1px solid ${datePret ? '#52c41a' : '#faad14'}`,
                    borderRadius: 10
                  }}>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Statistic title="État"
                          value={datePret ? '✅ Configuré' : '⏳ En attente'}
                          valueStyle={{ color: datePret ? '#52c41a' : '#faad14', fontSize: 14 }} />
                      </Col>
                      <Col span={12}>
                        <Statistic title="Échéance"
                          value={datePret ? datePret.format('DD/MM/YYYY') : '—'}
                          valueStyle={{ color: datePret ? '#52c41a' : '#8c8c8c', fontSize: 14 }} />
                      </Col>
                    </Row>
                  </Card>
                </Col>

                <Form.Item name="mode_paiement" noStyle initialValue="especes">
                  <Input type="hidden" />
                </Form.Item>
              </Row>
            </Card>
          )}

          {/* Boutons */}
          <Form.Item style={{ marginBottom: 0 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="primary" htmlType="submit" icon={<CheckOutlined />} size="large" block
                loading={enregistrement}
                disabled={
                  !paymentState.estValide ||
                  (paymentState.estPartiel && !form.getFieldValue('client_id')) ||
                  (estPret && !form.getFieldValue('client_id')) ||
                  panier.length === 0
                }
                style={{ height: 52, fontSize: 15, fontWeight: 'bold', borderRadius: 8,
                  background: panier.length === 0 ? undefined : 'linear-gradient(135deg, #1890ff, #722ed1)',
                  border: 'none'
                }}>
                {editingVente
                  ? `💾 Enregistrer les modifications`
                  : estPret
                    ? `📋 Crédit: ${montantTotal.toLocaleString()} FCFA`
                    : paymentState.estPartiel
                      ? `⚠️ Partiel: Payé ${paymentState.paye.toLocaleString()} FCFA`
                      : isTicketDomain
                        ? `🛒 Encaisser: ${paymentState.total.toLocaleString()} FCFA`
                        : isBTP
                          ? `🔧 Valider le bon: ${paymentState.total.toLocaleString()} FCFA`
                          : `✅ Valider: ${paymentState.total.toLocaleString()} FCFA`}
              </Button>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Button onClick={() => {
                  setModalVisible(false); resetPaymentState(); setPanier([]); form.resetFields()
                  setClientSelectionne(null); setEditingVente(null)
                }}>
                  ❌ {editingVente ? 'Annuler' : 'Vider la vente'}
                </Button>
                {!editingVente && (
                  <Button
                    icon={<ThunderboltOutlined />}
                    onClick={validerEtContinuer}
                    loading={enregistrement}
                    disabled={
                      !paymentState.estValide ||
                      (paymentState.estPartiel && !form.getFieldValue('client_id')) ||
                      (estPret && !form.getFieldValue('client_id')) ||
                      panier.length === 0
                    }
                    style={{ borderRadius: 8 }}
                  >
                    ✅ Valider & Continuer
                  </Button>
                )}
              </Space>
            </Space>
          </Form.Item>
        </div>
      </Col>
    </Row>
  )

  return (
    <div>
      {/* ✅ En-tête */}
      <div style={{
        background: theme.gradient,
        borderRadius: 16, padding: '20px 28px', marginBottom: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {domaineActive && (
            <div style={{
              fontSize: 36, lineHeight: 1,
              background: 'rgba(255,255,255,0.2)',
              borderRadius: 12, padding: '8px 12px'
            }}>
              {domaine?.icone}
            </div>
          )}
          <div>
            <Title level={2} style={{ color: 'white', margin: 0 }}>🛒 Caisse</Title>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>
              {domaineActive
                ? `${domaine?.nom} · Enregistrez vos transactions`
                : 'Enregistrez et suivez toutes vos transactions'}
            </Text>
          </div>
        </div>
        <Space>
          {peutAjouter(role) && (
            <Button size="large" onClick={() => setVue('caisse')}
              style={{
                borderRadius: 10, fontWeight: 'bold', height: 44,
                background: vue === 'caisse' ? 'white' : 'rgba(255,255,255,0.15)',
                color: vue === 'caisse' ? theme.primaryColor : 'white',
                border: '1px solid rgba(255,255,255,0.3)'
              }}>
              🛒 Caisse
            </Button>
          )}
          <Button size="large" onClick={() => setVue('historique')}
            style={{
              borderRadius: 10, fontWeight: 'bold', height: 44,
              background: vue === 'historique' ? 'white' : 'rgba(255,255,255,0.15)',
              color: vue === 'historique' ? theme.primaryColor : 'white',
              border: '1px solid rgba(255,255,255,0.3)'
            }}>
            📜 Historique
          </Button>
        </Space>
      </div>

      {vue === 'caisse' && peutAjouter(role) && !modalVisible && (
        <Form form={form} layout="vertical" onFinish={validerVente}>
          {renderCorpsCaisse()}
        </Form>
      )}

      {vue === 'historique' && (
      <>
      {/* ✅ Cartes stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {estCaissier ? (
          <>
            <Col span={8}>
              <Card style={{ borderRadius: 12, border: 'none', background: '#f6ffed' }}
                bodyStyle={{ padding: '16px 20px' }}>
                <Statistic title={<Text style={{ color: '#8c8c8c' }}>CA Aujourd'hui</Text>}
                  value={caJour} suffix="FCFA"
                  prefix={<RiseOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#52c41a', fontSize: 18 }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card style={{ borderRadius: 12, border: 'none', background: '#e6f7ff' }}
                bodyStyle={{ padding: '16px 20px' }}>
                <Statistic title={<Text style={{ color: '#8c8c8c' }}>Ventes Aujourd'hui</Text>}
                  value={ventesJourCount} prefix={<ShoppingCartOutlined style={{ color: '#1890ff' }} />}
                  valueStyle={{ color: '#1890ff', fontSize: 22 }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card style={{ borderRadius: 12, border: 'none', background: '#fff7e6' }}
                bodyStyle={{ padding: '16px 20px' }}>
                <Statistic title={<Text style={{ color: '#8c8c8c' }}>Panier Moyen (jour)</Text>}
                  value={Math.round(panierMoyenJour)} suffix="FCFA"
                  prefix={<DollarOutlined style={{ color: '#faad14' }} />}
                  valueStyle={{ color: '#faad14', fontSize: 18 }} />
              </Card>
            </Col>
          </>
        ) : (
          <>
            <Col span={6}>
              <Card style={{ borderRadius: 12, border: 'none', background: '#e6f7ff' }}
                bodyStyle={{ padding: '16px 20px' }}>
                <Statistic title={<Text style={{ color: '#8c8c8c' }}>Total Ventes</Text>}
                  value={ventes.length} prefix={<ShoppingCartOutlined style={{ color: '#1890ff' }} />}
                  valueStyle={{ color: '#1890ff', fontSize: 22 }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderRadius: 12, border: 'none', background: '#f6ffed' }}
                bodyStyle={{ padding: '16px 20px' }}>
                <Statistic title={<Text style={{ color: '#8c8c8c' }}>Chiffre d'Affaires</Text>}
                  value={totalCA} suffix="FCFA"
                  prefix={<RiseOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#52c41a', fontSize: 18 }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderRadius: 12, border: 'none', background: '#fff7e6' }}
                bodyStyle={{ padding: '16px 20px' }}>
                <Statistic title={<Text style={{ color: '#8c8c8c' }}>Crédits en cours</Text>}
                  value={ventesCredit} prefix={<FileTextOutlined style={{ color: '#faad14' }} />}
                  valueStyle={{ color: '#faad14', fontSize: 22 }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderRadius: 12, border: 'none', background: '#fff2f0' }}
                bodyStyle={{ padding: '16px 20px' }}>
                <Statistic title={<Text style={{ color: '#8c8c8c' }}>Montant Dû</Text>}
                  value={montantDu} suffix="FCFA"
                  prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />}
                  valueStyle={{ color: '#ff4d4f', fontSize: 18 }} />
              </Card>
            </Col>
          </>
        )}
      </Row>

      {/* ✅ Filtres améliorés */}
      <Card style={{ marginBottom: 16, borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Row gutter={[16, 16]} align="middle">
          <Col span={6}>
            <Search placeholder="Rechercher par client ou N°..."
              allowClear prefix={<SearchOutlined style={{ color: '#1890ff' }} />}
              value={recherche} onChange={(e) => setRecherche(e.target.value)} size="large" />
          </Col>
          <Col span={4}>
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
          <Col span={4}>
            <Select placeholder="Statut paiement" allowClear
              style={{ width: '100%' }} size="large"
              value={filtrePaiementStatut} onChange={setFiltrePaiementStatut}>
              <Option value="complet">✅ Complet</Option>
              <Option value="partiel">⚠️ Partiel</Option>
              <Option value="credit">📋 Crédit</Option>
            </Select>
          </Col>
          {!estCaissier && (
            <Col span={6}>
              <RangePicker style={{ width: '100%' }} size="large"
                value={filtreDates} onChange={setFiltreDates}
                format="DD/MM/YYYY" placeholder={['Date début', 'Date fin']} />
            </Col>
          )}
          <Col span={2}>
            <Button icon={<ClearOutlined />} size="large"
              onClick={reinitialiserFiltres} style={{ width: '100%' }}>
              Reset
            </Button>
          </Col>
          <Col span={3}>
            <div style={{
              textAlign: 'right', background: '#f0f5ff',
              padding: '8px 12px', borderRadius: 8
            }}>
              <Text style={{ color: '#1890ff', fontWeight: 'bold', display: 'block' }}>
                {ventesFiltres.length}{!estCaissier && ` / ${ventes.length}`}
              </Text>
              {!estCaissier && (
                <Text style={{ color: '#52c41a', fontSize: 12, fontWeight: 'bold' }}>
                  {calculerTotalFiltres().toLocaleString()} F
                </Text>
              )}
            </div>
          </Col>
        </Row>

        {/* Filtres de période rapides — masqués pour le caissier */}
        {!estCaissier && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <FiltresPeriode onFiltreChange={setFiltrePeriode} />
              </Col>
            </Row>
          </>
        )}
      </Card>

      {/* ✅ Tableau amélioré */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCartOutlined style={{ color: '#1890ff' }} />
            <span>{estCaissier ? "Ventes d'aujourd'hui" : 'Historique des Ventes'}</span>
            <Badge count={ventesFiltres.length} style={{ background: '#1890ff' }} />
          </div>
        }
        style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
      >
        <Table
          dataSource={ventesFiltres}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10, showTotal: (total) => `${total} ventes` }}
        />
      </Card>
      </>
      )}

      {/* Modal de modification d'une vente existante — réutilise le même
          corps caisse (grille + ticket) que l'écran principal. */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              background: isRestaurant
                ? 'linear-gradient(135deg, #cf1322, #fa8c16)'
                : isAlimentaire
                  ? 'linear-gradient(135deg, #389e0d, #08979c)'
                  : isBTP
                    ? 'linear-gradient(135deg, #434343, #2c3e50)'
                    : 'linear-gradient(135deg, #1890ff, #722ed1)',
              borderRadius: 8, padding: '6px 10px', color: 'white',
              fontSize: 16
            }}>
              {isRestaurant ? '🍽️' : isAlimentaire ? '🛒' : isBTP ? '🔧' : <ShoppingCartOutlined />}
            </div>
            <span>
              {editingVente
                ? `Modifier Vente V-${String(editingVente.id).padStart(4, '0')}`
                : isRestaurant ? 'Nouvelle Commande'
                : isAlimentaire ? 'Caisse Rapide'
                : isBTP ? 'Bon de Vente'
                : 'Nouvelle Vente'}
            </span>
            {isTicketDomain && (
              <Tag color={isRestaurant ? 'red' : 'green'} style={{ marginLeft: 4, borderRadius: 8 }}>
                {isRestaurant ? 'Restaurant' : 'Épicerie'}
              </Tag>
            )}
            {isBTP && (
              <Tag color="orange" style={{ marginLeft: 4, borderRadius: 8 }}>
                {domaineActive === 'btp' ? 'BTP' : 'Quincaillerie'}
              </Tag>
            )}
          </div>
        }
        open={modalVisible && !!editingVente}
        onCancel={() => {
          setModalVisible(false); setPanier([]); resetPaymentState(); form.resetFields()
          setPaiementAuto(true); setClientSelectionne(null); setEditingVente(null)
        }}
        footer={null}
        width={1200}
        destroyOnClose
      >
        {editingVente && (
          <Form form={form} layout="vertical" onFinish={validerVente}>
            {renderCorpsCaisse()}
          </Form>
        )}
      </Modal>

      {/* Aperçu / impression de la facture */}
      <Modal
        title={factureAuto ? `🧾 Facture F-${String(factureAuto.id).padStart(4, '0')}` : '🧾 Facture'}
        open={factureAutoVisible}
        onCancel={() => setFactureAutoVisible(false)}
        width={920}
        footer={[
          <Button key="fermer" onClick={() => setFactureAutoVisible(false)}>
            Fermer
          </Button>,
          <Button
            key="pdf"
            icon={<FileTextOutlined />}
            loading={impressionFacture}
            onClick={() => imprimerFactureAutoPDF()}
          >
            Télécharger PDF
          </Button>,
          <Button
            key="imprimer"
            type="primary"
            icon={<PrinterOutlined />}
            loading={impressionFacture}
            onClick={() => imprimerFactureDirectement()}
          >
            Imprimer
          </Button>
        ]}
      >
        {factureAuto && (
          <FactureSelector facture={factureAuto} parametres={parametres} domaine={domaineActive} formatManuel={parametres?.format_facture} />
        )}
      </Modal>

      <NouveauClientModal
        visible={clientModalVisible}
        onClose={() => setClientModalVisible(false)}
        onSuccess={() => chargerClients()}
      />

      <NouveauProduitRapideModal
        visible={produitModalVisible}
        onClose={() => setProduitModalVisible(false)}
        nomInitial={produitRecherche}
        categoriesDomaine={categoriesDomaineActif}
        uniteParDefaut={theme.defaultUnite}
        quantiteInitiale={quantiteRapide}
        onSuccess={async (nouveauProduit) => {
          await chargerProduits()
          setProduitRecherche('')
          // Ajout direct au panier (plutôt que via selectionnerProduitGrille/
          // ajouterAuPanier, qui recherchent le produit dans l'état `produits` —
          // pas encore à jour juste après chargerProduits() dans cette même passe).
          setPanier(prev => [...prev, {
            produit_id: nouveauProduit.id,
            nom: nouveauProduit.nom,
            reference: nouveauProduit.reference || '',
            unite: nouveauProduit.unite || 'pièce',
            unite_label: nouveauProduit.unite || 'pièce',
            facteur_unite: 1,
            quantite: quantiteRapide,
            quantite_saisie: quantiteRapide,
            prix_unitaire: nouveauProduit.prix_vente,
            total: quantiteRapide * nouveauProduit.prix_vente
          }])
        }}
      />
    </div>
  )
}

export default Ventes