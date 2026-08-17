// Liaison FFI vers libvosk.dll via Koffi — remplace le binding officiel du
// paquet 'vosk' (basé sur ffi-napi/ref-napi) qui échoue sous ce Node/Electron
// avec "External buffers are not allowed" : les versions récentes de V8
// activent un bac à sable mémoire qui interdit la technique de wrapping de
// pointeurs bruts utilisée par ffi-napi. Koffi est une bibliothèque FFI
// moderne, avec binaires précompilés, conçue pour rester compatible avec ces
// protections — on réutilise simplement la DLL Vosk déjà présente dans
// node_modules/vosk (mêmes fonctions C, aucune recompilation nécessaire).
//
// Expose la même API que le paquet 'vosk' d'origine (setLogLevel, Model,
// Recognizer) pour que server/voskEngine.js n'ait presque rien à changer.

const os = require('os')
const path = require('path')
const koffi = require('koffi')

function getDllPath() {
  const base = path.join(__dirname, '..', 'node_modules', 'vosk', 'lib')
  if (os.platform() === 'win32') return path.join(base, 'win-x86_64', 'libvosk.dll')
  if (os.platform() === 'darwin') return path.join(base, 'osx-universal', 'libvosk.dylib')
  return path.join(base, 'linux-x86_64', 'libvosk.so')
}

const lib = koffi.load(getDllPath())

const vosk_set_log_level = lib.func('void vosk_set_log_level(int level)')
const vosk_model_new = lib.func('void *vosk_model_new(const char *model_path)')
const vosk_model_free = lib.func('void vosk_model_free(void *model)')
const vosk_recognizer_new = lib.func('void *vosk_recognizer_new(void *model, float sample_rate)')
const vosk_recognizer_free = lib.func('void vosk_recognizer_free(void *recognizer)')
const vosk_recognizer_set_words = lib.func('void vosk_recognizer_set_words(void *recognizer, bool words)')
const vosk_recognizer_set_partial_words = lib.func('void vosk_recognizer_set_partial_words(void *recognizer, bool partial_words)')
const vosk_recognizer_accept_waveform = lib.func('bool vosk_recognizer_accept_waveform(void *recognizer, const uint8_t *data, int length)')
const vosk_recognizer_result = lib.func('const char *vosk_recognizer_result(void *recognizer)')
const vosk_recognizer_partial_result = lib.func('const char *vosk_recognizer_partial_result(void *recognizer)')
const vosk_recognizer_final_result = lib.func('const char *vosk_recognizer_final_result(void *recognizer)')

function setLogLevel(level) {
  vosk_set_log_level(level)
}

class Model {
  constructor(modelPath) {
    this.handle = vosk_model_new(modelPath)
  }
  free() {
    vosk_model_free(this.handle)
  }
}

class Recognizer {
  constructor({ model, sampleRate }) {
    this.handle = vosk_recognizer_new(model.handle, sampleRate)
  }
  free() {
    vosk_recognizer_free(this.handle)
  }
  setWords(words) {
    vosk_recognizer_set_words(this.handle, words)
  }
  setPartialWords(partialWords) {
    vosk_recognizer_set_partial_words(this.handle, partialWords)
  }
  acceptWaveform(data) {
    return vosk_recognizer_accept_waveform(this.handle, data, data.length)
  }
  result() {
    return JSON.parse(vosk_recognizer_result(this.handle))
  }
  partialResult() {
    return JSON.parse(vosk_recognizer_partial_result(this.handle))
  }
  finalResult() {
    return JSON.parse(vosk_recognizer_final_result(this.handle))
  }
}

module.exports = { setLogLevel, Model, Recognizer }
