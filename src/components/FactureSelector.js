import React from 'react'
import FacturePDF from './FacturePDF'
import FactureA5 from './FactureA5'
import FactureTicket from './FactureTicket'
import FactureBTP from './FactureBTP'

// Mapping domaine → format de facture par défaut ("auto")
const FORMAT_PAR_DOMAINE = {
  alimentaire: 'ticket',
  restauration: 'ticket',
  informatique: 'standard',
  textile: 'standard',
  general: 'standard',
  quincaillerie: 'btp',
  btp: 'btp',
}

// formatManuel : choix explicite de l'utilisateur (Paramètres → Facturation).
// 'auto' (ou absent) conserve le comportement historique déduit du domaine.
export const getFormatFacture = (domaine, formatManuel) => {
  if (formatManuel && formatManuel !== 'auto') return formatManuel
  return FORMAT_PAR_DOMAINE[domaine] || 'standard'
}

function FactureSelector({ facture, parametres, domaine, formatManuel }) {
  const format = getFormatFacture(domaine, formatManuel)

  if (format === 'ticket') {
    return <FactureTicket facture={facture} parametres={parametres} />
  }
  if (format === 'a5') {
    return <FactureA5 facture={facture} parametres={parametres} />
  }
  if (format === 'btp') {
    return <FactureBTP facture={facture} parametres={parametres} />
  }
  return <FacturePDF facture={facture} parametres={parametres} />
}

export default FactureSelector
