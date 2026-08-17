// Capture micro (renderer) → PCM 16 bits mono 16kHz → envoyé au processus
// principal pour reconnaissance Vosk. Utilise ScriptProcessorNode (déprécié
// mais pleinement fonctionnel dans Chromium/Electron) plutôt qu'un
// AudioWorklet, pour éviter d'avoir à empaqueter un module JS séparé chargé
// par URL — plus simple à maintenir pour un outil interne.

const TAILLE_BLOC = 4096

function reechantillonner16Bits(donnees, tauxEntree, tauxSortie) {
  if (tauxSortie === tauxEntree) {
    return convertirEnInt16(donnees)
  }
  const ratio = tauxEntree / tauxSortie
  const longueurSortie = Math.floor(donnees.length / ratio)
  const resultat = new Int16Array(longueurSortie)
  for (let i = 0; i < longueurSortie; i++) {
    const indexEntree = i * ratio
    const indexBas = Math.floor(indexEntree)
    const indexHaut = Math.min(indexBas + 1, donnees.length - 1)
    const poids = indexEntree - indexBas
    const echantillon = donnees[indexBas] * (1 - poids) + donnees[indexHaut] * poids
    resultat[i] = Math.max(-32768, Math.min(32767, Math.round(echantillon * 32767)))
  }
  return resultat
}

function convertirEnInt16(donnees) {
  const resultat = new Int16Array(donnees.length)
  for (let i = 0; i < donnees.length; i++) {
    resultat[i] = Math.max(-32768, Math.min(32767, Math.round(donnees[i] * 32767)))
  }
  return resultat
}

// Démarre la capture micro. `onChunk` reçoit un Int16Array PCM 16kHz mono à
// chaque bloc traité. Retourne une fonction `arreter()` à appeler pour
// couper le micro et libérer les ressources audio.
export async function demarrerCaptureAudio(onChunk, onErreur) {
  let flux, contexteAudio, source, processeur

  try {
    flux = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
    })
  } catch (err) {
    onErreur?.(err)
    return () => {}
  }

  contexteAudio = new (window.AudioContext || window.webkitAudioContext)()
  const tauxEntree = contexteAudio.sampleRate

  source = contexteAudio.createMediaStreamSource(flux)
  processeur = contexteAudio.createScriptProcessor(TAILLE_BLOC, 1, 1)

  processeur.onaudioprocess = (event) => {
    const donnees = event.inputBuffer.getChannelData(0)
    const pcm16k = reechantillonner16Bits(donnees, tauxEntree, 16000)
    onChunk(pcm16k)
  }

  source.connect(processeur)
  // Un ScriptProcessorNode doit être connecté à une destination pour que
  // Chromium continue d'appeler onaudioprocess — un gain à 0 évite tout
  // retour micro→haut-parleur audible.
  const silence = contexteAudio.createGain()
  silence.gain.value = 0
  processeur.connect(silence)
  silence.connect(contexteAudio.destination)

  return () => {
    try {
      processeur.disconnect()
      source.disconnect()
      silence.disconnect()
      flux.getTracks().forEach(t => t.stop())
      contexteAudio.close()
    } catch { /* déjà arrêté */ }
  }
}
