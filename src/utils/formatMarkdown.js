// Audit securite — extrait de NafixAIChat.js pour permettre un test
// reproductible (fonctions pures, sans JSX, testables directement en Node).
// echapperHtml() neutralise tout HTML avant que formatMarkdown() applique
// ses transformations (gras/titre) : les balises ajoutees ne peuvent jamais
// etre "cassées" par un nom de produit/client malveillant puisque le texte
// est deja neutralise en entree.
export function echapperHtml(texte) {
  return String(texte)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function formatMarkdown(text) {
  return echapperHtml(text)
    .replace(/##\s+(.+)/g, '<h3 style="margin-top: 12px; margin-bottom: 8px; color: #1890ff;">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color: #333;">$1</strong>')
    .replace(/→\s/g, '→ ')
    .split('\n').map(line => `<div style="margin: 4px 0; line-height: 1.6;">${line}</div>`).join('')
}
