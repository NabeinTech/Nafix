// Efface ELECTRON_RUN_AS_NODE que VS Code met dans son terminal intégré.
// Sans ça, Electron démarre en mode Node.js et n'initialise pas ses APIs (app, BrowserWindow...).
delete process.env.ELECTRON_RUN_AS_NODE

const { spawn } = require('child_process')
const electronPath = require('electron')

const child = spawn(electronPath, ['.'], {
  env: process.env,
  stdio: 'inherit'
})

child.on('exit', (code) => process.exit(code || 0))
