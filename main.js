const path = require('path')
const fs = require('fs')
const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron')
const { getDbConfigPath } = require('./config/paths')

let mainWindow = null
let tray = null
let quitReelle = false
let estServeurMultiposte = false
// Session minimale côté processus principal — permet au RBAC IPC (Sprint 0)
// de savoir qui appelle, ce que le renderer seul ne peut pas garantir.
let utilisateurConnecte = null

// Monitoring minimal — aucune exception ne doit plus disparaître silencieusement.
const { journaliserErreur } = require('./server/errorLogger')
process.on('uncaughtException', (err) => {
  journaliserErreur({ source: 'main:uncaughtException', message: err.message, stack: err.stack, utilisateur: utilisateurConnecte?.username })
})
process.on('unhandledRejection', (raison) => {
  const err = raison instanceof Error ? raison : new Error(String(raison))
  journaliserErreur({ source: 'main:unhandledRejection', message: err.message, stack: err.stack, utilisateur: utilisateurConnecte?.username })
})

function getIconPath() {
  return app.isPackaged
    ? path.join(__dirname, 'build', 'favicon.ico')
    : path.join(__dirname, 'public', 'favicon.ico')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Nafix — Gestion Commerciale',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, 'build/index.html'))
  } else {
    mainWindow.loadURL('http://localhost:3000')
  }

  // En mode serveur multi-poste, fermer la fenêtre ne doit pas arrêter
  // PostgreSQL (les autres postes en dépendent) : on masque dans la barre
  // système au lieu de quitter, sauf demande explicite via le menu du tray.
  mainWindow.on('close', (e) => {
    if (estServeurMultiposte && !quitReelle) {
      e.preventDefault()
      mainWindow.hide()
    }
  })
}

function creerTray() {
  if (tray) return
  tray = new Tray(getIconPath())
  tray.setToolTip('Nafix — serveur actif (les autres postes peuvent se connecter)')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Ouvrir Nafix', click: () => { if (mainWindow) mainWindow.show(); else createWindow() } },
    { type: 'separator' },
    { label: 'Quitter', click: () => { quitReelle = true; app.quit() } }
  ]))
  tray.on('click', () => { if (mainWindow) mainWindow.show() })
}

// ===== ASSISTANT DE PREMIÈRE CONFIGURATION =====
// Toujours enregistré, que la config existe déjà ou non.
ipcMain.handle('setup:status', () => {
  return { configured: fs.existsSync(getDbConfigPath()) }
})

ipcMain.handle('setup:testConnection', async (_, { host }) => {
  const { detecterPort } = require('./server/dbConnexion')
  const port = await detecterPort(host)
  return { succes: port !== null, port }
})

// Poste client : se connecte à un serveur existant (sur ce PC ou un autre).
ipcMain.handle('setup:configurerConnexion', async (_, { host }) => {
  try {
    const { detecterPort, DB_USER, DB_PASSWORD, DB_NAME } = require('./server/dbConnexion')
    const port = await detecterPort(host)
    if (port === null) {
      return { erreur: `Impossible de joindre PostgreSQL sur ${host}. Vérifiez que le PC serveur est allumé, connecté au réseau, et que sa configuration Nafix est terminée.` }
    }
    const config = { host, port, user: DB_USER, password: DB_PASSWORD, database: DB_NAME, manageLocal: false }
    fs.mkdirSync(path.dirname(getDbConfigPath()), { recursive: true })
    fs.writeFileSync(getDbConfigPath(), JSON.stringify(config, null, 2), 'utf8')

    setTimeout(() => { app.relaunch(); app.exit(0) }, 800)
    return { succes: true }
  } catch (err) {
    return { erreur: err.message }
  }
})

// Ce PC héberge lui-même PostgreSQL — mono-poste (personne d'autre ne s'y
// connecte) ou serveur multi-poste (d'autres postes s'y connecteront).
// PostgreSQL est provisionné et géré comme simple processus par Nafix, sans
// service Windows ni fenêtre UAC en cours d'utilisation (sauf, en multi-poste
// uniquement, une seule autorisation pour ouvrir le pare-feu).
ipcMain.handle('setup:configurerLocal', async (_, { reseauOuvert }) => {
  try {
    const pgManager = require('./server/pgManager')
    const resultat = await pgManager.provisionner(!!reseauOuvert)
    const config = {
      host: '127.0.0.1',
      port: resultat.port,
      user: pgManager.DB_USER,
      password: pgManager.DB_PASSWORD,
      database: pgManager.DB_NAME,
      manageLocal: true,
      reseauOuvert: !!reseauOuvert
    }
    fs.mkdirSync(path.dirname(getDbConfigPath()), { recursive: true })
    fs.writeFileSync(getDbConfigPath(), JSON.stringify(config, null, 2), 'utf8')

    if (reseauOuvert) {
      app.setLoginItemSettings({ openAtLogin: true })
    }

    // Le redémarrage final n'est déclenché qu'via setup:terminerConfiguration
    // — ça laisse le temps d'afficher (et de réessayer) l'état du pare-feu
    // en mode serveur multi-poste avant de continuer.
    return { succes: true, ipLocale: resultat.ipLocale, parefeuOk: resultat.parefeuOk }
  } catch (err) {
    return { erreur: err.message }
  }
})

// Réessaie uniquement l'ouverture du pare-feu (bouton "Réessayer" affiché
// dans l'assistant si la première tentative a échoué), sans redémarrer
// PostgreSQL ni tout reprovisionner.
ipcMain.handle('setup:reessayerParefeu', async () => {
  try {
    const pgManager = require('./server/pgManager')
    const ok = await pgManager.reessayerParefeu()
    return { succes: ok }
  } catch (err) {
    return { erreur: err.message }
  }
})

ipcMain.handle('setup:terminerConfiguration', () => {
  setTimeout(() => { app.relaunch(); app.exit(0) }, 300)
  return { succes: true }
})

// ===== DÉMARRAGE =====
app.whenReady().then(async () => {
  if (!fs.existsSync(getDbConfigPath())) {
    // Pas encore configuré : on affiche l'assistant (App.js décide via setup:status).
    createWindow()
    return
  }

  try {
    const config = JSON.parse(fs.readFileSync(getDbConfigPath(), 'utf8'))

    if (config.manageLocal) {
      console.log('🔄 Démarrage de PostgreSQL local...')
      const pgManager = require('./server/pgManager')
      await pgManager.assurerDemarre()
      if (config.reseauOuvert) {
        estServeurMultiposte = true
        creerTray()
      }
    }

    console.log('🔄 Connexion à PostgreSQL...')
    registerAppHandlers()
    const runMigrations = require('./db/migrate')
    await runMigrations()
    console.log('✅ PostgreSQL connecté et migrations appliquées')
    createWindow()
  } catch (err) {
    console.error('❌ Impossible de démarrer après plusieurs tentatives.')
    console.error('   Cause :', err.message)
    console.error('   Vérifiez que PostgreSQL est démarré et que config/db.config.json est correct.')
    const { dialog } = require('electron')
    dialog.showErrorBox(
      'Nafix — Connexion échouée',
      `Impossible de joindre PostgreSQL.\n\nCause : ${err.message}\n\nVérifiez que le service PostgreSQL est démarré,\npuis relancez Nafix.`
    )
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !estServeurMultiposte) app.quit()
})

// ===== HANDLERS DE L'APPLICATION (uniquement une fois configurée) =====
function registerAppHandlers() {
  const AuthService = require('./auth/AuthService')
  const { verifierPermission } = require('./core/services/permissionsService')
  const produitsService = require('./core/services/produitsService')
  const clientsService = require('./core/services/clientsService')
  const ventesService = require('./core/services/ventesService')
  const devisService = require('./core/services/devisService')
  const achatsService = require('./core/services/achatsService')
  const fournisseursService = require('./core/services/fournisseursService')
  const tresorerieService = require('./core/services/tresorerieService')
  const retoursService = require('./core/services/retoursService')
  const commandesService = require('./core/services/commandesService')
  const avoirsService = require('./core/services/avoirsService')
  const dashboardService = require('./core/services/dashboardService')
  const statistiquesService = require('./core/services/statistiquesService')
  const organisationsService = require('./core/services/organisationsService')

  // Sprint 4 — l'organisation vient désormais de l'utilisateur authentifié
  // (utilisateurConnecte.organisation_id), jamais d'une "première organisation
  // active trouvée" : ce raccourci (Sprint 1-3) mélangeait les organisations
  // dès qu'une base en contiendrait plus d'une. On la résout explicitement à
  // chaque appel plutôt que de la garder en variable globale cachée séparée —
  // utilisateurConnecte reste la seule source de vérité de session (Sprint 0).
  async function getOrganisationIdActive() {
    if (!utilisateurConnecte) throw new Error('Aucune session active — connectez-vous pour continuer.')
    if (!utilisateurConnecte.organisation_id) throw new Error('Votre compte n\'est rattaché à aucune organisation. Contactez votre administrateur.')
    return utilisateurConnecte.organisation_id
  }

  const ProduitsDAO     = require('./dao/ProduitsDAO')
  const ClientsDAO      = require('./dao/ClientsDAO')
  const DevisDAO        = require('./dao/DevisDAO')
  const CategoriesDAO   = require('./dao/CategoriesDAO')
  const ParametresDAO   = require('./dao/ParametresDAO')
  const UtilisateursDAO = require('./dao/UtilisateursDAO')
  const DomaineDAO      = require('./dao/DomaineDAO')

  // ===== VALIDATION IPC =====
  const MODES_PAIEMENT = ['especes', 'wave', 'orange_money', 'cheque', 'pret', 'carte']

  function validateIPC(data, rules) {
    for (const [field, rule] of Object.entries(rules)) {
      const val = data?.[field]
      const absent = val === null || val === undefined || val === ''
      if (rule.required && absent) throw new Error(`Champ requis manquant: ${field}`)
      if (!absent) {
        if (rule.type && typeof val !== rule.type) throw new Error(`${field}: type invalide`)
        if (rule.type === 'number' && (!isFinite(val) || isNaN(val))) throw new Error(`${field}: nombre invalide`)
        if (rule.min !== undefined && val < rule.min) throw new Error(`${field}: valeur trop petite (min ${rule.min})`)
        if (rule.maxLen && typeof val === 'string' && val.length > rule.maxLen) throw new Error(`${field}: texte trop long`)
        if (rule.enum && !rule.enum.includes(val)) throw new Error(`${field}: valeur non autorisée`)
      }
    }
  }

  // ===== PRODUITS =====
  ipcMain.handle('produits:getAll', async () => produitsService.getAll(await getOrganisationIdActive()))
  ipcMain.handle('produits:create', async (_, p) => {
    validateIPC(p, {
      nom:         { required: true, type: 'string', maxLen: 300 },
      prix_vente:  { required: true, type: 'number', min: 0 },
      stock_actuel:{ type: 'number', min: 0 }
    })
    return produitsService.create(p, await getOrganisationIdActive())
  })
  ipcMain.handle('produits:update', async (_, p) => {
    validateIPC(p, {
      id:          { required: true, type: 'number', min: 1 },
      nom:         { required: true, type: 'string', maxLen: 300 },
      prix_vente:  { required: true, type: 'number', min: 0 }
    })
    return produitsService.update(p, await getOrganisationIdActive())
  })
  ipcMain.handle('produits:delete', async (_, id) => produitsService.delete(id, await getOrganisationIdActive()))

  // Modèle Excel à télécharger — donne aux utilisateurs le fichier attendu
  // par produits:importerExcel (mêmes en-têtes de colonnes reconnues),
  // avec une ligne d'exemple, plutôt que de deviner le bon format.
  ipcMain.handle('produits:exporterModeleExcel', async () => {
    const { dialog } = require('electron')
    const resultatDialogue = await dialog.showSaveDialog(mainWindow, {
      title: 'Enregistrer le modèle d\'import produits',
      defaultPath: 'modele_import_produits.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (resultatDialogue.canceled || !resultatDialogue.filePath) {
      return { annule: true }
    }
    try {
      const XLSX = require('xlsx')
      const entetes = ['Nom', 'Référence', 'Catégorie', 'Marque', 'Prix Achat', 'Prix Vente', 'Stock Actuel', 'Stock Minimum', 'Unité']
      const exemple = ['Riz parfumé 25kg', 'RIZ-001', 'Céréales & Graines', 'Sundia', 5000, 7500, 100, 10, 'sac']
      const feuille = XLSX.utils.aoa_to_sheet([entetes, exemple])
      feuille['!cols'] = entetes.map(() => ({ wch: 20 }))
      const classeur = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(classeur, feuille, 'Produits')
      XLSX.writeFile(classeur, resultatDialogue.filePath)
      return { succes: true }
    } catch (err) {
      return { erreur: err.message }
    }
  })

  // Import en masse depuis un fichier Excel/CSV — évite de saisir chaque
  // article manuellement. Colonnes reconnues (insensibles à la casse et aux
  // accents) : Nom, Référence, Catégorie, Marque, Prix achat, Prix vente,
  // Stock, Stock minimum, Unité. Seul "Nom" est obligatoire.
  ipcMain.handle('produits:importerExcel', async () => {
    const { dialog } = require('electron')
    const resultatDialogue = await dialog.showOpenDialog(mainWindow, {
      title: 'Importer des produits depuis un fichier Excel',
      properties: ['openFile'],
      filters: [{ name: 'Excel / CSV', extensions: ['xlsx', 'xls', 'csv'] }]
    })
    if (resultatDialogue.canceled || !resultatDialogue.filePaths.length) {
      return { annule: true }
    }

    try {
      const organisationId = await getOrganisationIdActive()
      const XLSX = require('xlsx')
      const classeur = XLSX.readFile(resultatDialogue.filePaths[0])
      const feuille = classeur.Sheets[classeur.SheetNames[0]]

      // Décompose les accents (NFD) puis retire les marques diacritiques
      // (plage Unicode U+0300–U+036F) sans dépendre d'un regex littéral —
      // plus sûr à l'encodage que d'inclure des caractères combinants tels quels.
      const normaliser = (s) => {
        const decompose = String(s ?? '').toLowerCase().normalize('NFD')
        let resultat = ''
        for (const car of decompose) {
          const code = car.codePointAt(0)
          if (code < 0x0300 || code > 0x036f) resultat += car
        }
        return resultat.trim()
      }

      // Lecture brute (tableau de tableaux) : certains fichiers ont une ligne
      // de titre avant les véritables en-têtes de colonnes. On cherche la
      // première ligne qui ressemble à un en-tête produit plutôt que de
      // supposer que c'est toujours la ligne 1.
      const grille = XLSX.utils.sheet_to_json(feuille, { header: 1, defval: '', blankrows: false })
      const MOTS_CLES_NOM = ['nom', 'produit', 'designation', 'article', 'libelle']
      let indexEntete = grille.findIndex(ligne =>
        ligne.some(cellule => MOTS_CLES_NOM.some(mot => normaliser(cellule).includes(mot)))
      )
      if (indexEntete === -1) indexEntete = 0
      const entetes = grille[indexEntete].map(normaliser)
      const lignesDonnees = grille.slice(indexEntete + 1)

      // Cherche, parmi les en-têtes réels du fichier, la première colonne
      // dont le nom CONTIENT un des mots-clés (plutôt qu'une égalité exacte,
      // trop fragile face aux libellés variés : "Nom du produit", "Désignation
      // article", espaces superflus, etc.).
      const indexColonne = (motsClefs) =>
        entetes.findIndex(entete => motsClefs.some(mot => entete.includes(mot)))

      const idxNom          = indexColonne(MOTS_CLES_NOM)
      const idxReference    = indexColonne(['reference', 'ref', 'code'])
      const idxCategorie    = indexColonne(['categorie'])
      const idxMarque       = indexColonne(['marque'])
      const idxPrixAchat    = indexColonne(['prix achat', 'prixachat', 'achat'])
      const idxPrixVente    = indexColonne(['prix vente', 'prixvente', 'vente'])
      const idxStock        = indexColonne(['stock actuel', 'quantite', 'stock'])
      const idxStockMin     = indexColonne(['stock minimum', 'seuil', 'stock min'])
      const idxUnite        = indexColonne(['unite'])

      const valeur = (ligne, idx) => (idx === -1 ? '' : (ligne[idx] ?? ''))

      const domaineCourant = await DomaineDAO.get()
      const categoriesExistantes = await CategoriesDAO.getAll()
      const categoriesConnues = new Set(categoriesExistantes.map(c => normaliser(c.nom)))

      let importes = 0
      let ignores = 0
      const erreurs = []

      for (let i = 0; i < lignesDonnees.length; i++) {
        const ligne = lignesDonnees[i]
        const nom = idxNom === -1 ? '' : String(valeur(ligne, idxNom)).trim()
        if (!nom) { ignores++; continue }

        const categorieBrute = String(valeur(ligne, idxCategorie)).trim()
        const categorie = categorieBrute || 'Sans catégorie'

        if (!categoriesConnues.has(normaliser(categorie))) {
          await CategoriesDAO.create({ nom: categorie, icone: '📦', couleur: 'blue', domaine: domaineCourant?.type })
          categoriesConnues.add(normaliser(categorie))
        }

        const produit = {
          nom,
          reference: String(valeur(ligne, idxReference)).trim() || null,
          categorie,
          marque: String(valeur(ligne, idxMarque)).trim() || null,
          prix_achat: parseFloat(valeur(ligne, idxPrixAchat)) || 0,
          prix_vente: parseFloat(valeur(ligne, idxPrixVente)) || 0,
          stock_actuel: parseFloat(valeur(ligne, idxStock)) || 0,
          stock_minimum: parseFloat(valeur(ligne, idxStockMin)) || 5,
          unite: String(valeur(ligne, idxUnite)).trim() || 'pièce'
        }

        const resultat = await ProduitsDAO.create(produit, organisationId)
        if (resultat.erreur) {
          erreurs.push(`Ligne ${indexEntete + i + 2} (${produit.nom}) : ${resultat.erreur}`)
        } else {
          importes++
        }
      }

      return { succes: true, importes, ignores, erreurs }
    } catch (err) {
      return { erreur: `Fichier illisible : ${err.message}` }
    }
  })

  // ===== VENTES =====
  ipcMain.handle('ventes:getAll', async () => ventesService.getAll(await getOrganisationIdActive()))

  ipcMain.handle('ventes:create', async (_, vente) => {
    validateIPC(vente, {
      montant_total: { required: true, type: 'number', min: 0 },
      montant_paye:  { type: 'number', min: 0 },
      montant_du:    { type: 'number', min: 0 },
      mode_paiement: { required: true, type: 'string', enum: MODES_PAIEMENT },
      panier:        { required: true, type: 'string' }
    })
    const result = await ventesService.create(vente, await getOrganisationIdActive())
    if (mainWindow?.webContents) {
      mainWindow.webContents.send('vente:created', { id: result?.id })
    }
    return result
  })

  ipcMain.handle('ventes:update', async (_, vente) => {
    const result = await ventesService.update(vente, await getOrganisationIdActive())
    if (mainWindow?.webContents) {
      mainWindow.webContents.send('vente:updated', { id: vente.id })
    }
    return result
  })

  ipcMain.handle('ventes:fullUpdate', async (_, vente) => {
    validateIPC(vente, {
      id:            { required: true, type: 'number' },
      montant_total: { required: true, type: 'number', min: 0 },
      montant_paye:  { type: 'number', min: 0 },
      montant_du:    { type: 'number', min: 0 },
      mode_paiement: { required: true, type: 'string', enum: MODES_PAIEMENT },
      panier:        { required: true, type: 'string' }
    })
    const result = await ventesService.fullUpdate(vente, await getOrganisationIdActive())
    if (mainWindow?.webContents) {
      mainWindow.webContents.send('vente:updated', { id: vente.id })
    }
    return result
  })

  ipcMain.handle('ventes:delete', async (_, id) => {
    const result = await ventesService.delete(id, await getOrganisationIdActive())
    if (mainWindow?.webContents) {
      mainWindow.webContents.send('vente:deleted', { id })
    }
    return result
  })

  // ===== FACTURES (alias sur ventes) =====
  ipcMain.handle('factures:update', async (_, f) => ventesService.update(f, await getOrganisationIdActive()))
  ipcMain.handle('factures:delete', async (_, id) => ventesService.delete(id, await getOrganisationIdActive()))

  // ===== CLIENTS =====
  ipcMain.handle('clients:getAll', async () => clientsService.getAll(await getOrganisationIdActive()))
  ipcMain.handle('clients:create', async (_, c) => {
    validateIPC(c, { nom: { required: true, type: 'string', maxLen: 200 } })
    return clientsService.create(c, await getOrganisationIdActive())
  })
  ipcMain.handle('clients:update', async (_, c) => {
    validateIPC(c, {
      id:  { required: true, type: 'number', min: 1 },
      nom: { required: true, type: 'string', maxLen: 200 }
    })
    return clientsService.update(c, await getOrganisationIdActive())
  })
  ipcMain.handle('clients:delete', async (_, id) => clientsService.delete(id, await getOrganisationIdActive()))

  // ===== TRESORERIE =====
  ipcMain.handle('tresorerie:getAll', async () => tresorerieService.getAll(await getOrganisationIdActive()))
  ipcMain.handle('tresorerie:create', async (_, op) => {
    validateIPC(op, {
      type:    { required: true, type: 'string', enum: ['entree', 'sortie', 'recette', 'depense'] },
      montant: { required: true, type: 'number', min: 0 }
    })
    return tresorerieService.create(op, await getOrganisationIdActive())
  })
  ipcMain.handle('tresorerie:update', async (_, op) => tresorerieService.update(op, await getOrganisationIdActive()))
  ipcMain.handle('tresorerie:delete', async (_, id) => tresorerieService.delete(id, await getOrganisationIdActive()))
  ipcMain.handle('tresorerie:getStats', async () => tresorerieService.getStats(await getOrganisationIdActive()))
  ipcMain.handle('tresorerie:getClotures', async () => tresorerieService.getClotures(await getOrganisationIdActive()))
  ipcMain.handle('tresorerie:cloturer', async (_, date, cloturePar, notes) => tresorerieService.cloturer(date, cloturePar, notes, await getOrganisationIdActive()))
  ipcMain.handle('tresorerie:rapportCloture', async (_, date) => tresorerieService.rapportCloture(date, await getOrganisationIdActive()))

  // ===== STATISTIQUES =====
  ipcMain.handle('stats:getAll', async () => {
    try {
      return await statistiquesService.getAll(await getOrganisationIdActive())
    } catch (err) {
      console.error('Erreur stats:', err)
      return {
        totalVentes: 0, chiffreAffaire: 0, totalClients: 0, totalProduits: 0,
        panierMoyen: 0, ventesParJour: [], ventesParMois: [], ventesParSemaine: [],
        statsParPaiement: [], statsCredits: {}, topProduits: [], topSousCategories: [], topClients: [],
        ventesAujourdhui: { nb: 0, total: 0 },
        ventesSemaine: { nb: 0, total: 0 },
        ventesMois: { nb: 0, total: 0 },
        alertesStock: []
      }
    }
  })

  // ===== PARAMETRES =====
  ipcMain.handle('parametres:get', () => ParametresDAO.get())
  ipcMain.handle('parametres:save', (_, params) => {
    verifierPermission('parametres:save', utilisateurConnecte)
    return ParametresDAO.save(params)
  })

  // Sauvegarde complète — un seul fichier .zip contenant tout ce qu'il faut
  // pour restaurer Nafix ailleurs : dump complet de la base (produits, ventes,
  // clients, trésorerie, paramètres — logo inclus puisqu'il est stocké en
  // base) + la config de connexion utilisée. Utilise pg_dump (fourni avec
  // Nafix) plutôt qu'une simple copie de fichiers, pour une sauvegarde
  // cohérente même si l'app tourne au moment de l'export.
  ipcMain.handle('parametres:exporterSauvegarde', async () => {
    verifierPermission('parametres:exporterSauvegarde', utilisateurConnecte)
    const fs = require('fs')
    const path = require('path')
    const os = require('os')
    const { execFile, spawn } = require('child_process')
    const { dialog } = require('electron')
    const { getDbConfigPath } = require('./config/paths')

    const resultatDialogue = await dialog.showSaveDialog(mainWindow, {
      title: 'Enregistrer la sauvegarde complète de Nafix',
      defaultPath: `Nafix_Sauvegarde_${new Date().toISOString().slice(0, 10)}.zip`,
      filters: [{ name: 'Archive ZIP', extensions: ['zip'] }]
    })
    if (resultatDialogue.canceled || !resultatDialogue.filePath) {
      return { annule: true }
    }

    const dossierTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'nafix_backup_'))
    try {
      const config = JSON.parse(fs.readFileSync(getDbConfigPath(), 'utf8'))

      const binDir = app.isPackaged
        ? path.join(process.resourcesPath, 'postgres', 'bin')
        : path.join(__dirname, 'resources', 'postgres', 'bin')
      const pgDump = path.join(binDir, 'pg_dump.exe')

      const dumpPath = path.join(dossierTemp, 'base_de_donnees.sql')
      await new Promise((resolve, reject) => {
        execFile(pgDump, [
          '-h', config.host, '-p', String(config.port), '-U', config.user,
          '-d', config.database, '-f', dumpPath, '--no-owner', '--no-privileges'
        ], {
          env: { ...process.env, PGPASSWORD: config.password },
          windowsHide: true, timeout: 120000
        }, (error, stdout, stderr) => error ? reject(new Error(stderr || error.message)) : resolve())
      })

      // Config de connexion — permet de restaurer plus facilement sur un autre poste
      fs.copyFileSync(getDbConfigPath(), path.join(dossierTemp, 'db.config.json'))

      fs.writeFileSync(path.join(dossierTemp, 'LISEZ-MOI.txt'),
        `Sauvegarde Nafix — générée le ${new Date().toLocaleString('fr-FR')}\r\n\r\n` +
        `Contenu de cette archive :\r\n` +
        `- base_de_donnees.sql : toutes les données (produits, ventes, clients, trésorerie,\r\n` +
        `  catégories, utilisateurs, paramètres et logo de l'entreprise)\r\n` +
        `- db.config.json : la configuration de connexion utilisée au moment de la sauvegarde\r\n\r\n` +
        `Pour restaurer : utilisez psql ou pg_restore sur "base_de_donnees.sql" vers une base\r\n` +
        `PostgreSQL vide, puis copiez db.config.json à l'emplacement attendu par Nafix.\r\n`,
        'utf8'
      )

      await new Promise((resolve, reject) => {
        const ps = spawn('powershell.exe', [
          '-NoProfile', '-NonInteractive', '-Command',
          `Compress-Archive -Path "${dossierTemp}\\*" -DestinationPath "${resultatDialogue.filePath}" -Force`
        ], { windowsHide: true })
        let stderr = ''
        ps.stderr.on('data', d => { stderr += d })
        ps.on('exit', code => code === 0 ? resolve() : reject(new Error(stderr || `Compression échouée (code ${code})`)))
        ps.on('error', reject)
      })

      return { succes: true, chemin: resultatDialogue.filePath }
    } catch (err) {
      return { erreur: err.message }
    } finally {
      fs.rmSync(dossierTemp, { recursive: true, force: true })
    }
  })

  // ===== DASHBOARD =====
  ipcMain.handle('dashboard:getAll', async () => dashboardService.getAll(await getOrganisationIdActive()))

  // ===== DEVIS =====
  ipcMain.handle('devis:getAll', async () => devisService.getAll(await getOrganisationIdActive()))
  ipcMain.handle('devis:create', async (_, d) => devisService.create(d, await getOrganisationIdActive()))
  ipcMain.handle('devis:updateStatut', async (_, { id, statut }) => devisService.updateStatut(id, statut, await getOrganisationIdActive()))
  ipcMain.handle('devis:convertir', async (_, f) => devisService.convertir(f, await getOrganisationIdActive()))

  // Modèle Excel à télécharger pour l'import de devis en masse — mêmes
  // en-têtes que celles reconnues par devis:importerExcel, avec un exemple.
  ipcMain.handle('devis:exporterModeleExcel', async () => {
    const { dialog } = require('electron')
    const resultatDialogue = await dialog.showSaveDialog(mainWindow, {
      title: 'Enregistrer le modèle d\'import devis',
      defaultPath: 'modele_import_devis.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (resultatDialogue.canceled || !resultatDialogue.filePath) {
      return { annule: true }
    }
    try {
      const XLSX = require('xlsx')
      const entetes = ['Client', 'Produit', 'Quantité', 'Prix Unitaire', 'Remise %', 'Validité Jours', 'Notes']
      const exemple1 = ['Oumar Ndiaye', 'Ciment CEM II 50kg', 10, 6500, 5, 30, 'Livraison sous 48h']
      const exemple2 = ['Oumar Ndiaye', 'Fer à béton 12mm', 20, 4000, 5, 30, '']
      const feuille = XLSX.utils.aoa_to_sheet([entetes, exemple1, exemple2])
      feuille['!cols'] = entetes.map(() => ({ wch: 20 }))
      const classeur = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(classeur, feuille, 'Devis')
      XLSX.writeFile(classeur, resultatDialogue.filePath)
      return { succes: true }
    } catch (err) {
      return { erreur: err.message }
    }
  })

  // Import en masse de devis depuis un fichier Excel/CSV — une ligne par
  // article, plusieurs lignes du même client forment un seul devis. Colonnes
  // reconnues : Client (obligatoire), Produit (obligatoire), Quantité,
  // Prix Unitaire (facultatif — sinon prix catalogue), Remise %, Validité
  // Jours, Notes. Le client est créé automatiquement s'il n'existe pas
  // encore ; le produit est recherché par correspondance approximative sur
  // le nom, jamais créé automatiquement (pour éviter les doublons silencieux
  // sur une simple faute de frappe — la ligne est alors signalée en erreur).
  ipcMain.handle('devis:importerExcel', async () => {
    const { dialog } = require('electron')
    const resultatDialogue = await dialog.showOpenDialog(mainWindow, {
      title: 'Importer des devis depuis un fichier Excel',
      properties: ['openFile'],
      filters: [{ name: 'Excel / CSV', extensions: ['xlsx', 'xls', 'csv'] }]
    })
    if (resultatDialogue.canceled || !resultatDialogue.filePaths.length) {
      return { annule: true }
    }

    try {
      const organisationId = await getOrganisationIdActive()
      const XLSX = require('xlsx')
      const classeur = XLSX.readFile(resultatDialogue.filePaths[0])
      const feuille = classeur.Sheets[classeur.SheetNames[0]]

      const normaliser = (s) => {
        const decompose = String(s ?? '').toLowerCase().normalize('NFD')
        let resultat = ''
        for (const car of decompose) {
          const code = car.codePointAt(0)
          if (code < 0x0300 || code > 0x036f) resultat += car
        }
        return resultat.trim()
      }

      const grille = XLSX.utils.sheet_to_json(feuille, { header: 1, defval: '', blankrows: false })
      const MOTS_CLES_CLIENT = ['client', 'nom client']
      let indexEntete = grille.findIndex(ligne =>
        ligne.some(cellule => MOTS_CLES_CLIENT.some(mot => normaliser(cellule).includes(mot)))
      )
      if (indexEntete === -1) indexEntete = 0
      const entetes = grille[indexEntete].map(normaliser)
      const lignesDonnees = grille.slice(indexEntete + 1)

      const indexColonne = (motsClefs) =>
        entetes.findIndex(entete => motsClefs.some(mot => entete.includes(mot)))

      const idxClient    = indexColonne(MOTS_CLES_CLIENT)
      const idxProduit    = indexColonne(['produit', 'article', 'designation', 'libelle'])
      const idxQuantite   = indexColonne(['quantite', 'qte'])
      const idxPrix       = indexColonne(['prix unitaire', 'prix', 'pu'])
      const idxRemise     = indexColonne(['remise', 'reduction'])
      const idxValidite   = indexColonne(['validite'])
      const idxNotes      = indexColonne(['notes', 'commentaire'])

      const valeur = (ligne, idx) => (idx === -1 ? '' : (ligne[idx] ?? ''))

      // Correspondance approximative simple (contient / est contenu) — pas
      // besoin d'un vrai score flou côté serveur, les imports visent des
      // noms de produits déjà connus, généralement copiés/collés du catalogue.
      const trouverProduit = (texte, produits) => {
        const cible = normaliser(texte)
        if (!cible) return null
        let meilleur = null
        for (const p of produits) {
          const nomNorm = normaliser(p.nom)
          if (nomNorm === cible) return p
          if ((nomNorm.includes(cible) || cible.includes(nomNorm)) && !meilleur) meilleur = p
        }
        return meilleur
      }

      const clientsExistants = await ClientsDAO.getAll(organisationId)
      const produitsExistants = await ProduitsDAO.getAll(organisationId)
      const clientsParNom = new Map(clientsExistants.map(c => [normaliser(c.nom), c]))

      // Regroupe les lignes par client, dans l'ordre d'apparition.
      const groupes = new Map()
      for (let i = 0; i < lignesDonnees.length; i++) {
        const ligne = lignesDonnees[i]
        const clientBrut = idxClient === -1 ? '' : String(valeur(ligne, idxClient)).trim()
        if (!clientBrut) continue
        const cle = normaliser(clientBrut)
        if (!groupes.has(cle)) groupes.set(cle, { clientNom: clientBrut, lignes: [] })
        groupes.get(cle).lignes.push({ ligne, numeroLigne: indexEntete + i + 2 })
      }

      let devisCrees = 0
      let clientsCrees = 0
      const erreurs = []

      for (const { clientNom, lignes } of groupes.values()) {
        // Résout ou crée le client.
        let client = clientsParNom.get(normaliser(clientNom))
        if (!client) {
          const resultatClient = await ClientsDAO.create({ nom: clientNom, type: 'particulier' }, organisationId)
          if (resultatClient.erreur) {
            erreurs.push(`Client "${clientNom}" : ${resultatClient.erreur}`)
            continue
          }
          client = resultatClient.succes
          clientsParNom.set(normaliser(clientNom), client)
          clientsCrees++
        }

        const panier = []
        let remisePourcent = 0
        let validite = 30
        const notesLignes = []

        for (const { ligne, numeroLigne } of lignes) {
          const produitTexte = String(valeur(ligne, idxProduit)).trim()
          if (!produitTexte) { erreurs.push(`Ligne ${numeroLigne} : produit manquant`); continue }

          const produit = trouverProduit(produitTexte, produitsExistants)
          if (!produit) {
            erreurs.push(`Ligne ${numeroLigne} (${client.nom}) : produit "${produitTexte}" introuvable au catalogue`)
            continue
          }

          const quantite = parseFloat(valeur(ligne, idxQuantite)) || 1
          const prixUnitaire = parseFloat(valeur(ligne, idxPrix)) || produit.prix_vente || 0
          panier.push({
            produit_id: produit.id,
            nom: produit.nom,
            unite: produit.unite || 'pièce',
            quantite,
            prix_unitaire: prixUnitaire,
            prix_catalogue: produit.prix_vente,
            total: quantite * prixUnitaire
          })

          const remiseLigne = parseFloat(valeur(ligne, idxRemise))
          if (!isNaN(remiseLigne) && remiseLigne > 0) remisePourcent = remiseLigne
          const validiteLigne = parseInt(valeur(ligne, idxValidite), 10)
          if (!isNaN(validiteLigne) && validiteLigne > 0) validite = validiteLigne
          const noteLigne = String(valeur(ligne, idxNotes)).trim()
          if (noteLigne) notesLignes.push(noteLigne)
        }

        if (panier.length === 0) continue // aucun article valide pour ce client — rien à créer

        const sousTotal = panier.reduce((s, it) => s + it.total, 0)
        const remiseMontant = Math.round(sousTotal * remisePourcent / 100)
        const montantTotal = sousTotal - remiseMontant
        const notes = [
          '[Importé depuis Excel]',
          remisePourcent > 0 ? `Remise : ${remisePourcent}% (-${remiseMontant.toLocaleString('fr-FR')} FCFA)` : null,
          ...notesLignes
        ].filter(Boolean).join(' — ')

        const resultat = await DevisDAO.create({
          client_id: client.id,
          validite,
          notes,
          montant_total: montantTotal,
          panier: JSON.stringify(panier),
          statut: 'en_attente'
        }, organisationId)
        if (resultat) devisCrees++
      }

      return { succes: true, devisCrees, clientsCrees, erreurs }
    } catch (err) {
      return { erreur: err.message }
    }
  })

  // ===== FOURNISSEURS =====
  ipcMain.handle('fournisseurs:getAll', async () => fournisseursService.getAll(await getOrganisationIdActive()))
  ipcMain.handle('fournisseurs:create', async (_, f) => fournisseursService.create(f, await getOrganisationIdActive()))
  ipcMain.handle('fournisseurs:update', async (_, f) => fournisseursService.update(f, await getOrganisationIdActive()))
  ipcMain.handle('fournisseurs:delete', async (_, id) => fournisseursService.delete(id, await getOrganisationIdActive()))

  // ===== ACHATS =====
  ipcMain.handle('achats:getAll', async () => achatsService.getAll(await getOrganisationIdActive()))
  ipcMain.handle('achats:create', async (_, a) => achatsService.create(a, await getOrganisationIdActive()))
  ipcMain.handle('achats:update', async (_, a) => achatsService.update(a, await getOrganisationIdActive()))
  ipcMain.handle('achats:delete', async (_, id) => achatsService.delete(id, await getOrganisationIdActive()))
  ipcMain.handle('achats:changerEtape', async (_, { id, etape }) => achatsService.changerEtape(id, etape, await getOrganisationIdActive()))

  // ===== COMMANDES CLIENTS =====
  ipcMain.handle('commandes:getAll',           async ()                    => commandesService.getAll(await getOrganisationIdActive()))
  ipcMain.handle('commandes:create',           async (_, c)                => commandesService.create(c, await getOrganisationIdActive()))
  ipcMain.handle('commandes:changerStatut',    async (_, { id, statut })   => commandesService.changerStatut(id, statut, await getOrganisationIdActive()))
  ipcMain.handle('commandes:setPriorite',      async (_, { id, priorite }) => commandesService.setPriorite(id, priorite, await getOrganisationIdActive()))
  ipcMain.handle('commandes:setDateLivraison', async (_, { id, date })     => commandesService.setDateLivraison(id, date, await getOrganisationIdActive()))
  ipcMain.handle('commandes:delete',           async (_, id)               => commandesService.delete(id, await getOrganisationIdActive()))
  ipcMain.handle('commandes:getAlertes',       async ()                    => commandesService.getAlertes(await getOrganisationIdActive()))
  ipcMain.handle('commandes:getCalendrier',    async (_, { annee, mois })  => commandesService.getCalendrier(annee, mois, await getOrganisationIdActive()))

  // ===== AUTHENTIFICATION =====
  ipcMain.handle('auth:login', async (_, { username, password }) => {
    validateIPC({ username, password }, {
      username: { required: true, type: 'string', maxLen: 100 },
      password: { required: true, type: 'string', maxLen: 200 }
    })
    const utilisateur = await UtilisateursDAO.findByUsername(username)
    if (!utilisateur) {
      return { erreur: 'Identifiant ou mot de passe incorrect !' }
    }
    const ok = await AuthService.verifyPassword(password, utilisateur.password)
    if (!ok) {
      return { erreur: 'Identifiant ou mot de passe incorrect !' }
    }
    // Sprint 5 — une organisation désactivée bloque la connexion de ses
    // utilisateurs (sinon "désactiver" une organisation n'aurait aucun effet).
    if (utilisateur.organisation_id) {
      const organisation = await organisationsService.getById(utilisateur.organisation_id)
      if (organisation && organisation.statut !== 'active') {
        return { erreur: 'Votre organisation a été désactivée. Contactez votre administrateur.' }
      }
    }
    const { password: _pw, ...userSansPassword } = utilisateur
    utilisateurConnecte = userSansPassword
    return { utilisateur: userSansPassword }
  })

  ipcMain.handle('auth:logout', () => {
    utilisateurConnecte = null
    return { ok: true }
  })

  // Journal local des factures imprimées sur CE poste — un fichier CSV dans
  // le dossier de données utilisateur, ouvrable directement dans Excel.
  // Sert de trace locale (qui/quoi/quand a été imprimé), indépendante de la
  // base de données partagée.
  function journaliserImpression({ numero, client, montant, utilisateur }) {
    try {
      const cheminJournal = path.join(app.getPath('userData'), 'journal_impressions.csv')
      const estNouveau = !fs.existsSync(cheminJournal)
      const echapper = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
      const maintenant = new Date()
      const ligne = [
        maintenant.toLocaleDateString('fr-FR'),
        maintenant.toLocaleTimeString('fr-FR'),
        numero, client, montant, utilisateur
      ].map(echapper).join(';') + '\r\n'

      if (estNouveau) {
        fs.writeFileSync(cheminJournal, 'Date;Heure;Numéro facture;Client;Montant;Imprimé par\r\n', 'utf8')
      }
      fs.appendFileSync(cheminJournal, ligne, 'utf8')
    } catch (err) {
      console.error('Journal impressions — échec écriture :', err.message)
    }
  }

  // ===== IMPRESSION DIRECTE (facture/devis → imprimante physique) =====
  // Évite le détour PDF-puis-impression-manuelle : le HTML déjà rendu de la
  // facture (avec ses styles inline) est chargé dans une fenêtre invisible,
  // puis envoyé directement à l'imprimante via la boîte de dialogue native.
  ipcMain.handle('impression:imprimerHTML', (_, { html, numero, client, montant, utilisateur }) => {
    return new Promise((resolve) => {
      const fenetreImpression = new BrowserWindow({ show: false })
      const documentComplet = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0">${html}</body></html>`
      fenetreImpression.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(documentComplet))
      fenetreImpression.webContents.once('did-finish-load', () => {
        fenetreImpression.webContents.print({ silent: false, printBackground: true }, (succes, raisonEchec) => {
          if (!fenetreImpression.isDestroyed()) fenetreImpression.close()
          // Seules les factures (numero fourni) sont journalisées — pas les devis.
          if (succes && numero) journaliserImpression({ numero, client, montant, utilisateur })
          resolve({ succes, erreur: succes ? null : raisonEchec })
        })
      })
    })
  })

  // ===== RECONNAISSANCE VOCALE (Vosk, hors-ligne) =====
  // Le module natif ne peut tourner que côté processus principal — le
  // renderer capture le micro (getUserMedia) et envoie des blocs audio PCM
  // via l'événement 'voice:audio' ; les résultats (partiels/finaux) sont
  // renvoyés via l'événement 'voice:resultat'.
  ipcMain.handle('voice:demarrer', () => {
    try {
      const voskEngine = require('./server/voskEngine')
      return voskEngine.demarrerSession()
    } catch (err) {
      return { erreur: err.message }
    }
  })

  ipcMain.on('voice:audio', (event, bufferPCM) => {
    try {
      const voskEngine = require('./server/voskEngine')
      const resultat = voskEngine.traiterAudio(bufferPCM)
      if (resultat && mainWindow?.webContents) {
        mainWindow.webContents.send('voice:resultat', resultat)
      }
    } catch (err) {
      if (mainWindow?.webContents) {
        mainWindow.webContents.send('voice:resultat', { erreur: err.message })
      }
    }
  })

  ipcMain.handle('voice:arreter', () => {
    try {
      const voskEngine = require('./server/voskEngine')
      return voskEngine.arreterSession()
    } catch (err) {
      return { erreur: err.message }
    }
  })

  // ===== MONITORING =====
  // Le renderer (ex. ErrorBoundary) signale une erreur au processus principal,
  // qui l'ajoute au même journal local que les exceptions côté main.
  ipcMain.on('systeme:journaliserErreur', (_, { source, message, stack }) => {
    journaliserErreur({ source: source || 'renderer', message, stack, utilisateur: utilisateurConnecte?.username })
  })

  // ===== UTILISATEURS =====
  ipcMain.handle('utilisateurs:getAll', async () => {
    verifierPermission('utilisateurs:getAll', utilisateurConnecte)
    return UtilisateursDAO.getAll(await getOrganisationIdActive())
  })
  ipcMain.handle('utilisateurs:create', async (_, u) => {
    try {
      verifierPermission('utilisateurs:create', utilisateurConnecte)
      validateIPC(u, {
        username: { required: true, type: 'string', maxLen: 100 },
        password: { required: true, type: 'string', maxLen: 200 },
        role:     { required: true, type: 'string', enum: ['administrateur', 'gerant', 'comptable', 'caissier'] }
      })
    } catch (err) {
      return { erreur: err.message }
    }
    return UtilisateursDAO.create(u, await getOrganisationIdActive())
  })
  ipcMain.handle('utilisateurs:delete', async (_, id) => {
    verifierPermission('utilisateurs:delete', utilisateurConnecte)
    return UtilisateursDAO.delete(id, await getOrganisationIdActive())
  })
  ipcMain.handle('utilisateurs:updatePassword', async (_, { id, password }) => {
    verifierPermission('utilisateurs:updatePassword', utilisateurConnecte)
    validateIPC({ id, password }, {
      id:       { required: true, type: 'number', min: 1 },
      password: { required: true, type: 'string', maxLen: 200 }
    })
    return UtilisateursDAO.updatePassword(id, password, await getOrganisationIdActive())
  })
  ipcMain.handle('utilisateurs:updateRole', async (_, { id, role }) => {
    verifierPermission('utilisateurs:updateRole', utilisateurConnecte)
    return UtilisateursDAO.updateRole(id, role, await getOrganisationIdActive())
  })
  ipcMain.handle('utilisateurs:updatePermissions', async (_, { id, permissions }) => {
    verifierPermission('utilisateurs:updatePermissions', utilisateurConnecte)
    return UtilisateursDAO.updatePermissions(id, permissions, await getOrganisationIdActive())
  })

  // ===== ORGANISATION =====
  // Sprint 5 — id toujours dérivé de la session (getOrganisationIdActive),
  // jamais accepté depuis le renderer : un utilisateur ne doit jamais pouvoir
  // lire/modifier une autre organisation en passant un id arbitraire.
  ipcMain.handle('organisations:getMine', async () => organisationsService.getById(await getOrganisationIdActive()))
  ipcMain.handle('organisations:update', async (_, { nom }) => {
    verifierPermission('organisations:update', utilisateurConnecte)
    validateIPC({ nom }, { nom: { required: true, type: 'string', maxLen: 200 } })
    return organisationsService.update(await getOrganisationIdActive(), { nom })
  })
  ipcMain.handle('organisations:setStatut', async (_, { statut }) => {
    verifierPermission('organisations:setStatut', utilisateurConnecte)
    return organisationsService.setStatut(await getOrganisationIdActive(), statut)
  })

  // ===== DOMAINE =====
  ipcMain.handle('domaine:get', () => DomaineDAO.get())
  ipcMain.handle('domaine:save', (_, d) => {
    verifierPermission('domaine:save', utilisateurConnecte)
    return DomaineDAO.save(d)
  })

  // ===== AVOIRS / COMPTES PRÉPAYÉS =====
  ipcMain.handle('avoirs:getAll',           async ()       => avoirsService.getAll(await getOrganisationIdActive()))
  ipcMain.handle('avoirs:getByClient',      async (_, id)  => avoirsService.getByClient(id, await getOrganisationIdActive()))
  ipcMain.handle('avoirs:getTransactions',  async (_, id)  => avoirsService.getTransactions(id, await getOrganisationIdActive()))
  ipcMain.handle('avoirs:getAllTransactions', async ()     => avoirsService.getAllTransactions(await getOrganisationIdActive()))
  ipcMain.handle('avoirs:creerCompte',      async (_, d)   => avoirsService.creerCompte(d, await getOrganisationIdActive()))
  ipcMain.handle('avoirs:recharger',        async (_, d)   => avoirsService.recharger(d, await getOrganisationIdActive()))
  ipcMain.handle('avoirs:enregistrerAchat', async (_, d)   => avoirsService.enregistrerAchat(d, await getOrganisationIdActive()))
  ipcMain.handle('avoirs:cloturerCompte',   async (_, id)  => avoirsService.cloturerCompte(id, await getOrganisationIdActive()))
  ipcMain.handle('avoirs:delete',           async (_, id)  => avoirsService.delete(id, await getOrganisationIdActive()))

  // ===== RETOURS =====
  ipcMain.handle('retours:getAll', async () => retoursService.getAll(await getOrganisationIdActive()))
  ipcMain.handle('retours:getPendants', async () => retoursService.getPendants(await getOrganisationIdActive()))
  ipcMain.handle('retours:create', async (_, r) => retoursService.create(r, await getOrganisationIdActive()))
  ipcMain.handle('retours:approuver', async (_, id, approuvePar) => retoursService.approuver(id, approuvePar, await getOrganisationIdActive()))
  ipcMain.handle('retours:rejeter', async (_, id, approuvePar) => retoursService.rejeter(id, approuvePar, await getOrganisationIdActive()))

  // ===== BASE DE DONNÉES =====
  ipcMain.handle('db:getStats', async () => {
    verifierPermission('db:getStats', utilisateurConnecte)
    const pool = require('./db/pool')
    const config = require(getDbConfigPath())
    const tables = [
      'produits', 'clients', 'ventes', 'devis', 'tresorerie',
      'fournisseurs', 'achats', 'categories', 'sous_categories',
      'utilisateurs', 'parametres', 'domaine'
    ]
    const tableStats = []
    for (const table of tables) {
      try {
        const res = await pool.query(`SELECT COUNT(*) AS count FROM ${table}`)
        tableStats.push({ table, count: parseInt(res.rows[0].count, 10) })
      } catch (e) {
        tableStats.push({ table, count: 0, erreur: e.message })
      }
    }
    let dbSize = null
    try {
      const res = await pool.query(`SELECT pg_size_pretty(pg_database_size($1)) AS size`, [config.database])
      dbSize = res.rows[0].size
    } catch (_) {}
    return {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      dbSize,
      tables: tableStats,
      connected: true
    }
  })

  ipcMain.handle('db:reinitialiser', async (_, options) => {
    verifierPermission('db:reinitialiser', utilisateurConnecte)
    return ParametresDAO.reinitialiser(options || {})
  })

  // ===== CATEGORIES =====
  ipcMain.handle('categories:getAll', () => CategoriesDAO.getAll())
  ipcMain.handle('categories:create', (_, cat) => CategoriesDAO.create(cat))
  ipcMain.handle('categories:update', (_, cat) => CategoriesDAO.update(cat))
  ipcMain.handle('categories:delete', (_, id) => CategoriesDAO.delete(id))

  // ===== SOUS-CATEGORIES =====
  ipcMain.handle('sous_categories:create', (_, scat) => CategoriesDAO.createSousCategorie(scat))
  ipcMain.handle('sous_categories:delete', (_, id) => CategoriesDAO.deleteSousCategorie(id))
}
