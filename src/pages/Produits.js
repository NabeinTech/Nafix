import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Typography, Table, Button, Modal, Form,
  Input, InputNumber, Select, AutoComplete, Space,
  Popconfirm, Tag, message, Row, Col, Card,
  Statistic, Badge, Alert, Tabs, Slider, Drawer, Checkbox
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, ClearOutlined, ShoppingOutlined,
  WarningOutlined, AppstoreOutlined,
  DownloadOutlined, UploadOutlined, FilterOutlined, BarChartOutlined,
  EyeOutlined, EyeInvisibleOutlined
} from '@ant-design/icons'
import * as XLSX from 'xlsx'
import { peutAjouter, peutModifier, peutSupprimer } from '../utils/permissions'
import { getDomaine, getDomainTheme, UNITES_DECIMALES } from '../utils/domainConfig'
import { analyserGrilleProduits, normaliser } from '../utils/importExcelProduits'

const { Title, Text } = Typography
const { Option, OptGroup } = Select
const { Search } = Input
const ipcRenderer = window.ipcRenderer

// Toutes les unités disponibles pour les niveaux de vente multi-unités
const UNITES_NIVEAUX_OPTIONS = [
  {
    label: '📦 Contenants secs',
    options: [
      { value: 'sachet' }, { value: 'pochette' }, { value: 'sac' },
      { value: 'boîte' }, { value: 'carton' }, { value: 'caisse' },
      { value: 'palette' }, { value: 'cagette' }, { value: 'botte' },
      { value: 'paquet' }, { value: 'ballot' }, { value: 'gerbe' },
    ]
  },
  {
    label: '🍶 Contenants liquides',
    options: [
      { value: 'bouteille' }, { value: 'bidon' }, { value: 'jerricane' },
      { value: 'baril' }, { value: 'tonneau' }, { value: 'cuve' },
      { value: 'canette' }, { value: 'flacon' }, { value: 'ampoule' },
    ]
  },
  {
    label: '⚖️ Poids',
    options: [
      { value: 'mg' }, { value: 'g' }, { value: 'kg' },
      { value: 'quintal' }, { value: 'tonne' },
    ]
  },
  {
    label: '🧴 Volume',
    options: [
      { value: 'mL' }, { value: 'cL' }, { value: 'dL' }, { value: 'L' },
    ]
  },
  {
    label: '🔢 Quantité / conditionnement',
    options: [
      { value: 'pièce' }, { value: 'unité' }, { value: 'lot' },
      { value: 'pack' }, { value: 'paire' }, { value: 'douzaine' },
      { value: 'cent' }, { value: 'millier' },
    ]
  },
  {
    label: '🏗️ Construction / industrie',
    options: [
      { value: 'barre' }, { value: 'tige' }, { value: 'fer' },
      { value: 'planche' }, { value: 'madrier' }, { value: 'rouleau' },
      { value: 'tube' }, { value: 'tôle' }, { value: 'dalle' },
      { value: 'parpaing' }, { value: 'brique' }, { value: 'seau' },
    ]
  },
  {
    label: '📏 Mesure',
    options: [
      { value: 'm' }, { value: 'cm' }, { value: 'mm' },
      { value: 'm²' }, { value: 'm³' }, { value: 'yard' },
    ]
  },
]

// Même liste pour les Select (OptGroup / Option)
const UNITE_GROUPS_SELECT = [
  { label: '📦 Contenants secs',        opts: ['sachet', 'pochette', 'sac', 'boîte', 'carton', 'caisse', 'palette', 'cagette', 'botte', 'paquet', 'ballot'] },
  { label: '🍶 Contenants liquides',     opts: ['bouteille', 'bidon', 'jerricane', 'baril', 'tonneau', 'cuve', 'canette', 'flacon', 'ampoule'] },
  { label: '⚖️ Poids',                   opts: ['mg', 'g', 'kg', 'quintal', 'tonne'] },
  { label: '🧴 Volume',                  opts: ['mL', 'cL', 'dL', 'L'] },
  { label: '🔢 Quantité',               opts: ['pièce', 'unité', 'lot', 'pack', 'paire', 'douzaine', 'cent', 'millier', 'portion', 'assiette', 'verre', 'forfait'] },
  { label: '🏗️ Construction / industrie', opts: ['barre', 'tige', 'fer', 'planche', 'madrier', 'rouleau', 'tube', 'tôle', 'dalle', 'parpaing', 'brique', 'seau'] },
  { label: '📏 Mesure',                  opts: ['m', 'cm', 'mm', 'm²', 'm³', 'yard'] },
  { label: '⏱️ Temps / service',         opts: ['heure', 'jour', 'prestation'] },
]

// Formate un nombre en supprimant les zéros décimaux inutiles (ex: "75.000" → "75", "75.500" → "75,5")
const fmtN = (v) => {
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

// Un produit est "nouveau" s'il a été ajouté il y a moins de 48h
const NOUVEAU_SEUIL_HEURES = 48
const estNouveau = (p) => {
  if (!p?.created_at) return false
  const diffHeures = (Date.now() - new Date(p.created_at).getTime()) / 36e5
  return diffHeures >= 0 && diffHeures <= NOUVEAU_SEUIL_HEURES
}
const depuisTexte = (dateStr) => {
  const diffH = (Date.now() - new Date(dateStr).getTime()) / 36e5
  if (diffH < 1) return 'il y a quelques minutes'
  if (diffH < 24) return `il y a ${Math.floor(diffH)}h`
  return `il y a ${Math.floor(diffH / 24)}j`
}

function Produits({ utilisateur }) {
  const role = utilisateur?.role || 'caissier'
  const [produits, setProduits] = useState([])
  const [produitsFiltres, setProduitsFiltres] = useState([])
  const [categories, setCategories] = useState([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editingProduit, setEditingProduit] = useState(null)
  const [recherche, setRecherche] = useState('')
  const [filtreCategorie, setFiltreCategorie] = useState(null)
  const [categoriesMasquees, setCategoriesMasquees] = useState(false)
  const [form] = Form.useForm()
  const uniteFormValue             = Form.useWatch('unite', form)
  const categorieFormValue         = Form.useWatch('categorie', form)
  const conditionnementFormValue   = Form.useWatch('conditionnement', form)
  const [unitesLocales, setUnitesLocales] = useState([]) // niveaux multi-unités du modal
  const [domaineActive, setDomaineActive] = useState(null)
  // On ne propose que les catégories du domaine d'activité actif — les
  // autres domaines (choisis puis abandonnés) restent masqués.
  const categoriesDuDomaine = useMemo(
    () => domaineActive ? categories.filter(c => c.domaine === domaineActive) : categories,
    [categories, domaineActive]
  )
  const [drawerFiltreVisible, setDrawerFiltreVisible] = useState(false)
  const [filtresAvances, setFiltresAvances] = useState({
    prixMin: 0,
    prixMax: 0,
    stockMin: 0,
    margeMin: 0,
    margeMax: 200,
    stockCritique: false
  })

  // ── Chargement ──────────────────────────────────────────
  const chargerProduits = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('produits:getAll')
    setProduits(data)
    setProduitsFiltres(data)
  }

  const chargerCategories = async () => {
    if (!ipcRenderer) return
    setCategories(await ipcRenderer.invoke('categories:getAll'))
  }

  const chargerDomaine = async () => {
    if (!ipcRenderer) return
    const data = await ipcRenderer.invoke('domaine:get')
    if (data?.type) setDomaineActive(data.type)
  }

  useEffect(() => {
    chargerProduits()
    chargerCategories()
    chargerDomaine()
  }, [])

  // ── Filtrage unifié ──────────────────────────────────────
  useEffect(() => {
    let resultat = [...produits]

    if (recherche) {
      const terme = recherche.toLowerCase()
      resultat = resultat.filter(p =>
        p.nom?.toLowerCase().includes(terme) ||
        p.reference?.toLowerCase().includes(terme) ||
        p.marque?.toLowerCase().includes(terme)
      )
    }

    if (filtreCategorie) {
      resultat = resultat.filter(p => p.categorie === filtreCategorie)
    }

    if (filtresAvances.prixMax > 0) {
      resultat = resultat.filter(p =>
        p.prix_vente >= filtresAvances.prixMin &&
        p.prix_vente <= filtresAvances.prixMax
      )
    }

    if (filtresAvances.stockMin > 0) {
      resultat = resultat.filter(p => p.stock_actuel >= filtresAvances.stockMin)
    }

    if (filtresAvances.stockCritique) {
      resultat = resultat.filter(p => p.stock_actuel <= p.stock_minimum)
    }

    resultat = resultat.filter(p => {
      if (!p.prix_achat || p.prix_achat === 0) return true
      const marge = ((p.prix_vente - p.prix_achat) / p.prix_achat) * 100
      return marge >= filtresAvances.margeMin && marge <= filtresAvances.margeMax
    })

    setProduitsFiltres(resultat)
  }, [recherche, filtreCategorie, filtresAvances, produits])

  // ── Réinitialisation ─────────────────────────────────────
  const reinitialiserFiltres = () => {
    setRecherche('')
    setFiltreCategorie(null)
    setCategoriesMasquees(false)
    setFiltresAvances({
      prixMin: 0, prixMax: 0, stockMin: 0,
      margeMin: 0, margeMax: 200, stockCritique: false
    })
  }

  // ── Masquer/afficher les catégories (montre tous les produits sans distinction) ──
  const basculerCategories = () => {
    setCategoriesMasquees(prev => {
      if (!prev) setFiltreCategorie(null) // on masque → on affiche tous les produits
      return !prev
    })
  }

  // ── Export Excel ─────────────────────────────────────────
  // En-têtes alignées sur celles reconnues par produits:importerExcel —
  // le fichier exporté peut donc être réimporté tel quel après modification.
  const exporterExcel = () => {
    if (produitsFiltres.length === 0) {
      message.warning('Aucun produit à exporter')
      return
    }
    const headers = ['Nom', 'Référence', 'Catégorie', 'Marque',
      'Prix Achat', 'Prix Vente', 'Marge %', 'Stock Actuel', 'Stock Minimum', 'Unité']
    const rows = produitsFiltres.map(p => {
      const marge = p.prix_achat > 0
        ? Number(((p.prix_vente - p.prix_achat) / p.prix_achat * 100).toFixed(2))
        : 0
      return [p.nom, p.reference || '', p.categorie, p.marque || '',
        p.prix_achat, p.prix_vente, marge, p.stock_actuel, p.stock_minimum, p.unite || '']
    })
    const feuille = XLSX.utils.aoa_to_sheet([headers, ...rows])
    feuille['!cols'] = headers.map(() => ({ wch: 18 }))
    const classeur = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(classeur, feuille, 'Produits')
    const buffer = XLSX.write(classeur, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buffer], { type: 'application/octet-stream' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `produits_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)
    message.success('✅ Fichier Excel exporté !')
  }

  // ── Modèle Excel — fichier vierge avec les bons en-têtes, pour un
  // nouveau catalogue sans produits encore existants à exporter ──
  const [modeleEnCours, setModeleEnCours] = useState(false)
  const telechargerModele = async () => {
    if (!ipcRenderer) return
    // Web : dialog.showSaveDialog n'existe pas dans un navigateur —
    // on génère le classeur côté client et on déclenche un téléchargement
    // (même technique que exporterExcel ci-dessus).
    if (window.NAFIX_ENV_WEB) {
      const entetes = ['Nom', 'Référence', 'Catégorie', 'Marque', 'Prix Achat', 'Prix Vente', 'Stock Actuel', 'Stock Minimum', 'Unité']
      const exemple = ['Riz parfumé 25kg', 'RIZ-001', 'Céréales & Graines', 'Sundia', 5000, 7500, 100, 10, 'sac']
      const feuille = XLSX.utils.aoa_to_sheet([entetes, exemple])
      feuille['!cols'] = entetes.map(() => ({ wch: 20 }))
      const classeur = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(classeur, feuille, 'Produits')
      const buffer = XLSX.write(classeur, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([buffer], { type: 'application/octet-stream' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'modele_import_produits.xlsx'
      a.click()
      window.URL.revokeObjectURL(url)
      message.success('✅ Modèle téléchargé !')
      return
    }
    setModeleEnCours(true)
    try {
      const resultat = await ipcRenderer.invoke('produits:exporterModeleExcel')
      if (resultat?.annule) return
      if (resultat?.erreur) { message.error(`❌ ${resultat.erreur}`); return }
      message.success('✅ Modèle téléchargé !')
    } finally {
      setModeleEnCours(false)
    }
  }

  // ── Import Excel ─────────────────────────────────────────
  const [importEnCours, setImportEnCours] = useState(false)
  const inputImportExcelRef = useRef(null)
  const TAILLE_MAX_IMPORT_OCTETS = 20 * 1024 * 1024

  // Affiche le résultat { importes, ignores, erreurs }, quelle que soit la
  // plateforme qui l'a produit (dialog Electron ou parsing navigateur).
  const traiterResultatImport = (resultat) => {
    if (resultat?.annule) return
    if (resultat?.erreur) { message.error(`❌ ${resultat.erreur}`); return }
    const { importes, ignores, erreurs } = resultat
    if (importes > 0) {
      message.success(`✅ ${importes} produit(s) importé(s) !`)
      chargerProduits()
      chargerCategories()
    }
    if (ignores > 0) {
      message.warning(`⚠️ ${ignores} ligne(s) ignorée(s) (nom manquant)`)
    }
    if (erreurs?.length) {
      Modal.warning({
        title: `${erreurs.length} ligne(s) non importée(s)`,
        content: (
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {erreurs.map((e, i) => <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>{e}</div>)}
          </div>
        ),
        width: 480
      })
    }
    if (importes === 0 && ignores === 0 && !erreurs?.length) {
      message.info('Aucune ligne trouvée dans le fichier')
    }
  }

  const importerExcel = async () => {
    if (!ipcRenderer) return
    // Web : pas de dialog.showOpenDialog — on déclenche le sélecteur de
    // fichier natif du navigateur, géré par gererFichierExcelSelectionne.
    if (window.NAFIX_ENV_WEB) {
      inputImportExcelRef.current?.click()
      return
    }
    setImportEnCours(true)
    try {
      const resultat = await ipcRenderer.invoke('produits:importerExcel')
      traiterResultatImport(resultat)
    } finally {
      setImportEnCours(false)
    }
  }

  // Web uniquement : lecture + parsing du fichier choisi, puis reproduction
  // de la même logique que produits:importerExcel côté Electron (main.js) —
  // catégorie auto-créée si inconnue, un produit créé par ligne valide.
  const gererFichierExcelSelectionne = async (e) => {
    const fichier = e.target.files?.[0]
    e.target.value = '' // permet de resélectionner le même fichier plus tard
    if (!fichier) return
    if (fichier.size > TAILLE_MAX_IMPORT_OCTETS) {
      message.error('❌ Fichier trop volumineux (maximum 20 Mo).')
      return
    }
    setImportEnCours(true)
    try {
      const buffer = await fichier.arrayBuffer()
      const classeur = XLSX.read(buffer, { type: 'array' })
      const feuille = classeur.Sheets[classeur.SheetNames[0]]
      const grille = XLSX.utils.sheet_to_json(feuille, { header: 1, defval: '', blankrows: false })
      const { produits: produitsAImporter, ignores, indexEntete } = analyserGrilleProduits(grille)

      const categoriesConnues = new Set(categories.map(c => normaliser(c.nom)))
      let importes = 0
      const erreurs = []

      for (let i = 0; i < produitsAImporter.length; i++) {
        const produit = produitsAImporter[i]
        if (!categoriesConnues.has(normaliser(produit.categorie))) {
          await ipcRenderer.invoke('categories:create', { nom: produit.categorie, icone: '📦', couleur: 'blue', domaine: domaineActive })
          categoriesConnues.add(normaliser(produit.categorie))
        }
        const resultatCreation = await ipcRenderer.invoke('produits:create', produit)
        if (resultatCreation?.erreur) {
          erreurs.push(`Ligne ${indexEntete + i + 2} (${produit.nom}) : ${resultatCreation.erreur}`)
        } else {
          importes++
        }
      }

      traiterResultatImport({ succes: true, importes, ignores, erreurs })
    } catch (err) {
      message.error(`❌ Fichier illisible : ${err.message}`)
    } finally {
      setImportEnCours(false)
    }
  }

  // ── Stats globales ───────────────────────────────────────
  const calculeStats = () => {
    const valeurStock = produits.reduce((acc, p) => acc + (parseFloat(p.stock_actuel) * parseFloat(p.prix_achat) || 0), 0)
    const valeurStockVente = produits.reduce((acc, p) => acc + (parseFloat(p.stock_actuel) * parseFloat(p.prix_vente) || 0), 0)
    const totalAchat = produits.reduce((acc, p) => acc + (parseFloat(p.prix_achat) || 0), 0)
    const totalVente = produits.reduce((acc, p) => acc + (parseFloat(p.prix_vente) || 0), 0)
    const margeGlobalalePercent = totalAchat > 0
      ? (((totalVente - totalAchat) / totalAchat) * 100).toFixed(1)
      : 0
    return { valeurStock, valeurStockVente, margeGlobalalePercent }
  }

  const totalProduits = produits.length
  const alertesStock = produits.filter(p => p.stock_actuel <= p.stock_minimum).length
  const { valeurStock, margeGlobalalePercent } = calculeStats()

  // ── Cartes KPI cliquables — filtrent le tableau ou ouvrent le détail ──
  const tableRef = useRef(null)
  const [modalValeurStock, setModalValeurStock] = useState(false)
  const [modalMarge, setModalMarge] = useState(false)

  const scrollVersTableau = () => {
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const voirTousProduits = () => {
    setRecherche('')
    setFiltreCategorie(null)
    setFiltresAvances(f => ({ ...f, stockCritique: false }))
    scrollVersTableau()
  }

  const voirAlertesStock = () => {
    setRecherche('')
    setFiltreCategorie(null)
    setFiltresAvances(f => ({ ...f, stockCritique: true }))
    scrollVersTableau()
  }

  const voirCategorie = (nomCategorie) => {
    setRecherche('')
    setFiltresAvances(f => ({ ...f, stockCritique: false }))
    setFiltreCategorie(nomCategorie)
    scrollVersTableau()
  }

  const produitsParValeurStock = useMemo(() => [...produits]
    .map(p => ({ ...p, valeurLigne: (parseFloat(p.stock_actuel) || 0) * (parseFloat(p.prix_achat) || 0) }))
    .filter(p => p.valeurLigne > 0)
    .sort((a, b) => b.valeurLigne - a.valeurLigne), [produits])

  const produitsParMarge = useMemo(() => [...produits]
    .filter(p => p.prix_achat > 0)
    .map(p => ({ ...p, margeLigne: ((p.prix_vente - p.prix_achat) / p.prix_achat) * 100 }))
    .sort((a, b) => b.margeLigne - a.margeLigne), [produits])

  // Derniers produits ajoutés (déjà triés par created_at DESC côté DAO)
  const derniersAjouts = [...produits]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5)
  const nbNouveaux = produits.filter(estNouveau).length

  const domaine = getDomaine(domaineActive)
  const theme = getDomainTheme(domaineActive || 'general')

  // Helpers domaine
  const isRestaurant   = domaineActive === 'restauration'
  const isAlimentaire  = domaineActive === 'alimentaire'
  const isBTP          = domaineActive === 'btp' || domaineActive === 'quincaillerie'
  const isInformatique = domaineActive === 'informatique'
  const isTextile      = domaineActive === 'textile'

  // Config formulaire selon domaine
  const formCfg = {
    referenceLabel:    isBTP ? 'Référence article' : isInformatique ? 'Référence / Code' : isRestaurant ? 'Code plat' : isAlimentaire ? 'Code produit' : 'Référence',
    referenceRequired: isBTP || isInformatique,
    referencePlaceholder: isBTP ? 'Ex: QUINCA-001' : isInformatique ? 'Ex: INFO-001' : isRestaurant ? 'Ex: PLT-001 (optionnel)' : 'Ex: ART-001',
    nomLabel:     isRestaurant ? 'Nom du plat / article' : isBTP ? 'Désignation de l\'article' : isTextile ? 'Désignation / Modèle' : isAlimentaire ? 'Nom du produit / denrée' : 'Nom du produit',
    nomPlaceholder: isRestaurant ? 'Ex: Thiéboudienne, Poulet yassa, Jus bissap...' : isBTP ? 'Ex: Ciment CEM II, Fer à béton 10mm, Peinture blanche...' : isTextile ? 'Ex: Wax 6 yards, Chemise slim, Robe pagne...' : isAlimentaire ? 'Ex: Riz parfumé, Huile Sundia, Concentré tomate...' : 'Ex: Laptop HP 15, Téléphone Samsung...',
    prixAchatLabel: isRestaurant ? 'Prix de revient (FCFA)' : isBTP ? 'Prix unitaire achat HT (FCFA)' : 'Prix d\'achat (FCFA)',
    prixVenteLabel: isRestaurant ? 'Prix menu / vente (FCFA)' : isBTP ? 'Prix unitaire vente HT (FCFA)' : 'Prix de vente (FCFA)',
    stockLabel:    isRestaurant ? 'Quantité en stock' : isBTP ? 'Quantité en stock' : 'Stock actuel',
    hint: isRestaurant ? 'Ajoutez vos plats, boissons et articles du menu'
      : isAlimentaire  ? 'Gérez vos denrées alimentaires et produits d\'épicerie'
      : isBTP          ? 'Référencez vos matériaux, outils et prestations'
      : isTextile      ? 'Cataloguez vos articles de mode, tissus et accessoires'
      : isInformatique ? 'Cataloguez vos équipements informatiques et électroniques'
      : 'Ajoutez votre article au catalogue'
  }

  const statsCat = categoriesDuDomaine.map(cat => ({
    id: cat.id, nom: cat.nom, icone: cat.icone, couleur: cat.couleur,
    count: produits.filter(p => p.categorie === cat.nom).length
  }))

  // ── Modal ────────────────────────────────────────────────
  const sousCategoriesDisponibles = () => {
    const cat = categories.find(c => c.nom === categorieFormValue)
    return cat?.sous_categories || []
  }

  const ouvrirModal = (produit = null) => {
    setEditingProduit(produit)
    if (produit) {
      const attrs = (() => { try { return JSON.parse(produit.attributs || '{}') } catch { return {} } })()
      form.setFieldsValue({
        ...produit,
        garantie:          attrs.garantie,
        description_courte: attrs.description,
        fournisseur_habit:  attrs.fournisseur,
        couleurs:           attrs.couleurs,
        tailles:            attrs.tailles
      })
      setUnitesLocales(Array.isArray(produit.unites_multiples) ? produit.unites_multiples : [])
    } else {
      form.resetFields()
      setUnitesLocales([])
    }
    setModalVisible(true)
  }

  const fermerModal = () => {
    setModalVisible(false)
    setEditingProduit(null)
    form.resetFields()
    setUnitesLocales([])
  }

  const sauvegarderProduit = async (values) => {
    if (!ipcRenderer) return
    const { garantie, description_courte, fournisseur_habit, couleurs, tailles, ...rest } = values
    const attrs = {}
    if (garantie)           attrs.garantie    = garantie
    if (description_courte) attrs.description = description_courte
    if (fournisseur_habit)  attrs.fournisseur = fournisseur_habit
    if (couleurs?.length)   attrs.couleurs    = couleurs
    if (tailles?.length)    attrs.tailles     = tailles
    const produitData = {
      ...rest,
      attributs:       Object.keys(attrs).length ? JSON.stringify(attrs) : null,
      unites_multiples: unitesLocales.length >= 2 ? unitesLocales : null
    }
    if (editingProduit) {
      await ipcRenderer.invoke('produits:update', { ...produitData, id: editingProduit.id })
      message.success('✅ Produit modifié !')
    } else {
      const result = await ipcRenderer.invoke('produits:create', produitData)
      if (result.erreur) { message.error(`❌ ${result.erreur}`); return }
      message.success('✅ Produit ajouté !')
    }
    chargerProduits()
    fermerModal()
  }

  const supprimerProduit = async (id) => {
    if (!ipcRenderer) return
    await ipcRenderer.invoke('produits:delete', id)
    message.success('✅ Produit supprimé !')
    chargerProduits()
  }

  // ── Helper catégorie ─────────────────────────────────────
  const obtenirCategorieInfo = (nomCategorie) => {
    const cat = categories.find(c => c.nom === nomCategorie)
    if (!cat) return { icone: '📦', couleur: 'linear-gradient(135deg, #1890ff, #096dd9)' }
    const gradientMap = {
      blue:    'linear-gradient(135deg, #1890ff, #096dd9)',
      green:   'linear-gradient(135deg, #52c41a, #389e0d)',
      orange:  'linear-gradient(135deg, #faad14, #ca8611)',
      red:     'linear-gradient(135deg, #f5222d, #c41d7f)',
      purple:  'linear-gradient(135deg, #722ed1, #531dab)',
      cyan:    'linear-gradient(135deg, #13c2c2, #0f8f8f)',
      gold:    'linear-gradient(135deg, #fadb14, #d48806)',
      magenta: 'linear-gradient(135deg, #eb2f96, #ad1d28)'
    }
    return { icone: cat.icone, couleur: gradientMap[cat.couleur] || gradientMap['blue'] }
  }

  const bgMap = {
    blue: '#e6f7ff', green: '#f6ffed', orange: '#fff7e6',
    red: '#fff2f0', purple: '#f9f0ff', cyan: '#e6fffb',
    gold: '#fffbe6', magenta: '#fef2f5'
  }

  // ── Colonnes tableau ─────────────────────────────────────
  const columns = [
    {
      title: 'Référence', dataIndex: 'reference', key: 'reference',
      render: (val) => (
        <Tag style={{
          background: '#e6f7ff', border: '1px solid #91d5ff',
          color: '#1890ff', borderRadius: 8, fontWeight: 'bold'
        }}>{val}</Tag>
      )
    },
    {
      title: 'Produit', dataIndex: 'nom', key: 'nom',
      render: (val, record) => {
        const catInfo = obtenirCategorieInfo(record.categorie)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: catInfo.couleur,
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 16, flexShrink: 0
            }}>
              {catInfo.icone}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Text strong>{val}</Text>
                {estNouveau(record) && (
                  <Tag color="volcano" style={{
                    borderRadius: 10, fontSize: 10, lineHeight: '16px',
                    padding: '0 6px', margin: 0, fontWeight: 'bold'
                  }} title={`Ajouté ${depuisTexte(record.created_at)}`}>
                    🆕 NOUVEAU
                  </Tag>
                )}
              </div>
              <Text style={{ color: '#8c8c8c', fontSize: 12 }}>{record.marque || '—'}</Text>
            </div>
          </div>
        )
      }
    },
    {
      title: 'Catégorie / Sous-cat.', dataIndex: 'categorie', key: 'categorie',
      render: (cat, record) => {
        const catObj = categories.find(c => c.nom === cat)
        return (
          <div>
            <Tag color={catObj?.couleur || 'blue'} style={{ borderRadius: 12 }}>
              {catObj?.icone || '📦'} {cat}
            </Tag>
            {record.sous_categorie && (
              <Tag style={{ borderRadius: 12, marginTop: 2, display: 'block', width: 'fit-content' }}>
                🔖 {record.sous_categorie}
              </Tag>
            )}
          </div>
        )
      }
    },
    {
      title: 'Prix Achat', dataIndex: 'prix_achat', key: 'prix_achat',
      render: (val) => <Text style={{ color: '#ff4d4f' }}>{fmtN(val)} FCFA</Text>
    },
    {
      title: 'Prix Vente', dataIndex: 'prix_vente', key: 'prix_vente',
      render: (val, record) => (
        <Text strong style={{ color: '#52c41a' }}>
          {fmtN(val)} FCFA
          <Text style={{ color: '#95de64', fontSize: 11, fontWeight: 'normal' }}>
            {' '}/ {record.unite || 'pièce'}
            {record.conditionnement > 0 && record.unite_conditionnement && (
              <span style={{ color: '#aaa', marginLeft: 2 }}>
                ({fmtN(record.conditionnement)} {record.unite_conditionnement})
              </span>
            )}
          </Text>
        </Text>
      )
    },
    {
      title: 'Marge %', key: 'marge',
      render: (_, record) => {
        if (!record.prix_achat || record.prix_achat === 0) return <Text>—</Text>
        const marge = ((record.prix_vente - record.prix_achat) / record.prix_achat * 100).toFixed(1)
        const couleur = marge < 20 ? '#ff4d4f' : marge < 50 ? '#faad14' : '#52c41a'
        return <Text style={{ color: couleur, fontWeight: 'bold' }}>{marge}%</Text>
      }
    },
    {
      title: 'Stock', dataIndex: 'stock_actuel', key: 'stock_actuel',
      render: (val, record) => {
        const critique    = val <= record.stock_minimum
        const enCommande  = Number(record.en_commande) || 0
        const disponible  = Math.max(0, val - enCommande)
        const unite       = record.unite || 'pièce'
        const cond        = record.conditionnement > 0 && record.unite_conditionnement
          ? ` (${fmtN(record.conditionnement)} ${record.unite_conditionnement})`
          : ''
        const fmt = v => fmtN(v)

        // Affichage multi-niveaux — décomposition complète (19 tonnes + 25 sacs + 0 sachets)
        const unites = Array.isArray(record.unites_multiples) && record.unites_multiples.length >= 2
          ? [...record.unites_multiples].sort((a, b) => b.facteur - a.facteur)
          : null
        const stockMulti = (() => {
          if (!unites) return null
          let reste = val
          const parts = []
          for (const u of unites) {
            const qte = Math.floor(reste / u.facteur)
            reste = reste % u.facteur
            if (qte > 0) parts.push(`${fmtN(qte)} ${u.label}`)
          }
          return parts.length ? parts.join(' + ') : `0 ${unites[unites.length - 1]?.label}`
        })()

        return (
          <div>
            <Badge status={critique ? 'error' : 'success'} text={
              <Text style={{ color: critique ? '#ff4d4f' : '#52c41a', fontWeight: 'bold' }}>
                {unites
                  ? <>{fmtN(val)} <span style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 'normal' }}>{unites[unites.length-1]?.label}</span></>
                  : <>{fmt(val)} {unite}{cond && <span style={{ color: '#8c8c8c', fontWeight: 'normal', fontSize: 11 }}>{cond}</span>}</>
                }
              </Text>
            } />
            {unites && stockMulti && (
              <div style={{ fontSize: 11, color: '#1d39c4', marginTop: 2 }}>
                ≈ {stockMulti}
              </div>
            )}
            {enCommande > 0 && (
              <Text style={{ color: '#fa8c16', fontSize: 11, display: 'block' }}>
                📦 {fmt(enCommande)} réservé(s) · {fmt(disponible)} dispo
              </Text>
            )}
            {critique && (
              <Text style={{ color: '#ff4d4f', fontSize: 11, display: 'block' }}>
                ⚠️ Stock faible !
              </Text>
            )}
          </div>
        )
      }
    },
    {
      title: 'Actions', key: 'actions',
      render: (_, record) => (
        <Space>
          {peutModifier(role) && (
            <Button type="primary" icon={<EditOutlined />} size="small"
              style={{ borderRadius: 8 }} onClick={() => ouvrirModal(record)}>
              Modifier
            </Button>
          )}
          {peutSupprimer(role) && (
            <Popconfirm title="Supprimer ce produit ?"
              onConfirm={() => supprimerProduit(record.id)}
              okText="Oui" cancelText="Non">
              <Button danger icon={<DeleteOutlined />} size="small" style={{ borderRadius: 8 }}>
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

  // ── RENDU ────────────────────────────────────────────────
  return (
    <div>
      {/* Alerte domaine */}
      {!domaineActive && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          message="⚠️ Domaine non configuré"
          description="Allez dans Paramètres → Domaine pour choisir votre type de commerce." />
      )}

      {/* En-tête */}
      <div style={{
        background: theme.gradient,
        borderRadius: 16, padding: '20px 28px', marginBottom: 24,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            fontSize: 40, lineHeight: 1,
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 12, padding: '8px 12px'
          }}>
            {domaine?.icone || '📦'}
          </div>
          <div>
            <Title level={2} style={{ color: 'white', margin: 0 }}>
              {domaine?.nom || 'Gestion des Produits'}
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
              {domaineActive ? theme.description : 'Gérez votre catalogue de produits'}
            </Text>
          </div>
        </div>
        {peutAjouter(role) && (
          <Button icon={<PlusOutlined />} size="large"
            onClick={() => ouvrirModal()} disabled={!domaineActive}
            style={{
              borderRadius: 10, fontWeight: 'bold', height: 44,
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)', color: 'white'
            }}>
            Ajouter un Produit
          </Button>
        )}
      </div>

      {/* Stats KPI */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card hoverable onClick={voirTousProduits}
            style={{ borderRadius: 12, border: 'none', background: theme.lightBg, cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '16px 20px' }}>
            <Statistic title={<Text style={{ color: '#8c8c8c' }}>Total Produits</Text>}
              value={totalProduits}
              prefix={<AppstoreOutlined style={{ color: theme.primaryColor }} />}
              valueStyle={{ color: theme.primaryColor, fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable onClick={voirAlertesStock}
            style={{ borderRadius: 12, border: 'none', background: '#fff2f0', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '16px 20px' }}>
            <Statistic title={<Text style={{ color: '#8c8c8c' }}>Alertes Stock</Text>}
              value={alertesStock}
              prefix={<WarningOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f', fontSize: 22 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable onClick={() => setModalValeurStock(true)}
            style={{ borderRadius: 12, border: 'none', background: '#f6ffed', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '16px 20px' }}>
            <Statistic title={<Text style={{ color: '#8c8c8c' }}>Valeur Stock</Text>}
              value={fmtN(valeurStock)} suffix="FCFA"
              prefix={<ShoppingOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: 18 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card hoverable onClick={() => setModalMarge(true)}
            style={{ borderRadius: 12, border: 'none', background: '#fffbe6', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
            bodyStyle={{ padding: '16px 20px' }}>
            <Statistic title={<Text style={{ color: '#8c8c8c' }}>Marge Globale</Text>}
              value={margeGlobalalePercent} suffix="%"
              prefix={<BarChartOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14', fontSize: 22 }} precision={1} />
          </Card>
        </Col>

        {/* Cartes dynamiques par catégorie — cliquer filtre le tableau sur cette catégorie */}
        {!categoriesMasquees && statsCat.map((cat) => (
          <Col span={6} key={cat.id}>
            <Card hoverable onClick={() => voirCategorie(cat.nom)}
              style={{
                borderRadius: 12, border: 'none', cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                background: bgMap[cat.couleur] || '#f0f0f0'
              }} bodyStyle={{ padding: '16px 20px' }}>
              <Statistic
                title={<Text style={{ color: '#8c8c8c' }}>{cat.nom}</Text>}
                value={cat.count}
                prefix={<span style={{ fontSize: 18 }}>{cat.icone}</span>}
                valueStyle={{ color: '#1890ff', fontSize: 22 }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Derniers ajouts — affichage smart des articles récemment ajoutés */}
      {derniersAjouts.length > 0 && (
        <Card style={{ marginBottom: 20, borderRadius: 12, border: 'none',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }} bodyStyle={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text strong style={{ fontSize: 15 }}>🆕 Derniers ajouts</Text>
            {nbNouveaux > 0 && (
              <Tag color="volcano" style={{ borderRadius: 10, fontWeight: 'bold' }}>
                {nbNouveaux} produit{nbNouveaux > 1 ? 's' : ''} ajouté{nbNouveaux > 1 ? 's' : ''} récemment
              </Tag>
            )}
          </div>
          <Row gutter={12}>
            {derniersAjouts.map(p => {
              const catInfo = obtenirCategorieInfo(p.categorie)
              const nouveau = estNouveau(p)
              return (
                <Col span={24 / derniersAjouts.length} key={p.id}>
                  <div
                    onClick={() => peutModifier(role) && ouvrirModal(p)}
                    title={p.created_at ? `Ajouté ${depuisTexte(p.created_at)}` : undefined}
                    style={{
                      cursor: peutModifier(role) ? 'pointer' : 'default',
                      border: '1px solid #f0f0f0', borderRadius: 10,
                      padding: '10px 12px', position: 'relative',
                      display: 'flex', alignItems: 'center', gap: 10,
                      transition: 'box-shadow .15s, border-color .15s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.08)'
                      e.currentTarget.style.borderColor = theme.primaryColor || '#1890ff'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.boxShadow = 'none'
                      e.currentTarget.style.borderColor = '#f0f0f0'
                    }}
                  >
                    {nouveau && (
                      <div style={{
                        position: 'absolute', top: -8, right: -6,
                        background: '#ff4d4f', color: 'white',
                        fontSize: 10, fontWeight: 'bold', padding: '1px 6px',
                        borderRadius: 10, boxShadow: '0 2px 6px rgba(255,77,79,0.4)'
                      }}>
                        NOUVEAU
                      </div>
                    )}
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, background: catInfo.couleur,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, flexShrink: 0
                    }}>
                      {catInfo.icone}
                    </div>
                    <div style={{ overflow: 'hidden', minWidth: 0 }}>
                      <Text strong style={{
                        display: 'block', fontSize: 13, whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {p.nom}
                      </Text>
                      <Text style={{ color: '#52c41a', fontSize: 12, fontWeight: 600 }}>
                        {fmtN(p.prix_vente)} FCFA
                      </Text>
                    </div>
                  </div>
                </Col>
              )
            })}
          </Row>
        </Card>
      )}

      {/* Filtres */}
      <Card style={{ marginBottom: 16, borderRadius: 12, border: 'none',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Row gutter={16} align="middle" style={{ marginBottom: 12 }}>
          <Col span={10}>
            <Search placeholder="Rechercher par nom, référence ou marque..."
              allowClear prefix={<SearchOutlined style={{ color: '#1890ff' }} />}
              value={recherche} onChange={(e) => setRecherche(e.target.value)}
              size="large" />
          </Col>
          <Col span={6}>
            <Select placeholder="Filtrer par catégorie" allowClear
              style={{ width: '100%' }} size="large"
              value={filtreCategorie} onChange={setFiltreCategorie}
              disabled={!domaineActive || categoriesMasquees}>
              {categoriesDuDomaine.map(cat => (
                <Option key={cat.id} value={cat.nom}>{cat.icone} {cat.nom}</Option>
              ))}
            </Select>
          </Col>
          <Col span={8} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{
              background: '#f0f5ff', padding: '8px 16px',
              borderRadius: 8, minWidth: 90, textAlign: 'center'
            }}>
              <Text style={{ color: '#1890ff', fontWeight: 'bold', display: 'block' }}>
                {produitsFiltres.length}
              </Text>
              <Text style={{ color: '#8c8c8c', fontSize: 12 }}>/ {produits.length} produits</Text>
            </div>
          </Col>
        </Row>
        <Space wrap size={8}>
          <Button icon={categoriesMasquees ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            size="large" onClick={basculerCategories}
            type={categoriesMasquees ? 'primary' : 'default'}
            style={{ borderRadius: 8 }}>
            {categoriesMasquees ? 'Afficher catégories' : 'Masquer catégories'}
          </Button>
          <Button icon={<FilterOutlined />} size="large"
            onClick={() => setDrawerFiltreVisible(true)}
            style={{ borderRadius: 8 }}>
            Filtres avancés
          </Button>
          <Button icon={<DownloadOutlined />} size="large"
            onClick={exporterExcel} style={{ borderRadius: 8 }}>
            Exporter Excel
          </Button>
          <input type="file" accept=".xlsx,.xls,.csv" ref={inputImportExcelRef}
            onChange={gererFichierExcelSelectionne} style={{ display: 'none' }} />
          <Button icon={<UploadOutlined />} size="large" loading={importEnCours}
            onClick={importerExcel} disabled={!domaineActive}
            style={{ borderRadius: 8 }}>
            Importer Excel
          </Button>
          <Button icon={<DownloadOutlined />} size="large" loading={modeleEnCours}
            onClick={telechargerModele}
            style={{ borderRadius: 8 }}>
            Modèle Excel
          </Button>
          <Button icon={<ClearOutlined />} size="large"
            onClick={reinitialiserFiltres} style={{ borderRadius: 8 }}>
            Réinitialiser
          </Button>
        </Space>
      </Card>

      {/* Tableau */}
      <Card ref={tableRef} style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Table
          dataSource={produitsFiltres}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 50, showTotal: (t) => `${t} produits au total` }}
          rowClassName={(record) =>
            record.stock_actuel <= record.stock_minimum ? 'row-alerte' : ''
          }
        />
      </Card>

      {/* Modal Produit */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              background: theme.gradient || 'linear-gradient(135deg,#1890ff,#722ed1)',
              borderRadius: 8, padding: '5px 10px', color: 'white', fontSize: 16
            }}>
              {domaine?.icone || <ShoppingOutlined />}
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 14 }}>
                {editingProduit ? 'Modifier l\'article' : (
                  isRestaurant ? 'Nouveau plat / article'
                  : isAlimentaire ? 'Nouveau produit alimentaire'
                  : isBTP ? 'Nouvel article / matériau'
                  : isTextile ? 'Nouvel article de mode'
                  : isInformatique ? 'Nouvel équipement'
                  : 'Nouveau produit'
                )}
              </div>
              {domaine && (
                <div style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 'normal' }}>
                  {domaine.nom}
                </div>
              )}
            </div>
          </div>
        }
        open={modalVisible} onCancel={fermerModal} footer={null} width={720}
      >
        <Tabs defaultActiveKey="1" items={[
          {
            key: '1',
            label: '📋 Informations générales',
            children: (
              <Form form={form} layout="vertical" onFinish={sauvegarderProduit}>

                {/* ── Banderole domaine ── */}
                {domaineActive && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 10, marginBottom: 16,
                    background: theme.lightBg, border: `1.5px solid ${theme.borderColor}`
                  }}>
                    <span style={{ fontSize: 22 }}>{domaine?.icone}</span>
                    <div>
                      <div style={{ fontWeight: 'bold', color: theme.primaryColor, fontSize: 13 }}>
                        {domaine?.nom}
                      </div>
                      <div style={{ fontSize: 11, color: '#8c8c8c' }}>{formCfg.hint}</div>
                    </div>
                  </div>
                )}

                {/* ── Référence + Catégorie ── */}
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="reference"
                      label={formCfg.referenceLabel}
                      rules={formCfg.referenceRequired
                        ? [{ required: true, message: `${formCfg.referenceLabel} obligatoire` }]
                        : []}
                    >
                      <Input placeholder={formCfg.referencePlaceholder} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="categorie" label="Catégorie"
                      rules={[{ required: true, message: 'Catégorie obligatoire' }]}>
                      <Select placeholder="Choisir une catégorie"
                        disabled={!domaineActive || categoriesDuDomaine.length === 0}
                        onChange={() => form.setFieldValue('sous_categorie', undefined)}>
                        {categoriesDuDomaine.map(cat => (
                          <Option key={cat.id} value={cat.nom}>{cat.icone} {cat.nom}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                {/* ── Sous-catégorie + Marque ── */}
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="sous_categorie" label="Sous-catégorie (optionnel)">
                      <Select
                        placeholder={!categorieFormValue ? 'Choisissez d\'abord une catégorie'
                          : sousCategoriesDisponibles().length === 0 ? 'Aucune sous-catégorie'
                          : 'Choisir une sous-catégorie'}
                        allowClear
                        disabled={!categorieFormValue || sousCategoriesDisponibles().length === 0}>
                        {sousCategoriesDisponibles().map(sc => (
                          <Option key={sc.id} value={sc.nom}>🔖 {sc.nom}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    {!isRestaurant && (
                      <Form.Item name="marque" label={theme.marqueLabel}>
                        <Input placeholder={theme.marquePlaceholder} />
                      </Form.Item>
                    )}
                  </Col>
                </Row>

                {/* ── Nom du produit ── */}
                <Form.Item name="nom" label={formCfg.nomLabel}
                  rules={[{ required: true, message: 'Nom obligatoire' }]}>
                  <Input placeholder={formCfg.nomPlaceholder} size="large" />
                </Form.Item>

                {/* ── Champs spécifiques au domaine ── */}
                {isInformatique && (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="garantie" label="🛡️ Garantie">
                        <Select placeholder="Durée de garantie" allowClear>
                          <Option value="aucune">Sans garantie</Option>
                          <Option value="3mois">3 mois</Option>
                          <Option value="6mois">6 mois</Option>
                          <Option value="1an">1 an</Option>
                          <Option value="2ans">2 ans</Option>
                          <Option value="3ans">3 ans</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="marque" label={theme.marqueLabel}>
                        <Input placeholder={theme.marquePlaceholder} />
                      </Form.Item>
                    </Col>
                  </Row>
                )}

                {isRestaurant && (
                  <Form.Item name="description_courte" label="📝 Description du plat (optionnel)">
                    <Input.TextArea rows={2}
                      placeholder="Ex: Riz au poisson sauce tomate, servi avec légumes sautés et salade..." />
                  </Form.Item>
                )}

                {isBTP && (
                  <Form.Item name="fournisseur_habit" label="🏭 Fournisseur habituel (optionnel)">
                    <Input placeholder="Ex: Cimaf, Dangote, DSC, fournisseur local..." />
                  </Form.Item>
                )}

                {isTextile && (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="couleurs" label="🎨 Couleurs disponibles">
                        <Select mode="tags" placeholder="Tapez ou sélectionnez..." tokenSeparators={[',']}>
                          {['Blanc', 'Noir', 'Rouge', 'Bleu', 'Vert', 'Jaune', 'Rose', 'Gris',
                            'Marron', 'Beige', 'Violet', 'Orange', 'Multicolore'].map(c => (
                            <Option key={c} value={c}>{c}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="tailles" label="📐 Tailles disponibles">
                        <Select mode="tags" placeholder="Tapez ou sélectionnez..." tokenSeparators={[',']}>
                          {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL',
                            '36', '37', '38', '39', '40', '41', '42', '43', '44', '45',
                            'Unique', '38/40', '42/44'].map(t => (
                            <Option key={t} value={t}>{t}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                )}

                {/* ── Unité de mesure (recommandées selon domaine en premier) ── */}
                <Form.Item name="unite" label="Unité de mesure" initialValue={theme.defaultUnite}>
                  <Select showSearch placeholder="Sélectionner une unité">
                    {theme.unitesDisponibles?.length > 0 && (
                      <OptGroup label={`⭐ Recommandées — ${domaine?.nom || 'Ce domaine'}`}>
                        {theme.unitesDisponibles.map(u => (
                          <Option key={`rec-${u}`} value={u}>{u}</Option>
                        ))}
                      </OptGroup>
                    )}
                    {UNITE_GROUPS_SELECT.map(({ label, opts }) => {
                      const filtered = opts.filter(u => !(theme.unitesDisponibles || []).includes(u))
                      return filtered.length ? (
                        <OptGroup key={label} label={label}>
                          {filtered.map(u => <Option key={u} value={u}>{u}</Option>)}
                        </OptGroup>
                      ) : null
                    })}
                  </Select>
                </Form.Item>

                {/* ── Conditionnement — masqué si niveaux multi-unités actifs ── */}
                {unitesLocales.length < 2 && <Row gutter={12} align="bottom">
                  <Col span={10}>
                    <Form.Item name="conditionnement" label="Contenance par unité"
                      tooltip="Ex : pour un sac de 25 kg, mettez 25. Laissez vide si l'unité n'a pas de contenance précise.">
                      <InputNumber style={{ width: '100%' }} min={0} step={0.5} precision={3}
                        placeholder="Ex : 25, 1.5, 500…"
                        addonBefore={<span style={{ color: '#595959', fontSize: 12 }}>{uniteFormValue || '—'}</span>}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={14}>
                    <Form.Item name="unite_conditionnement" label="Unité de la contenance">
                      <Select allowClear showSearch placeholder="kg, sac, bouteille, L…" disabled={!conditionnementFormValue}>
                        {UNITE_GROUPS_SELECT.map(({ label, opts }) => (
                          <OptGroup key={label} label={label}>
                            {opts.map(u => <Option key={u} value={u}>{u}</Option>)}
                          </OptGroup>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>}

                {/* ── Multi-niveaux : sachet → sac → tonne etc. ── */}
                <div style={{
                  background: '#f0f5ff', border: '1px solid #adc6ff',
                  borderRadius: 8, padding: '10px 14px', marginBottom: 16
                }}>
                  <div style={{ fontSize: 12, color: '#2f54eb', fontWeight: 600, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>📐 Niveaux de vente (vente en gros, détail, petit détail…)</span>
                    {unitesLocales.length === 0 && (
                      <span style={{ fontWeight: 400, color: '#8c8c8c' }}>Optionnel — laissez vide si un seul conditionnement</span>
                    )}
                  </div>

                  {unitesLocales.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      {/* En-têtes */}
                      <div style={{ display: 'grid', gridTemplateColumns: '16px 1fr 110px 130px 32px', gap: 6, marginBottom: 4 }}>
                        <div />
                        <div style={{ fontSize: 11, color: '#8c8c8c', paddingLeft: 2 }}>Unité</div>
                        <div style={{ fontSize: 11, color: '#8c8c8c', textAlign: 'center' }}>= X unités base</div>
                        <div style={{ fontSize: 11, color: '#8c8c8c', textAlign: 'center' }}>Prix vente (FCFA)</div>
                        <div />
                      </div>
                      {unitesLocales.map((u, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '16px 1fr 110px 130px 32px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                          {/* Indicateur base */}
                          <div style={{ textAlign: 'center', fontSize: 11, color: '#2f54eb', lineHeight: 1 }}>
                            {i === 0 ? '⭐' : ''}
                          </div>
                          <AutoComplete
                            size="small"
                            value={u.label}
                            placeholder={i === 0 ? 'Ex : sachet, pièce, kg…' : 'Ex : sac, carton, tonne…'}
                            options={UNITES_NIVEAUX_OPTIONS}
                            filterOption={(input, option) =>
                              option.value
                                ? option.value.toLowerCase().includes(input.toLowerCase())
                                : false
                            }
                            onChange={val => setUnitesLocales(prev => prev.map((x, j) =>
                              j === i ? { ...x, label: val, code: val.toLowerCase().replace(/\s+/g, '_') } : x
                            ))}
                            style={{ width: '100%' }}
                          />
                          <InputNumber
                            size="small" min={0.0001} step={1}
                            value={u.facteur}
                            disabled={i === 0}
                            style={{ width: '100%' }}
                            onChange={v => setUnitesLocales(prev => prev.map((x, j) => j === i ? { ...x, facteur: v || 1 } : x))}
                            placeholder={i === 0 ? '1' : 'Ex : 20'}
                          />
                          <InputNumber
                            size="small" min={0} step={100}
                            value={u.prix}
                            style={{ width: '100%' }}
                            onChange={v => setUnitesLocales(prev => prev.map((x, j) => j === i ? { ...x, prix: v || 0 } : x))}
                            placeholder="Prix"
                            formatter={v => v ? Number(v).toLocaleString('fr-FR') : ''}
                            parser={s => parseInt((s || '').replace(/\s/g, '').replace(/[^\d]/g, ''), 10) || 0}
                          />
                          {i === 0
                            ? <div />
                            : <Button danger size="small" icon={<DeleteOutlined />}
                                onClick={() => setUnitesLocales(prev => prev.filter((_, j) => j !== i))} />
                          }
                        </div>
                      ))}
                    </div>
                  )}

                  <Button size="small" type="dashed" icon={<PlusOutlined />}
                    style={{ width: '100%', borderColor: '#adc6ff', color: '#2f54eb' }}
                    onClick={() => {
                      if (unitesLocales.length === 0) {
                        // Premier ajout : créer l'unité de base automatiquement
                        setUnitesLocales([
                          { code: uniteFormValue || 'unite_base', label: uniteFormValue || 'Unité de base', facteur: 1, prix: form.getFieldValue('prix_vente') || 0 },
                          { code: '', label: '', facteur: null, prix: 0 }
                        ])
                      } else {
                        setUnitesLocales(prev => [...prev, { code: '', label: '', facteur: null, prix: 0 }])
                      }
                    }}>
                    + Ajouter un niveau
                  </Button>

                  {unitesLocales.length >= 2 && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#8c8c8c' }}>
                      ⭐ = unité de base — le stock est comptabilisé dans cette unité.
                      Les autres niveaux se convertissent par le facteur saisi.
                    </div>
                  )}
                </div>

                {/* ── Double unité — masqué si niveaux multi-unités actifs (redondant) ── */}
                {unitesLocales.length < 2 && <div style={{
                  background: '#fffbe6', border: '1px dashed #ffe58f',
                  borderRadius: 8, padding: '10px 14px', marginBottom: 16
                }}>
                  <div style={{ fontSize: 12, color: '#ad6800', fontWeight: 600, marginBottom: 8 }}>
                    🔄 Approvisionner en gros, vendre au détail (optionnel)
                  </div>
                  <Row gutter={12}>
                    <Col span={10}>
                      <Form.Item name="unite_achat" label="Unité d'achat"
                        tooltip="Ex : tonne, carton, bidon 200L… L'unité dans laquelle vous achetez au fournisseur."
                        style={{ marginBottom: 0 }}>
                        <Select allowClear showSearch placeholder="Ex : tonne, carton, bouteille…">
                          {UNITE_GROUPS_SELECT.map(({ label, opts }) => (
                            <OptGroup key={label} label={label}>
                              {opts.map(u => <Option key={u} value={u}>{u}</Option>)}
                            </OptGroup>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={14}>
                      <Form.Item name="facteur_conversion" label={`Nb de « ${uniteFormValue || 'unité vendue'} » par unité d'achat`}
                        tooltip="Ex : 1 tonne de ciment = 40 sacs → saisissez 40"
                        style={{ marginBottom: 0 }}>
                        <InputNumber style={{ width: '100%' }} min={0.0001} step={1} precision={4}
                          placeholder="Ex : 40, 12, 24…" />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>}

                {/* ── Prix ── */}
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="prix_achat" label={formCfg.prixAchatLabel}
                      rules={[{ required: true, message: 'Prix achat obligatoire' }]}>
                      <InputNumber style={{ width: '100%' }} min={0}
                        formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="prix_vente" label={formCfg.prixVenteLabel}
                      rules={[{ required: true, message: 'Prix vente obligatoire' }]}>
                      <InputNumber style={{ width: '100%' }} min={0}
                        formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
                    </Form.Item>
                  </Col>
                </Row>

                {/* ── Stock ── */}
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="stock_actuel" label={formCfg.stockLabel}
                      rules={[{ required: true, message: 'Stock obligatoire' }]}>
                      <InputNumber style={{ width: '100%' }} min={0}
                        step={UNITES_DECIMALES.includes(uniteFormValue) ? 0.5 : 1}
                        precision={UNITES_DECIMALES.includes(uniteFormValue) ? 2 : 0}
                        addonAfter={uniteFormValue || theme.defaultUnite} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="stock_minimum"
                      label={isRestaurant ? 'Seuil d\'alerte (rupture)' : 'Stock minimum alerte'}>
                      <InputNumber style={{ width: '100%' }} min={0}
                        step={UNITES_DECIMALES.includes(uniteFormValue) ? 0.5 : 1}
                        precision={UNITES_DECIMALES.includes(uniteFormValue) ? 2 : 0}
                        addonAfter={uniteFormValue || theme.defaultUnite} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item style={{ marginBottom: 0 }}>
                  <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                    <Button onClick={fermerModal}>Annuler</Button>
                    <Button type="primary" htmlType="submit"
                      style={{ borderRadius: 8, background: theme.gradient, border: 'none' }}>
                      {editingProduit
                        ? '✏️ Modifier'
                        : isRestaurant ? '➕ Ajouter au menu'
                        : isBTP ? '➕ Ajouter à l\'inventaire'
                        : '➕ Ajouter au catalogue'}
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            )
          },
          {
            key: '2',
            label: '💰 Tarification',
            children: editingProduit ? (
              <Row gutter={[16, 16]} style={{ padding: '16px 0' }}>
                {[
                  { titre: "Prix d'achat", val: fmtN(editingProduit.prix_achat), suffix: 'FCFA', color: '#ff4d4f' },
                  { titre: "Prix de vente", val: fmtN(editingProduit.prix_vente), suffix: 'FCFA', color: '#52c41a' },
                  {
                    titre: "Marge unitaire",
                    val: fmtN(editingProduit.prix_vente - editingProduit.prix_achat),
                    suffix: 'FCFA', color: '#52c41a'
                  },
                  {
                    titre: "Marge %",
                    val: editingProduit.prix_achat > 0
                      ? ((editingProduit.prix_vente - editingProduit.prix_achat) / editingProduit.prix_achat * 100).toFixed(1)
                      : 0,
                    suffix: '%', color: '#1890ff'
                  }
                ].map((s, i) => (
                  <Col span={12} key={i}>
                    <Card style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                      <Statistic title={s.titre} value={s.val}
                        suffix={s.suffix} valueStyle={{ color: s.color }} />
                    </Card>
                  </Col>
                ))}
              </Row>
            ) : (
              <Text type="secondary">Créez d'abord le produit pour voir les tarifs</Text>
            )
          }
        ]} />
      </Modal>

      {/* Drawer Filtres Avancés */}
      <Drawer title="🔧 Filtres avancés" placement="right"
        onClose={() => setDrawerFiltreVisible(false)}
        open={drawerFiltreVisible} width={350}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <Text strong>Plage de prix de vente (FCFA)</Text>
            <Row gutter={8} style={{ marginTop: 8 }}>
              <Col span={12}>
                <InputNumber placeholder="Min"
                  value={filtresAvances.prixMin}
                  onChange={(val) => setFiltresAvances(p => ({ ...p, prixMin: val || 0 }))}
                  style={{ width: '100%' }} />
              </Col>
              <Col span={12}>
                <InputNumber placeholder="Max"
                  value={filtresAvances.prixMax}
                  onChange={(val) => setFiltresAvances(p => ({ ...p, prixMax: val || 0 }))}
                  style={{ width: '100%' }} />
              </Col>
            </Row>
          </div>

          <div>
            <Text strong>Stock minimum affiché</Text>
            <InputNumber placeholder="Stock minimum"
              value={filtresAvances.stockMin}
              onChange={(val) => setFiltresAvances(p => ({ ...p, stockMin: val || 0 }))}
              style={{ width: '100%', marginTop: 8 }} min={0} />
          </div>

          <div>
            <Text strong>Plage de marge %</Text>
            <Slider range min={0} max={200}
              value={[filtresAvances.margeMin, filtresAvances.margeMax]}
              onChange={(val) => setFiltresAvances(p => ({
                ...p, margeMin: val[0], margeMax: val[1]
              }))}
              style={{ marginTop: 8 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text>{filtresAvances.margeMin}%</Text>
              <Text>{filtresAvances.margeMax}%</Text>
            </div>
          </div>

          <Checkbox
            checked={filtresAvances.stockCritique}
            onChange={(e) => setFiltresAvances(p => ({
              ...p, stockCritique: e.target.checked
            }))}>
            Afficher seulement les stocks critiques
          </Checkbox>

          <Button type="primary" block size="large"
            onClick={() => setDrawerFiltreVisible(false)}>
            Appliquer les filtres
          </Button>

          <Button block onClick={reinitialiserFiltres}>
            Réinitialiser tout
          </Button>
        </div>
      </Drawer>

      {/* Détail Valeur Stock — répartition par produit, du plus au moins contributeur */}
      <Modal title="📦 Détail — Valeur du Stock"
        open={modalValeurStock} onCancel={() => setModalValeurStock(false)}
        footer={null} width={700}>
        <Text type="secondary">
          Valeur totale (stock actuel × prix d'achat) par produit, triée du plus au moins élevé.
        </Text>
        <Table
          style={{ marginTop: 12 }}
          dataSource={produitsParValeurStock}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
          columns={[
            { title: 'Produit', dataIndex: 'nom', key: 'nom' },
            { title: 'Catégorie', dataIndex: 'categorie', key: 'categorie' },
            { title: 'Stock', dataIndex: 'stock_actuel', key: 'stock_actuel',
              render: (v) => fmtN(v) },
            { title: "Prix d'achat", dataIndex: 'prix_achat', key: 'prix_achat',
              render: (v) => `${fmtN(v)} FCFA` },
            { title: 'Valeur', dataIndex: 'valeurLigne', key: 'valeurLigne',
              render: (v) => <Text strong style={{ color: '#52c41a' }}>{fmtN(v)} FCFA</Text> }
          ]} />
      </Modal>

      {/* Détail Marge Globale — marge % par produit, du plus au moins rentable */}
      <Modal title="📊 Détail — Marge par Produit"
        open={modalMarge} onCancel={() => setModalMarge(false)}
        footer={null} width={700}>
        <Text type="secondary">
          Marge (prix vente − prix achat) / prix achat, par produit, du plus au moins rentable.
        </Text>
        <Table
          style={{ marginTop: 12 }}
          dataSource={produitsParMarge}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
          columns={[
            { title: 'Produit', dataIndex: 'nom', key: 'nom' },
            { title: 'Catégorie', dataIndex: 'categorie', key: 'categorie' },
            { title: "Prix d'achat", dataIndex: 'prix_achat', key: 'prix_achat',
              render: (v) => `${fmtN(v)} FCFA` },
            { title: 'Prix de vente', dataIndex: 'prix_vente', key: 'prix_vente',
              render: (v) => `${fmtN(v)} FCFA` },
            { title: 'Marge', dataIndex: 'margeLigne', key: 'margeLigne',
              render: (v) => <Text strong style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f' }}>{v.toFixed(1)}%</Text> }
          ]} />
      </Modal>
    </div>
  )
}

export default Produits