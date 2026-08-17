/**
 * 🤖 NAFIX AI CHATBOT - EXEMPLES DE CONVERSATIONS
 * 
 * Ces exemples montrent comment le chatbot répond aux différentes questions.
 * Utile pour tester et documentter la fonctionnalité.
 */

// ============================================================
// CONVERSATION 1: Ruptures de Stock
// ============================================================
export const EXAMPLE_CONVERSATION_1 = {
  titre: "Comment éviter les ruptures de stock?",
  messages: [
    {
      type: 'user',
      contenu: 'Bonjour, comment puis-je éviter les ruptures de stock?'
    },
    {
      type: 'bot',
      topic: '⚠️ Anticipation des Ruptures de Stock',
      contenu: `
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
    {
      type: 'user',
      contenu: 'Et si je veux augmenter le stock d\'un produit sans risque d\'invendu?'
    },
    {
      type: 'bot',
      contenu: `C'est une excellente question! Voici la stratégie recommandée:

1. **Analyser la rentabilité** 🏆
   → Utilisez l'onglet "Score Rentabilité"
   → Si grade = A+, augmenter le stock est SANS RISQUE
   → Si grade = D, réduire plutôt

2. **Évaluer la rotation**
   → Produits qui tournent vite = accumulation moins probable
   → Regardez: combien de fois le stock se renouvelle par mois

3. **Timing stratégique**
   → Augmenter avant une hausse prévisible (tendance HAUSSE sur CA)
   → Ou avant une campagne marketing

4. **Formule prudente**
   → Stock optimal = (Consommation/jour × Jours cycles réappro) + Stock de sécurité
   → Stock de sécurité = 2-3 jours supplémentaires pour les A+
      `
    }
  ]
}

// ============================================================
// CONVERSATION 2: Segmentation Client & Fidélisation
// ============================================================
export const EXAMPLE_CONVERSATION_2 = {
  titre: "Comment fidéliser mes meilleurs clients?",
  messages: [
    {
      type: 'user',
      contenu: 'Comment savoir qui sont mes meilleurs clients et comment les garder?'
    },
    {
      type: 'bot',
      topic: '👥 Segmentation Client RFM',
      contenu: `
## 👥 Segmentation Client RFM

**Qu'est-ce que c'est ?**
NafixAI classe vos clients en 5 segments selon 3 critères: Récence, Fréquence, Montant.

...[contenu complet]...

**Les 5 segments:**
⭐ **CHAMPION** → Acheteur régulier, gros CA, actif actuellement → Récompenser, fidéliser
🔥 **FIDÈLE** → Client loyal avec bon potentiel → Pousser produits premium
📈 **PROMETTEUR** → Progression positive → Proposer incitations
😴 **DORMANT** → Ancien bon client désactivé → Campagne de réactivation
❌ **PERDU** → Très inactif → À reconquérir ou ignorer
      `
    },
    {
      type: 'user',
      contenu: 'Quelle est la meilleure stratégie pour les Champions?'
    },
    {
      type: 'bot',
      contenu: `Excellente! Voici la stratégie pour les CHAMPIONS:

**RÉTENTION (priorité absolue):**
1. VIP Program
   → Accès prioritaire aux nouveaux produits
   → Réductions progressives selon fidélité
   → Événements exclusifs

2. Service Premium
   → Livraison gratuite
   → Support prioritaire
   → Personnalisation des offres

3. Reconnaissance
   → Système de points/parrainage
   → Communication personnalisée
   → Birthday/Anniversary offers

4. Feedback Loop
   → Consulter sur nouveaux produits
   → Suggestions de produits basées sur historique
   → Inviter à co-créer

**REVENUS (maximiser la valeur client):**
- Cross-sell: Proposer produits complémentaires
- Upsell: Versions premium de ce qu'ils achètent
- Panier moyen: Bundle intelligents

**KPI à suivre:**
- Rétention: Doit rester > 90% (Champions)
- Fréquence: Maintenir ou augmenter
- Montant: Viser +20% par an
- NPS (Net Promoter Score): Vérifier satisfaction
      `
    }
  ]
}

// ============================================================
// CONVERSATION 3: Optimisation de gamme produit
// ============================================================
export const EXAMPLE_CONVERSATION_3 = {
  titre: "Quels produits dois-je arrêter de vendre?",
  messages: [
    {
      type: 'user',
      contenu: 'J\'ai trop de SKU (articles). Comment savoir lesquels supprimer?'
    },
    {
      type: 'bot',
      topic: '🏆 Priorisation des Produits Rentables',
      contenu: `
## 🏆 Priorisation des Produits Rentables

**Score = (Marge × 0.4) + (Rotation × 0.3) + (CA × 0.3)**

**Grades:**
🏆 A+ (≥80): Pousser activement, maximiser stock
⭐ A (60-79): Maintenir, bon équilibre
✅ B (40-59): Surveiller, optimiser prix
⚠️ C (20-39): Réduire stock, tester baisse prix
❌ D (<20): Arrêter vente, libérer capital
      `
    },
    {
      type: 'user',
      contenu: 'Mais arrêter un produit, ça risque de décevoir certains clients?'
    },
    {
      type: 'bot',
      contenu: `Très bonne objection! Voici la stratégie prudente:

**Phase 1: AUDIT (1-2 semaines)**
1. Identifier produits grade D
2. Vérifier: Clients attachés? (Croiser RFM + historique achat)
3. Évaluer: Impact émotionnel vs. Impact financier

**Phase 2: MIGRATION (2-4 semaines)**
1. Offer Alternative
   → Proposer produit grade A/B+ similaire
   → Réduction de 10-15% sur le nouveau pour transfert
2. Communication
   → Message personnel aux champions acheteurs
   → Explique: "On optimise pour vous offrir mieux"
3. Période Transition
   → Garder en stock 1-2 mois
   → Utiliser comme bonus/cadeau pour autres achats

**Phase 3: SUPPRESSION (après 3-4 semaines marge)**
1. Dernier stock = Promo aggressive (-30% à -50%)
2. Ou: Vendre en vrac à revendeurs

**Exemple Réel:**
Produit D: 2 clients fidèles, marge -5%
→ Coûte 50k FCFA/mois en stock mort
→ Action: Proposer alternative premium, gain net = +30k FCFA/mois
      `
    }
  ]
}

// ============================================================
// CONVERSATION 4: Prédiction et Budgeting
// ============================================================
export const EXAMPLE_CONVERSATION_4 = {
  titre: "Comment utiliser les prédictions pour budgétiser?",
  messages: [
    {
      type: 'user',
      contenu: 'Les prédictions de NafixAI, je dois m\'y fier pour le budget?'
    },
    {
      type: 'bot',
      topic: '📈 Prévision du Chiffre d\'Affaires',
      contenu: `
## 📈 Prévision du Chiffre d'Affaires

**Comment ça marche?**
Régression linéaire sur historique de ventes mensuelles.
La confiance (R²) indique la fiabilité de la prédiction.

R² = 80% → Très fiable
R² = 60% → Fiable mais à prudence
R² = 40% → À prendre avec réserve
R² = <40% → Données insuffisantes

**Exemple:**
Historique: 100k → 110k → 120k
Tendance: +10k/mois
Prédiction M+1: 130k (confiance 85%)
      `
    },
    {
      type: 'user',
      contenu: 'Quelle est la marge de sécurité recommandée pour budgétiser?'
    },
    {
      type: 'bot',
      contenu: `Excellent! Voici la méthode professionnelle de budgeting:

**FORMULE PRUDENTE:**
Budget = (Prédiction × Confiance) + (Prédiction × 0.1) - (Prédiction × 0.05)
Soit: Prédiction × [(R² + 10% - 5%) / 100]

**Exemples concrets:**
1. Prédiction 100k, R² 85%
   → Budget = 100k × 0.90 = 90k (scénario pessimiste: -10%)
   → Utiliser 90k pour dépenses, 85k pour bons de achats

2. Prédiction 100k, R² 60%
   → Budget = 100k × 0.75 = 75k (plus prudent)

3. Prédiction 100k, R² 40%
   → Budget = 100k × 0.60 = 60k (très prudent, données faibles)

**BUDGETS À PLANIFIER:**
1. **Basé sur tendance:**
   - Stock de sécurité
   - Embauches saisonnières
   - Achats marketing

2. **Réserve de trésorerie:**
   - 20% du budget pour imprévu
   - Couvre: rupture supplier, baisse inattendue

3. **Investment projets:**
   - Si confiance > 75%: Peut investir
   - Si confiance < 50%: Attendre plus de data

**Suivi mensuel:**
- Comparer réel vs. budget
- Si écart > 15%: Revalider prédiction
- Ajuster pour mois suivants
      `
    }
  ]
}

// ============================================================
// Tests & Validation
// ============================================================
export const CHATBOT_TEST_CASES = [
  {
    question: 'Comment éviter les ruptures de stock?',
    expectedTopic: 'ruptures_stock',
    keywords: ['rupture', 'stock']
  },
  {
    question: 'Quels sont mes meilleurs clients',
    expectedTopic: 'segmentation_clients',
    keywords: ['client', 'rfm', 'champion']
  },
  {
    question: 'Quelle est la rentabilité de mes produits',
    expectedTopic: 'rentabilite_produits',
    keywords: ['produit', 'rentabilité', 'marge', 'grade']
  },
  {
    question: 'Comment prédire le chiffre d\'affaires',
    expectedTopic: 'prevision_ca',
    keywords: ['chiffre affaires', 'ca', 'prédiction', 'tendance']
  },
  {
    question: 'Comment fonctionne NafixAI',
    expectedTopic: 'comment_ca_marche',
    keywords: ['comment', 'fonctionnement', 'ia']
  },
  {
    question: 'Guide d\'utilisation',
    expectedTopic: 'aide_utilisation',
    keywords: ['aide', 'guide', 'tutoriel']
  }
]

const chatbotExamplesExport = {
  EXAMPLE_CONVERSATION_1,
  EXAMPLE_CONVERSATION_2,
  EXAMPLE_CONVERSATION_3,
  EXAMPLE_CONVERSATION_4,
  CHATBOT_TEST_CASES
}

export default chatbotExamplesExport
