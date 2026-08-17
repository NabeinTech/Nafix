const { contextBridge, ipcRenderer } = require('electron')

const INVOKE_CHANNELS = [
  'produits:getAll', 'produits:create', 'produits:update', 'produits:delete', 'produits:importerExcel',
  'produits:exporterModeleExcel',
  'impression:imprimerHTML',
  'ventes:getAll', 'ventes:create', 'ventes:update', 'ventes:fullUpdate', 'ventes:delete',
  'factures:update', 'factures:delete',
  'clients:getAll', 'clients:create', 'clients:update', 'clients:delete',
  'tresorerie:getAll', 'tresorerie:create', 'tresorerie:update', 'tresorerie:delete',
  'tresorerie:getStats', 'tresorerie:getClotures', 'tresorerie:cloturer', 'tresorerie:rapportCloture',
  'stats:getAll',
  'parametres:get', 'parametres:save', 'parametres:exporterSauvegarde',
  'dashboard:getAll',
  'devis:getAll', 'devis:create', 'devis:updateStatut', 'devis:convertir',
  'devis:exporterModeleExcel', 'devis:importerExcel',
  'fournisseurs:getAll', 'fournisseurs:create', 'fournisseurs:update', 'fournisseurs:delete',
  'achats:getAll', 'achats:create', 'achats:update', 'achats:delete', 'achats:changerEtape',
  'commandes:getAll', 'commandes:create', 'commandes:changerStatut', 'commandes:setPriorite',
  'commandes:setDateLivraison', 'commandes:delete', 'commandes:getAlertes', 'commandes:getCalendrier',
  'auth:login', 'auth:logout',
  'utilisateurs:getAll', 'utilisateurs:create', 'utilisateurs:delete',
  'utilisateurs:updatePassword', 'utilisateurs:updateRole', 'utilisateurs:updatePermissions',
  'organisations:getMine', 'organisations:update', 'organisations:setStatut',
  'domaine:get', 'domaine:save',
  'retours:getAll', 'retours:getPendants', 'retours:create', 'retours:approuver', 'retours:rejeter',
  'db:getStats', 'db:reinitialiser',
  'categories:getAll', 'categories:create', 'categories:update', 'categories:delete',
  'sous_categories:create', 'sous_categories:delete',
  'avoirs:getAll', 'avoirs:getByClient', 'avoirs:getTransactions', 'avoirs:getAllTransactions',
  'avoirs:creerCompte', 'avoirs:recharger', 'avoirs:enregistrerAchat',
  'avoirs:cloturerCompte', 'avoirs:delete',
  'setup:status', 'setup:testConnection', 'setup:configurerConnexion', 'setup:configurerLocal',
  'setup:reessayerParefeu', 'setup:terminerConfiguration',
  'voice:demarrer', 'voice:arreter'
]

const EVENT_CHANNELS = ['vente:created', 'vente:updated', 'vente:deleted', 'voice:audio', 'voice:resultat', 'systeme:journaliserErreur']

contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel, ...args) => {
    if (!INVOKE_CHANNELS.includes(channel)) {
      return Promise.reject(new Error(`Canal IPC non autorisé: ${channel}`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel, handler) => {
    if (!EVENT_CHANNELS.includes(channel)) return
    ipcRenderer.on(channel, handler)
  },
  removeListener: (channel, handler) => {
    if (!EVENT_CHANNELS.includes(channel)) return
    ipcRenderer.removeListener(channel, handler)
  },
  send: (channel, data) => {
    if (!EVENT_CHANNELS.includes(channel)) return
    ipcRenderer.send(channel, data)
  }
})
