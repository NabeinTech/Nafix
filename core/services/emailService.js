// Chantier mot de passe oublie — envoi d'email via l'API HTTP de Resend
// (fetch global, Node 24 — meme philosophie que paydunyaService.js : pas de
// SDK, pas de nouvelle dependance). RESEND_FROM a configurer une fois un
// domaine verifie sur Resend ; onboarding@resend.dev sert de repli sinon
// (limites habituelles d'un expediteur non verifie).
async function envoyerEmail({ to, subject, html }) {
  const reponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'Nafix <onboarding@resend.dev>',
      to,
      subject,
      html
    })
  })
  if (!reponse.ok) {
    const corps = await reponse.text().catch(() => '')
    throw new Error('Envoi email échoué : ' + corps)
  }
}

// Audit securite (revue generale) — variante du meme probleme corrige pour
// NafixAIChat (Cycle 1) : les templates d'email interpolent des noms
// choisis par l'utilisateur (nom de compte, nom d'organisation) directement
// dans du HTML, sans echappement. Risque reel faible ici (le destinataire
// est toujours proprietaire de la donnee affichee, et les clients email
// n'executent pas de JavaScript), mais cout de correction nul et coherent
// avec la politique appliquee partout ailleurs dans le depot.
function echapperHtml(valeur) {
  return String(valeur ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

module.exports = { envoyerEmail, echapperHtml }
