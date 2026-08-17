// Reconnaissance vocale hors-ligne (Vosk) — tourne uniquement dans le
// processus principal Electron car 'vosk' est un module natif (voir
// server/voskEngine.js appelé depuis main.js, jamais depuis le renderer qui
// n'a pas accès à Node avec contextIsolation activé). Le modèle français est
// chargé une seule fois, paresseusement, au premier démarrage d'écoute.

const path = require('path')
const fs = require('fs')

let vosk = null
let modele = null
let recognizer = null

function getModelPath() {
  const { app } = require('electron')
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'vosk', 'model-fr')
    : path.join(__dirname, '..', 'resources', 'vosk', 'model-fr')
  return base
}

function chargerModele() {
  if (modele) return modele
  // Utilise notre liaison Koffi (voskFfi.js) plutôt que le binding officiel
  // du paquet 'vosk' (ffi-napi/ref-napi) — incompatible avec le bac à sable
  // mémoire de V8 sur ce Node/Electron. La DLL native reste celle fournie
  // par le paquet 'vosk', seule la couche FFI change.
  if (!vosk) vosk = require('./voskFfi')
  const modelPath = getModelPath()
  if (!fs.existsSync(modelPath)) {
    throw new Error(`Modèle vocal introuvable à ${modelPath}`)
  }
  vosk.setLogLevel(-1) // silencieux — évite de polluer la console avec les logs Kaldi
  modele = new vosk.Model(modelPath)
  return modele
}

// Démarre une session de reconnaissance — une seule à la fois (usage mono-poste,
// mono-fenêtre : pas besoin de gérer plusieurs sessions concurrentes).
function demarrerSession() {
  chargerModele()
  if (recognizer) {
    try { recognizer.free() } catch { /* déjà libéré */ }
  }
  recognizer = new vosk.Recognizer({ model: modele, sampleRate: 16000 })
  return { succes: true }
}

// Traite un bloc audio PCM 16 bits mono 16kHz — retourne un résultat partiel
// (texte provisoire pendant que l'utilisateur parle encore) ou final (fin de
// silence détectée par Vosk lui-même).
function traiterAudio(bufferPCM) {
  if (!recognizer) return null
  const buffer = Buffer.isBuffer(bufferPCM) ? bufferPCM : Buffer.from(bufferPCM)
  const finDePhrase = recognizer.acceptWaveform(buffer)
  if (finDePhrase) {
    const { text } = recognizer.result()
    return { final: true, texte: text }
  }
  const { partial } = recognizer.partialResult()
  return { final: false, texte: partial }
}

// Arrête la session en cours et renvoie la transcription finale.
function arreterSession() {
  if (!recognizer) return { texte: '' }
  const { text } = recognizer.finalResult()
  try { recognizer.free() } catch { /* déjà libéré */ }
  recognizer = null
  return { texte: text }
}

module.exports = { demarrerSession, traiterAudio, arreterSession }
