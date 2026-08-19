# routes/

Une route HTTP par domaine métier, chacune un mince adaptateur au-dessus des
services existants — même principe que les handlers `ipcMain.handle` de
`main.js`, mais recevant le tenant context depuis le middleware
d'authentification (`../middleware/`) plutôt que depuis `getOrganisationIdActive()`.

Vide pour l'instant. Premier fichier prévu au Sprint 15 : `clients.js`
(module pilote — DAO le plus simple du dépôt, zéro transaction, zéro effet
de bord sur une autre table, cf. audit Sprint 13 §K).

Aucune route n'existe encore — ce dossier ne doit pas être importé par quoi
que ce soit avant le Sprint 15.
