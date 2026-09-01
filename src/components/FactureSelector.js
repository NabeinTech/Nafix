import React from 'react'
import FacturePDF from './FacturePDF'
import FactureA5 from './FactureA5'
import FactureTicket from './FactureTicket'
import FactureBTP from './FactureBTP'

// Demande explicite : la facture premium (A4, même identité visuelle que le
// devis — en-tête sombre, bandeau teal, arrêtée à la somme de) s'applique
// par défaut sur tous les domaines métiers, plus de variation implicite par
// domaine (ticket pour alimentaire/restauration, btp pour quincaillerie...).
//
// formatManuel : choix explicite de l'utilisateur (Paramètres → Facturation)
// reste respecté — un commerce qui imprime réellement sur un ticket
// thermique ou une demi-page A5 peut toujours le sélectionner lui-même ;
// seul le comportement "auto" (ou absent) change.
export const getFormatFacture = (domaine, formatManuel) => {
  if (formatManuel && formatManuel !== 'auto') return formatManuel
  return 'standard'
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
