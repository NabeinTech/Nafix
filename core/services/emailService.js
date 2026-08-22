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

module.exports = { envoyerEmail }
