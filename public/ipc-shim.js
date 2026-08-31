// Chantier web-shim — permet à l'app React existante (src/) de tourner dans
// un navigateur en appelant l'API HTTP au lieu de l'IPC Electron, sans
// modifier un seul fichier de src/.
//
// Tous les fichiers de src/ lisent window.ipcRenderer (jamais de Context React
// ni d'autre global). En Electron, preload.js définit window.ipcRenderer via
// contextBridge AVANT que les scripts de la page ne s'exécutent — donc ce
// fichier peut être inclus sans condition dans TOUS les builds (Electron dev,
// Electron packagé, web) : la garde ci-dessous ne s'active qu'en navigateur,
// là où aucun vrai bridge n'existe.
(function () {
  if (window.ipcRenderer) return

  // Exception ciblée à la règle "aucune modification de src/" ci-dessus :
  // ce script n'a pas accès au bundle webpack (donc pas à la lib xlsx), il
  // ne peut donc pas implémenter lui-même l'import/export Excel des
  // produits (lecture de fichier + parsing). Ce drapeau permet à
  // src/pages/Produits.js de détecter le mode web et de faire ce travail
  // lui-même (input file + XLSX déjà importé côté React), au lieu de
  // passer par les canaux natifs Electron (dialog.showOpenDialog).
  window.NAFIX_ENV_WEB = true

  // Préfixe explicite par window.location.origin plutôt qu'un chemin relatif
  // nu : le fetch() de Node ne résout pas les URL relatives (pas de document
  // de référence), ce qui rendrait ce fichier impossible à tester en Node.
  // En navigateur c'est strictement équivalent (same-origin, l'API sert aussi
  // ce fichier).
  const BASE = window.location.origin
  const TOKENS_KEY = 'nafix_web_tokens' // séparé de 'nafix_session' (src/App.js), pour ne jamais l'écraser

  function getTokens() {
    try { return JSON.parse(sessionStorage.getItem(TOKENS_KEY) || 'null') } catch (e) { return null }
  }
  function setTokens(t) { sessionStorage.setItem(TOKENS_KEY, JSON.stringify(t)) }
  function clearSession() {
    sessionStorage.removeItem(TOKENS_KEY)
    sessionStorage.removeItem('nafix_session') // clé possédée par App.js, vidée aussi pour retomber sur Login
  }

  async function requeteBrute(method, path, body) {
    const tokens = getTokens()
    const headers = { 'Content-Type': 'application/json' }
    if (tokens && tokens.accessToken) headers.Authorization = 'Bearer ' + tokens.accessToken
    return fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined })
  }

  // Un seul refresh en vol, partagé par tous les 401 concurrents.
  // tokenService.rafraichir() (server/api/auth/tokenService.js) traite un
  // refresh token déjà tourné comme un vol et révoque TOUTES les sessions —
  // deux 401 concurrents déclenchant chacun leur propre refresh casseraient
  // la session pour rien.
  let refreshEnCours = null
  function tenterRafraichir() {
    if (!refreshEnCours) {
      refreshEnCours = (async () => {
        const tokens = getTokens()
        if (!tokens || !tokens.refreshToken) return false
        const res = await requeteBrute('POST', '/auth/refresh', { refreshToken: tokens.refreshToken })
        if (!res.ok) return false
        const data = await res.json()
        setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
        return true
      })().finally(() => { refreshEnCours = null })
    }
    return refreshEnCours
  }

  // Ne rejette jamais pour un 4xx/402/403 métier — résout {erreur}, cohérent
  // avec la convention {succes}/{erreur} déjà dominante côté pages (main.js
  // ne rejette que pour des erreurs de programmation, pas des échecs métier
  // attendus). Seul un échec réseau réel (fetch qui lève) rejette.
  async function api(method, path, body) {
    let res = await requeteBrute(method, path, body)
    if (res.status === 401 && path !== '/auth/login' && path !== '/auth/refresh') {
      const ok = await tenterRafraichir()
      if (!ok) {
        clearSession()
        window.location.reload()
        return new Promise(() => {}) // la page va se recharger, ne jamais résoudre entre-temps
      }
      res = await requeteBrute(method, path, body)
    }
    let data = null
    try { data = await res.json() } catch (e) { /* corps vide, ex. 204/304 */ }
    if (!res.ok) return { erreur: (data && data.erreur) || ('Erreur ' + res.status) }
    return data
  }

  const nonDisponibleWeb = (nom) => () => Promise.reject(new Error(nom + ' : non disponible en version web'))

  const CHANNELS = {
    // ── setup — pas de wizard en web, on saute directement à Login ──
    'setup:status': () => Promise.resolve({ configured: true }),

    // ── auth / organisations (création de compte) ──
    'auth:login': async ({ username, password }) => {
      const res = await requeteBrute('POST', '/auth/login', { username, password })
      const data = await res.json().catch(() => null)
      if (!res.ok) return { erreur: (data && data.erreur) || 'Erreur de connexion' }
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
      return { utilisateur: data.utilisateur }
    },
    'auth:logout': async () => {
      const tokens = getTokens()
      if (tokens && tokens.refreshToken) {
        await requeteBrute('POST', '/auth/logout', { refreshToken: tokens.refreshToken }).catch(() => {})
      }
      clearSession()
      return { ok: true }
    },
    'organisations:creerAvecAdmin': async (donnees) => {
      const res = await requeteBrute('POST', '/auth/signup', donnees)
      const data = await res.json().catch(() => null)
      if (!res.ok) return { erreur: (data && data.erreur) || 'Erreur' }
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
      return { utilisateur: data.utilisateur }
    },
    'organisations:getMine': () => api('GET', '/organisations/mine'),
    'organisations:update': (o) => api('PUT', '/organisations', o),

    // ── produits ──
    'produits:getAll': () => api('GET', '/produits'),
    'produits:create': (p) => api('POST', '/produits', p),
    'produits:update': (p) => api('PUT', '/produits/' + p.id, p),
    'produits:delete': (id) => api('DELETE', '/produits/' + id),
    'produits:importerExcel': nonDisponibleWeb('Import Excel'),
    'produits:exporterModeleExcel': nonDisponibleWeb('Export modèle Excel'),

    // ── clients ──
    'clients:getAll': () => api('GET', '/clients'),
    'clients:create': (c) => api('POST', '/clients', c),
    'clients:update': (c) => api('PUT', '/clients/' + c.id, c),
    'clients:delete': (id) => api('DELETE', '/clients/' + id),

    // ── fournisseurs ──
    'fournisseurs:getAll': () => api('GET', '/fournisseurs'),
    'fournisseurs:create': (f) => api('POST', '/fournisseurs', f),
    'fournisseurs:update': (f) => api('PUT', '/fournisseurs/' + f.id, f),
    'fournisseurs:delete': (id) => api('DELETE', '/fournisseurs/' + id),

    // ── ventes / factures (factures:* réutilise les mêmes routes /ventes,
    // aucune route /factures n'existe côté API — même alias que main.js) ──
    'ventes:getAll': () => api('GET', '/ventes'),
    'ventes:create': (v) => api('POST', '/ventes', v),
    'ventes:update': (v) => api('PUT', '/ventes/' + v.id, v),
    'ventes:fullUpdate': (v) => api('PUT', '/ventes/' + v.id + '/complet', v),
    'ventes:delete': (id) => api('DELETE', '/ventes/' + id),
    'factures:update': (f) => api('PUT', '/ventes/' + f.id, f),
    'factures:delete': (id) => api('DELETE', '/ventes/' + id),

    // ── devis ──
    'devis:getAll': () => api('GET', '/devis'),
    'devis:create': (d) => api('POST', '/devis', d),
    'devis:updateStatut': (d) => api('PUT', '/devis/' + d.id + '/statut', { statut: d.statut }),
    'devis:convertir': (f) => api('POST', '/devis/convertir', f), // devis_id déjà dans le corps, pas dans l'URL
    'devis:importerExcel': nonDisponibleWeb('Import Excel'),
    'devis:exporterModeleExcel': nonDisponibleWeb('Export modèle Excel'),

    // ── achats ──
    'achats:getAll': () => api('GET', '/achats'),
    'achats:create': (a) => api('POST', '/achats', a),
    'achats:update': (a) => api('PUT', '/achats/' + a.id, a),
    'achats:delete': (id) => api('DELETE', '/achats/' + id),
    'achats:changerEtape': (a) => api('PUT', '/achats/' + a.id + '/etape', { etape: a.etape }),

    // ── commandes ──
    'commandes:getAll': () => api('GET', '/commandes'),
    'commandes:getAlertes': () => api('GET', '/commandes/alertes'),
    'commandes:getCalendrier': ({ annee, mois }) => api('GET', '/commandes/calendrier/' + annee + '/' + mois),
    'commandes:create': (c) => api('POST', '/commandes', c),
    'commandes:changerStatut': (c) => api('PUT', '/commandes/' + c.id + '/statut', { statut: c.statut }),
    'commandes:setPriorite': (c) => api('PUT', '/commandes/' + c.id + '/priorite', { priorite: c.priorite }),
    'commandes:setDateLivraison': (c) => api('PUT', '/commandes/' + c.id + '/livraison', { date: c.date }),
    'commandes:delete': (id) => api('DELETE', '/commandes/' + id),

    // ── retours — arguments positionnels, pas un objet ──
    'retours:getAll': () => api('GET', '/retours'),
    'retours:getPendants': () => api('GET', '/retours/pendants'),
    'retours:create': (r) => api('POST', '/retours', r),
    'retours:approuver': (id, approuvePar) => api('PUT', '/retours/' + id + '/approuver', { approuvePar }),
    'retours:rejeter': (id, approuvePar) => api('PUT', '/retours/' + id + '/rejeter', { approuvePar }),

    // ── avoirs ──
    'avoirs:getAll': () => api('GET', '/avoirs'),
    'avoirs:getAllTransactions': () => api('GET', '/avoirs/transactions'),
    'avoirs:getByClient': (clientId) => api('GET', '/avoirs/client/' + clientId),
    'avoirs:getTransactions': (id) => api('GET', '/avoirs/' + id + '/transactions'),
    'avoirs:creerCompte': (d) => api('POST', '/avoirs', d),
    'avoirs:recharger': (d) => api('POST', '/avoirs/' + d.id + '/recharger', { montant: d.montant }),
    'avoirs:enregistrerAchat': (d) => api('POST', '/avoirs/' + d.id + '/achat', { montant: d.montant }),
    'avoirs:cloturerCompte': (id) => api('PUT', '/avoirs/' + id + '/cloturer'),
    'avoirs:delete': (id) => api('DELETE', '/avoirs/' + id),

    // ── tresorerie — cloturer a 3 arguments positionnels ──
    'tresorerie:getAll': () => api('GET', '/tresorerie'),
    'tresorerie:getStats': () => api('GET', '/tresorerie/stats'),
    'tresorerie:getClotures': () => api('GET', '/tresorerie/clotures'),
    'tresorerie:rapportCloture': (date) => api('GET', '/tresorerie/rapport-cloture/' + date),
    'tresorerie:create': (op) => api('POST', '/tresorerie', op),
    'tresorerie:update': (op) => api('PUT', '/tresorerie/' + op.id, op),
    'tresorerie:delete': (id) => api('DELETE', '/tresorerie/' + id),
    'tresorerie:cloturer': (date, cloturePar, notes) => api('POST', '/tresorerie/cloturer', { date, cloturePar, notes }),

    // ── categories / sous-categories ──
    'categories:getAll': () => api('GET', '/categories'),
    'categories:create': (c) => api('POST', '/categories', c),
    'categories:update': (c) => api('PUT', '/categories/' + c.id, c),
    'categories:delete': (id) => api('DELETE', '/categories/' + id),
    'sous_categories:create': (sc) => api('POST', '/categories/sous-categories', sc),
    'sous_categories:delete': (id) => api('DELETE', '/categories/sous-categories/' + id),

    // ── domaine / parametres ──
    'domaine:get': () => api('GET', '/domaine'),
    'domaine:save': (d) => api('POST', '/domaine', d),
    'parametres:get': () => api('GET', '/parametres'),
    'parametres:save': (p) => api('POST', '/parametres', p),
    'parametres:exporterSauvegarde': nonDisponibleWeb('Sauvegarde'),
    'parametres:importerSauvegarde': nonDisponibleWeb('Restauration'),

    // ── dashboard / stats / abonnement ──
    'dashboard:getAll': () => api('GET', '/dashboard'),
    'stats:getAll': () => api('GET', '/statistiques'),
    'abonnement:getStatut': () => api('GET', '/abonnement'),
    // Contrat different du desktop par necessite : le web doit naviguer
    // lui-meme vers la page de paiement (main.js ouvre deja le navigateur
    // systeme cote Electron, la page appelante n'a rien a faire de plus).
    'abonnement:payer': (donnees) => api('POST', '/abonnement/payer', donnees),

    // ── utilisateurs (routes neuves, cf. server/api/routes/utilisateurs.js) ──
    'utilisateurs:getAll': () => api('GET', '/utilisateurs'),
    'utilisateurs:create': (u) => api('POST', '/utilisateurs', u),
    'utilisateurs:delete': (id) => api('DELETE', '/utilisateurs/' + id),
    'utilisateurs:updatePassword': (u) => api('PUT', '/utilisateurs/' + u.id + '/password', { password: u.password }),
    'utilisateurs:updateRole': (u) => api('PUT', '/utilisateurs/' + u.id + '/role', { role: u.role }),
    'utilisateurs:updatePermissions': (u) => api('PUT', '/utilisateurs/' + u.id + '/permissions', { permissions: u.permissions }),

    // ── impression — vrai comportement navigateur, pas un stub ──
    'impression:imprimerHTML': async ({ html }) => {
      const fenetre = window.open('', '_blank')
      if (!fenetre) return { succes: false, erreur: 'Fenêtre bloquée (autorisez les pop-ups pour ce site).' }
      fenetre.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0">' + html + '</body></html>')
      fenetre.document.close()
      fenetre.onload = () => fenetre.print()
      setTimeout(() => { try { fenetre.print() } catch (e) {} }, 300) // filet si onload ne tire pas assez tôt
      return { succes: true, erreur: null }
    },

    // ── db — jamais exposer la vraie config Postgres à un client navigateur ──
    'db:getStats': () => Promise.resolve({ host: '—', port: '—', database: '—', user: '—', dbSize: '—', tables: [], connected: true }),
    'db:reinitialiser': (options) => api('POST', '/parametres/reinitialiser', options),

    // ── hors périmètre de ce chantier ──
    'voice:demarrer': nonDisponibleWeb('Reconnaissance vocale'),
    'voice:arreter': nonDisponibleWeb('Reconnaissance vocale')
  }

  window.ipcRenderer = {
    invoke: (channel, ...args) => {
      const fn = CHANNELS[channel]
      if (!fn) return Promise.reject(new Error('Canal non disponible en version web: ' + channel))
      return Promise.resolve().then(() => fn.apply(null, args))
    },
    // Pushes serveur->client (vente:created/updated/deleted, voice:audio/resultat,
    // systeme:journaliserErreur) : no-op sûr. Limitation MVP connue — les pages
    // qui en dépendent pour un rafraîchissement en direct montreront des
    // données légèrement périmées jusqu'au prochain rechargement manuel.
    on: () => {},
    removeListener: () => {},
    send: () => {}
  }
})()
