import React, { useState, useRef, useEffect } from 'react'
import { Input, Button, Card, Space, Tag, Avatar, Spin, Divider, Tooltip } from 'antd'
import { SendOutlined, RobotOutlined, UserOutlined, ClearOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { formatMarkdown } from '../utils/formatMarkdown'
import './NafixAIChat.css'

const ipcRenderer = typeof window !== 'undefined' ? window.ipcRenderer : null

/**
 * 🤖 NAFIX AI CHATBOT
 * Aide intelligente pour comprendre les décisions commerciales
 * Focus: Transformer les données de vente en décisions concrètes
 */

// Base de connaissances structurée
const KNOWLEDGE_BASE = {
  // 1. PRÉVISION DU CHIFFRE D'AFFAIRES
  'prevision_ca': {
    titre: '📈 Prévision du Chiffre d\'Affaires',
    keywords: ['chiffre affaires', 'ca', 'prévision', 'tendance', 'hausse', 'baisse', 'croissance', 'ventes futures'],
    description: 'Prédire votre CA pour les 3 prochains mois',
    reponse: `
## 📈 Prévision du Chiffre d'Affaires

**Qu'est-ce que c'est ?**
NafixAI analyse votre historique de ventes mensuelles pour prédire le CA à venir.

**Comment ça marche ?**
- NafixAI crée un modèle mathématique de vos ventes passées
- Il détecte la tendance: hausse, baisse, ou stabilité
- Il calcule les prédictions pour les 3 mois suivants
- La confiance (R²) indique la fiabilité: plus elle est haute, plus la prédiction est sûre

**À quoi ça sert ?**
✅ Anticiper votre budget mensuel
✅ Planifier les embauches saisonnières
✅ Ajuster les achats de stock en fonction de la demande
✅ Identifier les anomalies (pics ou creux inhabituels)

**Exemple concret:**
Si vos ventes ont augmenté régulièrement (100k → 120k → 140k), NafixAI prédit 160k le mois suivant.

**Comment utiliser cette donnée ?**
- Si tendance hausse → augmenter stock des best-sellers
- Si tendance baisse → lancer des promotions ciblées
- Si confiance faible → attendre plus de données avant grandes décisions
    `
  },

  // 2. RUPTURES DE STOCK
  'ruptures_stock': {
    titre: '⚠️ Anticipation des Ruptures de Stock',
    keywords: ['rupture', 'stock', 'rupture stock', 'réapprovisionnement', 'alerte', 'tension', 'manque'],
    description: 'Éviter les ruptures et optimiser les commandes',
    reponse: `
## ⚠️ Anticipation des Ruptures de Stock

**Qu'est-ce que c'est ?**
NafixAI estime combien de jours il vous reste avant de manquer de produit.

**Comment ça marche ?**
- Analyse de la consommation moyenne quotidienne par produit
- Calcul: Jours restants = Stock actuel ÷ Consommation/jour
- Classification des risques: critique (0-3j), élevé (4-7j), modéré (8-14j), faible (15+j)

**À quoi ça sert ?**
✅ Éviter les ruptures et perdre des clients
✅ Optimiser le coût du réapprovisionnement (pas d'urgence coûteuse)
✅ Planifier des commandes cohérentes
✅ Identifier les produits à forte rotation

**Exemple concret:**
Votre "Savon Premium" se consomme à 10 unités/jour et vous en avez 50 en stock.
→ Il reste 5 jours avant rupture (risque = élevé)
→ Action: Commande urgente dans 2 jours

**Codes couleur:**
🚨 CRITIQUE (0-3j) → Agir immédiatement
⚠️ ÉLEVÉ (4-7j) → Commande rapide prévue
🔶 MODÉRÉ (8-14j) → À surveiller
✅ FAIBLE (15+j) → Situation saine

**Stratégie:**
- Réapprovisionner dès que le risque passe en "élevé"
- Prévoir des stocks tampons pour les produits à forte rotation
- Négocier des délais courts avec fournisseurs clés
    `
  },

  // 3. SEGMENTATION CLIENT RFM
  'segmentation_clients': {
    titre: '👥 Identification des Meilleurs et Fragiles Clients',
    keywords: ['client', 'segmentation', 'rfm', 'champion', 'fidèle', 'dormant', 'perdu', 'meilleur client', 'inactif'],
    description: 'Connaître la valeur réelle de chaque client',
    reponse: `
## 👥 Segmentation Client RFM

**Qu'est-ce que c'est ?**
NafixAI classe vos clients en 5 segments selon 3 critères: Récence, Fréquence, Montant.

**Les 3 dimensions:**

**R = Récence** → Date du dernier achat
- Client qui a acheté hier = meilleur score
- Client inactif depuis 6 mois = Note faible

**F = Fréquence** → Nombre d'achats
- Client qui achète 2x/mois > client qui achète 1x/trimestre

**M = Montant** → Valeur totale dépensée
- Grand dépensier > petit dépensier

**Les 5 segments:**

⭐ **CHAMPION** (RFM ≥ 13/15)
→ Acheteur régulier, gros CA, actif actuellement
→ Action: Récompenser, fidéliser, consulter

🔥 **FIDÈLE** (RFM = 10-12/15)
→ Client loyal avec bon potentiel
→ Action: Pousser des produits premium, proposer services

📈 **PROMETTEUR** (RFM = 7-9/15)
→ Progression positive mais pas encore optimal
→ Action: Proposer incitations pour augmenter fréquence

😴 **DORMANT** (RFM = 4-6/15)
→ Ancien bon client qui s'est désactivé
→ Action: Campagne de réactivation, offre spéciale

❌ **PERDU** (RFM < 4/15)
→ Très inactif, engagement minimal
→ Action: À reconquérir ou dépenser moins sur ce segment

**Exemple concret:**
Client A: acheté hier, 20 fois/an, 500k FCFA CA → CHAMPION
Client B: acheté il y a 1 an, 2 fois/an, 50k FCFA CA → PERDU
Client C: acheté il y a 15j, 8 fois/an, 200k FCFA CA → FIDÈLE

**Stratégie commerciale:**
- 80% des profits viennent des 20% de clients (Champions + Fidèles)
- Investir en rétention des Champions
- Mapper un plan de réactivation pour Dormants/Perdus
- Créer des chemins de progression: Prometteur → Fidèle → Champion
    `
  },

  // 4. RENTABILITÉ PRODUIT
  'rentabilite_produits': {
    titre: '🏆 Priorisation des Produits Rentables',
    keywords: ['produit', 'rentabilité', 'marge', 'profit', 'grade', 'a+', 'score', 'ca', 'rotation'],
    description: 'Identifier les produits qui rapportent vraiment',
    reponse: `
## 🏆 Priorisation des Produits Rentables

**Qu'est-ce que c'est ?**
NafixAI évalue chaque produit sur sa vraie rentabilité (pas juste le prix!).

**Les 3 critères du score:**

**📊 MARGE** (40% du score)
- Marge = Prix vente - Prix achat
- Produit 1: Prix vente 10k, prix achat 4k → Marge = 6k (60%)
- Produit 2: Prix vente 5k, prix achat 3k → Marge = 2k (67%)
→ Le produit 2 a meilleure marge même si prix plus bas!

**🔄 ROTATION** (30% du score)
- Combien de fois le stock se renouvelle
- Produit qui tourne vite = meilleure trésorerie
- Produit qui dort = immobilise capital

**💰 CHIFFRE D'AFFAIRES** (30% du score)
- Contribution totale au CA
- Gros vendeur même avec marge faible peut être intéressant

**Les GRADES (A+ → D):**

🏆 **A+** (Score ≥ 80)
→ Excellent: forte marge, bonne rotation, bon CA
→ Action: Pousser activement, augmenter stock

⭐ **A** (Score = 60-79)
→ Bon produit, à maintenir
→ Action: Garder stock stable, suggérer en cross-sell

✅ **B** (Score = 40-59)
→ Moyen, ne fait pas perdre mais ne rapporte pas assez
→ Action: Évaluer réduction prix ou arrêt

⚠️ **C** (Score = 20-39)
→ Faible rentabilité, à surveiller
→ Action: Réduction prix test ou suppression

❌ **D** (Score < 20)
→ Non rentable
→ Action: Arrêter la vente, libérer stock

**Exemple concret:**
Produit X: Marge 50%, Rotation 2/mois, CA 200k
→ Score très élevé → Grade A+

Produit Y: Marge 5%, Rotation 0.5/mois, CA 100k
→ Score faible → Grade C ou D
→ Pas intérêt à le vendre

**Stratégie d'optimisation:**
1. Identifier les A+ → Maximiser stock et visibilité
2. Upgrader les B en A: baisse prix ou améliorer marge
3. Arrêter les D et redéployer le capital
4. Créer des bundles: A+ avec B pour pousser les faibles
    `
  },

  // Questions générales
  'comment_ca_marche': {
    titre: '🤔 Comment fonctionne NafixAI ?',
    keywords: ['comment', 'fonctionnement', 'comment ça marche', 'explication', 'algorithme', 'machine learning', 'ia'],
    description: 'Comprendre la technologie derrière NafixAI',
    reponse: `
## 🤔 Comment fonctionne NafixAI ?

**Architecture générale:**
1. **Collecte** → Analyze vos ventes (dates, montants, produits, clients)
2. **Traitement** → Applique des modèles statistiques éprouvés
3. **Prédiction** → Génère insights actionnables
4. **Recommandation** → Propose des actions concrètes

**Technologies utilisées:**
- 📊 **Régression linéaire** pour les prédictions CA
- 📈 **Z-Score** pour la détection d'anomalies
- 🎯 **Scoring RFM** pour segmentation client
- ⚙️ **Algorithmes de rotation** pour prédiction ruptures

**Qualité des données:**
→ Meilleur historique = Meilleures prédictions
→ Données saisies correctement = Résultats fiables
→ Plus de temps = Plus de certitude

**Confidentialité:**
✅ Vos données restent confidentielles
✅ Aucun partage externe
✅ Traitement 100% local
    `
  },

  'aide_utilisation': {
    titre: '📖 Guide d\'utilisation',
    keywords: ['aide', 'guide', 'utilisation', 'comment utiliser', 'tutoriel', 'pas à pas'],
    description: 'How-to pour exploiter au maximum NafixAI',
    reponse: `
## 📖 Guide d'utilisation NafixAI

**Les 4 onglets:**

1️⃣ **Prédictions CA**
→ Voir la tendance et projections 3 mois
→ Identifier les anomalies
→ Utiliser pour budget prévisionnel

2️⃣ **Alertes Stock IA**
→ Lister les produits à risque
→ Priorité: critiques d'abord
→ Lancer commandes basées sur ces alertes

3️⃣ **Segmentation RFM**
→ Voir les 5 segments de clients
→ Cliquer sur un segment pour actions possibles
→ Planifier campagnes de marketing ciblées

4️⃣ **Score Rentabilité**
→ Identifier les A+ à pousser
→ Évaluer les D à arrêter
→ Optimiser le mix produits

**Bonnes pratiques:**
✅ Consulter NafixAI 1x/semaine minimum
✅ Agir sur les alertes CRITIQUES immédiatement
✅ Planifier actions avec prédictions (2-3 mois d'avance)
✅ Réévaluer produits tous les trimestres
    `
  },

  'roi': {
    titre: '💰 Retour sur Investissement',
    keywords: ['roi', 'retour', 'investissement', 'gain', 'profit', 'économie', 'bénéfice', 'coût'],
    description: 'Quel impact commercial attend-vous ?',
    reponse: `
## 💰 Retour sur Investissement NafixAI

**Gains mesurables:**

📦 **Réduction ruptures de stock** (-30% à -50%)
→ Gagnez: Ventes non perdues
→ Exemple: 10 ruptures/mois × 50k FCFA = 500k FCFA gagnés/mois

💰 **Optimisation marge** (+5% à +15%)
→ Gagnez: Arrêt des produits D, focus sur A+
→ Exemple: 1M FCFA CA × 10% = 100k FCFA supplémentaires/mois

📈 **Augmentation fréquence client** (+20% à +40%)
→ Gagnez: Réactivation dormants, fidélisation champions
→ Exemple: 10 dormants réactivés × 50k FCFA = 500k FCFA/mois

⏱️ **Gain de temps** (-50% temps d'analyse)
→ Gagnez: 10-15h/mois x votre taux horaire

**ROI Typique:**
- Mois 1-2: Apprentissage, gains faibles
- Mois 3-4: Premiers gains (+200k FCFA)
- Mois 6+: Gains mensuels réguliers (500k-1M FCFA)

**Breakeven:** Généralement atteint en 2-3 mois
    `
  }
}

// Intentions qui nécessitent des données réelles
const INTENTIONS_DONNEES = {
  mon_stock: {
    keywords: ['mon stock', 'mes stocks', 'stock actuel', 'alertes stock', 'rupture', 'manque', 'produit critique', 'produits critiques'],
    fetch: async () => {
      const stats = await ipcRenderer?.invoke('stats:getAll')
      const alertes = stats?.alertesStock || []
      if (alertes.length === 0) return '✅ Aucune alerte de stock ! Tous vos produits sont au-dessus du seuil minimum.'
      return `## ⚠️ ${alertes.length} produit(s) en alerte de stock\n\n` +
        alertes.slice(0, 8).map(p =>
          `**${p.nom}** — Stock : **${p.stock_actuel}** / Minimum : ${p.stock_minimum} ${p.unite || 'pcs'}`
        ).join('\n') +
        (alertes.length > 8 ? `\n\n_...et ${alertes.length - 8} autres produits._` : '')
    }
  },
  mes_ventes_today: {
    keywords: ['ventes aujourd\'hui', "vente d'aujourd'hui", 'aujourd\'hui', 'ce jour', 'ventes du jour'],
    fetch: async () => {
      const stats = await ipcRenderer?.invoke('stats:getAll')
      const v = stats?.ventesAujourdhui || { nb: 0, total: 0 }
      return `## 🛒 Ventes d'aujourd'hui\n\n**${v.nb} vente(s)** pour un total de **${(v.total || 0).toLocaleString('fr-FR')} FCFA**`
    }
  },
  mes_ventes_mois: {
    keywords: ['ventes du mois', 'ce mois', 'mois en cours', 'chiffre mois'],
    fetch: async () => {
      const stats = await ipcRenderer?.invoke('stats:getAll')
      const m = stats?.ventesMois || { nb: 0, total: 0 }
      const ca = stats?.chiffreAffaire || 0
      return `## 📅 Ventes du mois\n\n**${m.nb} vente(s)** — Total : **${(m.total || 0).toLocaleString('fr-FR')} FCFA**\n\nCA global tous temps : **${ca.toLocaleString('fr-FR')} FCFA**`
    }
  },
  top_clients: {
    keywords: ['meilleur client', 'top client', 'clients les plus', 'client fidèle', 'mes clients'],
    fetch: async () => {
      const stats = await ipcRenderer?.invoke('stats:getAll')
      const tops = stats?.topClients || []
      if (tops.length === 0) return 'Aucun client avec des achats enregistrés pour le moment.'
      return `## 👥 Top 5 clients\n\n` +
        tops.slice(0, 5).map((c, i) =>
          `**${i + 1}. ${c.nom || 'Anonyme'}** — ${(c.ca || 0).toLocaleString('fr-FR')} FCFA (${c.nb_ventes} achats)`
        ).join('\n')
    }
  },
  top_produits: {
    keywords: ['meilleur produit', 'top produit', 'produit le plus vendu', 'best-seller', 'bestseller'],
    fetch: async () => {
      const stats = await ipcRenderer?.invoke('stats:getAll')
      const tops = stats?.topProduits || []
      if (tops.length === 0) return 'Aucune vente enregistrée pour analyser les produits.'
      return `## 📦 Top produits vendus\n\n` +
        tops.slice(0, 5).map((p, i) =>
          `**${i + 1}. ${p.nom}** — ${p.total_vendu} vendu(s) pour **${(p.ca || 0).toLocaleString('fr-FR')} FCFA**`
        ).join('\n')
    }
  },
  top_sous_categories: {
    keywords: ['sous-catégorie', 'sous catégorie', 'meilleure sous', 'top sous', 'sous cat', 'souscategorie'],
    fetch: async () => {
      const stats = await ipcRenderer?.invoke('stats:getAll')
      const tops = stats?.topSousCategories || []
      if (tops.length === 0) return 'Aucune sous-catégorie avec des ventes pour le moment.\n\nConseil : assignez des sous-catégories à vos produits dans **Produits → Ajouter/Modifier**.'
      return `## 🔖 Top sous-catégories par chiffre d'affaires\n\n` +
        tops.slice(0, 5).map((sc, i) =>
          `**${i + 1}. ${sc.nom}** — ${sc.total_vendu} article(s) vendus — **${(sc.ca || 0).toLocaleString('fr-FR')} FCFA**`
        ).join('\n') +
        `\n\n**Meilleure sous-catégorie :** 🏆 ${tops[0]?.nom} avec **${(tops[0]?.ca || 0).toLocaleString('fr-FR')} FCFA** de CA`
    }
  },
  mon_bilan: {
    keywords: ['bilan', 'résumé', 'synthèse', 'vue d\'ensemble', 'situation', 'global'],
    fetch: async () => {
      const stats = await ipcRenderer?.invoke('stats:getAll')
      if (!stats) return 'Impossible de charger les données.'
      return `## 📊 Bilan général\n\n` +
        `- **Chiffre d'affaires total :** ${(stats.chiffreAffaire || 0).toLocaleString('fr-FR')} FCFA\n` +
        `- **Nombre de ventes :** ${stats.totalVentes || 0}\n` +
        `- **Clients enregistrés :** ${stats.totalClients || 0}\n` +
        `- **Produits en catalogue :** ${stats.totalProduits || 0}\n` +
        `- **Panier moyen :** ${(stats.panierMoyen || 0).toLocaleString('fr-FR')} FCFA\n` +
        `- **Alertes stock :** ${(stats.alertesStock || []).length} produit(s)`
    }
  }
}

function extraireIntention(message) {
  const msg = message.toLowerCase()

  // Chercher d'abord dans les intentions données réelles
  for (const [key, intent] of Object.entries(INTENTIONS_DONNEES)) {
    if (intent.keywords.some(kw => msg.includes(kw))) return { type: 'donnees', key }
  }

  // Sinon chercher dans la base de connaissances statique
  for (const [key, topic] of Object.entries(KNOWLEDGE_BASE)) {
    if (topic.keywords.some(kw => msg.includes(kw))) return { type: 'statique', key }
  }

  return null
}

// Composant principal
function NafixAIChat() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      contenu: '👋 Bonjour! Je suis votre assistant NafixAI. Je suis ici pour vous aider à comprendre comment transformer vos données de vente en décisions commerciales concrètes.\n\n**Que puis-je vous expliquer aujourd\'hui ?**',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const envoyerMessage = async () => {
    if (!inputValue.trim()) return

    const userMsg = {
      id: Date.now(),
      type: 'user',
      contenu: inputValue,
      timestamp: new Date()
    }
    const texteQuestion = inputValue
    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    setLoading(true)

    try {
      const intention = extraireIntention(texteQuestion)
      let reponseBot

      if (intention?.type === 'donnees') {
        const texte = await INTENTIONS_DONNEES[intention.key].fetch()
        reponseBot = {
          id: Date.now() + 1,
          type: 'bot',
          contenu: texte,
          topic: '📊 Données en temps réel',
          timestamp: new Date()
        }
      } else if (intention?.type === 'statique') {
        const topic = KNOWLEDGE_BASE[intention.key]
        reponseBot = {
          id: Date.now() + 1,
          type: 'bot',
          contenu: topic.reponse,
          topic: topic.titre,
          timestamp: new Date()
        }
      } else {
        reponseBot = {
          id: Date.now() + 1,
          type: 'bot',
          contenu: `Je n'ai pas bien compris. Voici ce que je peux faire :\n\n**Données réelles de votre boutique :**\n📦 "Mon stock" — alertes stock actuelles\n🛒 "Ventes aujourd'hui" — chiffre du jour\n📅 "Ventes du mois" — bilan mensuel\n👥 "Meilleurs clients" — top clients\n📦 "Meilleurs produits" — best-sellers\n📊 "Mon bilan" — synthèse globale\n\n**Analyses IA :**\n📈 "Prévision CA" — tendances futures\n⚠️ "Ruptures de stock" — anticipation\n👥 "Segmentation clients" — RFM\n🏆 "Rentabilité produits" — grades`,
          timestamp: new Date()
        }
      }

      setMessages(prev => [...prev, reponseBot])
    } catch (e) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'bot',
        contenu: '❌ Impossible de charger les données. Vérifiez la connexion.',
        timestamp: new Date()
      }])
    }
    setLoading(false)
  }

  const effacerHistorique = () => {
    setMessages([{
      id: 1,
      type: 'bot',
      contenu: '👋 Historique effacé. Comment puis-je vous aider ?',
      timestamp: new Date()
    }])
  }

  const souscrireTopique = (topicKey) => {
    const inputElement = document.querySelector('.nafix-chat-input')
    if (inputElement) {
      setInputValue(KNOWLEDGE_BASE[topicKey].titre.split(' ').slice(1).join(' '))
      inputElement.focus()
    }
  }

  return (
    <div className="nafix-chat-container">
      <Card className="nafix-chat-card" bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div className="nafix-chat-header">
          <Space>
            <Avatar size={40} style={{ background: '#1890ff' }} icon={<RobotOutlined />} />
            <div>
              <div className="nafix-chat-title">🤖 NafixAI Assistant</div>
              <div className="nafix-chat-subtitle">Aide intelligente aux décisions commerciales</div>
            </div>
          </Space>
          <Button 
            icon={<ClearOutlined />} 
            size="small" 
            onClick={effacerHistorique}
            type="text"
          >
            Effacer
          </Button>
        </div>

        <Divider style={{ margin: 0 }} />

        {/* Messages */}
        <div className="nafix-chat-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`nafix-message nafix-message-${msg.type}`}>
              {msg.type === 'bot' ? (
                <>
                  <Avatar size={32} style={{ background: '#52c41a' }} icon={<RobotOutlined />} />
                  <div className="nafix-message-content">
                    {msg.topic && <Tag color="blue" style={{ marginBottom: 8 }}>{msg.topic}</Tag>}
                    <div className="nafix-message-text" dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.contenu) }} />
                  </div>
                </>
              ) : (
                <>
                  <div className="nafix-message-content">
                    <div className="nafix-message-text">{msg.contenu}</div>
                  </div>
                  <Avatar size={32} style={{ background: '#1890ff' }} icon={<UserOutlined />} />
                </>
              )}
            </div>
          ))}
          {loading && (
            <div className="nafix-message nafix-message-bot">
              <Avatar size={32} style={{ background: '#52c41a' }} icon={<RobotOutlined />} />
              <div className="nafix-message-content">
                <Spin size="small" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <Divider style={{ margin: 0 }} />

        {/* Quick topics */}
        {messages.length < 3 && (
          <div className="nafix-chat-quick-topics">
            <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
              <QuestionCircleOutlined /> Suggestions rapides :
            </div>
            <Space wrap size="small">
              {[
                { label: '📦 Mon stock', texte: 'Mon stock' },
                { label: '🛒 Ventes aujourd\'hui', texte: 'Ventes aujourd\'hui' },
                { label: '👥 Meilleurs clients', texte: 'Meilleurs clients' },
                { label: '📊 Mon bilan', texte: 'Mon bilan' },
                { label: '📈 Prévision CA', texte: 'Prévision chiffre affaires' },
                { label: '🏆 Top produits', texte: 'Meilleurs produits' },
                { label: '🔖 Top sous-catégories', texte: 'Meilleure sous-catégorie' },
              ].map((s, i) => (
                <Button key={i} size="small" type="dashed"
                  onClick={() => setInputValue(s.texte)}>
                  {s.label}
                </Button>
              ))}
            </Space>
          </div>
        )}

        {/* Input */}
        <div className="nafix-chat-input-area">
          <Space.Compact style={{ width: '100%' }}>
            <Input
              className="nafix-chat-input"
              placeholder="Posez votre question... (ex: 'Comment éviter les ruptures?')"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPressEnter={envoyerMessage}
              disabled={loading}
            />
            <Button 
              type="primary" 
              icon={<SendOutlined />}
              onClick={envoyerMessage}
              loading={loading}
            />
          </Space.Compact>
        </div>
      </Card>
    </div>
  )
}

export default NafixAIChat
