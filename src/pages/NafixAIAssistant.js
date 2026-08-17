import React from 'react'
import NafixAI from './NafixAI'

// ✅ Redirige vers NafixAI existant
function NafixAIAssistant({ utilisateur }) {
  return <NafixAI utilisateur={utilisateur} />
}

export default NafixAIAssistant