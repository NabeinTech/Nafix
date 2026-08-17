# 🤖 NafixAI ChatBot - Documentation

## Vue d'ensemble

Le **NafixAI ChatBot** est un assistant intelligent conçu pour aider les utilisateurs à comprendre et exploiter les décisions commerciales générées par le moteur d'analyse NafixAI.

Il transforme des données de vente complexes en actions concrètes sur **4 axes principaux**.

---

## 🎯 4 Axes Décisionnels

### 1️⃣ **Prévision du Chiffre d'Affaires** 📈
- **Objectif:** Prédire le CA pour les 3 prochains mois
- **Technologie:** Régression linéaire avec coefficient de confiance (R²)
- **Cas d'usage:**
  - Planifier les budgets mensuels
  - Ajuster les achats de stock en fonction de la demande
  - Détecter les anomalies (pics/creux inhabituels)

**Exemple:** Si vos ventes augmentent régulièrement → Augmenter le stock des best-sellers

---

### 2️⃣ **Anticipation des Ruptures de Stock** ⚠️
- **Objectif:** Éviter les ruptures et optimiser le réapprovisionnement
- **Technologie:** Calcul de consommation quotidienne + Jours restants
- **Système d'alerte:**
  - 🚨 **CRITIQUE** (0-3 jours) → Agir immédiatement
  - ⚠️ **ÉLEVÉ** (4-7 jours) → Commande rapide
  - 🔶 **MODÉRÉ** (8-14 jours) → À surveiller
  - ✅ **FAIBLE** (15+ jours) → Situation saine

**Exemple:** "Savon Premium" se consomme à 10 unités/jour, stock = 50
→ 5 jours reste → Risque = ÉLEVÉ → Commande en urgence

---

### 3️⃣ **Segmentation Client RFM** 👥
- **Objectif:** Identifier les meilleurs et plus fragiles clients
- **Dimensions:** Récence (R), Fréquence (F), Montant (M)
- **5 Segments:**
  - ⭐ **CHAMPION** → Client idéal (acheteur régulier, gros CA, actif)
  - 🔥 **FIDÈLE** → Client loyal avec bon potentiel
  - 📈 **PROMETTEUR** → Progression positive
  - 😴 **DORMANT** → Ancien client à réactiver
  - ❌ **PERDU** → Très inactif

**Stratégie:** 80% des profits viennent des 20% des clients (Champions + Fidèles)

---

### 4️⃣ **Priorisation des Produits Rentables** 🏆
- **Objectif:** Identifier les produits qui rapportent vraiment
- **Score combinant:**
  - Marge (40%)
  - Rotation de stock (30%)
  - Chiffre d'affaires généré (30%)
- **Grades (A+ → D):**
  - 🏆 **A+** → Pousser activement
  - ⭐ **A** → Maintenir
  - ✅ **B** → Évaluer
  - ⚠️ **C** → Surveiller
  - ❌ **D** → Arrêter

**Exemple:** Produit X (Marge 50%, Rotation 2x/mois, CA 200k) = Grade A+

---

## 💬 Utilisation du ChatBot

### Accès
1. Menu latéral → **Aide IA 💬**
2. Or: Route `/ai-assistant`

### Interface
- **Historique de conversation** avec scroll fluide
- **Thèmes rapides** pour les 4 axes principaux
- **Input intelligent** qui détecte automatiquement le sujet
- **Bouton "Effacer"** pour réinitialiser la conversation

### Base de Connaissances

Le chatbot couvre 6 thèmes principaux:

| Thème | Keywords | Description |
|-------|----------|-------------|
| **Prévision CA** | chiffre affaires, ca, prédiction, tendance | Prédire le CA à venir |
| **Ruptures Stock** | rupture, stock, alerte, réappro | Éviter les ruptures |
| **Segmentation Clients** | client, rfm, champion, dormant | Connaître la valeur réelle des clients |
| **Rentabilité Produits** | produit, rentabilité, marge, grade | Identifier les bons produits |
| **Fonctionnement IA** | comment, fonctionnement, algo | Comprendre la technologie |
| **Guide Utilisation** | aide, guide, tutoriel | How-to et bonnes pratiques |

### Exemples de Questions
✅ "Comment éviter les ruptures de stock?"
✅ "Quels sont mes meilleurs clients?"
✅ "Comment fonctionne NafixAI?"
✅ "Quel est le ROI?"
✅ "Pourquoi tel produit n'est pas rentable?"

---

## 🔧 Architecture Technique

### Structure des Fichiers
```
src/
├── components/
│   ├── NafixAIChat.js          # Composant principal du chatbot
│   └── NafixAIChat.css          # Styles du chatbot
├── pages/
│   ├── NafixAI.js               # Dashboard analyse IA
│   └── NafixAIAssistant.js       # Page wrapper du chatbot
└── utils/
    └── mlEngine.js              # Moteur d'analyse (utilité du chatbot)
```

### Composant NafixAIChat

**Features principales:**
1. **Base de Connaissances Structurée** (`KNOWLEDGE_BASE`)
   - 6 topics avec keywords, titre, description, réponse

2. **Détection Intelligente d'Intention**
   - Analyse le message utilisateur
   - Correspond aux keywords
   - Retourne le topic approprié

3. **Interface Conversationnelle**
   - Messages utilisateur/ assistant
   - Animation fluide des messages
   - Scroll auto vers le dernier message
   - Thèmes rapides accessibles

4. **Formattage Markdown**
   - Support de titres (`## ...`)
   - Bold (`**...** `)
   - Emojis et richesse visuelle

---

## 📊 Réponses du ChatBot

### Structure d'une Réponse
Chaque réponse inclut:
- **Titre descriptif** (avec emoji)
- **Qu'est-ce que c'est?** (Explication simple)
- **Comment ça marche?** (Technologie et calculs)
- **À quoi ça sert?** (Cas d'usage)
- **Exemple concret** (Application pratique)
- **Codes couleur ou grades** (Système de classification)
- **Stratégie** (Comment agir sur les données)

---

## 🎓 Apprentissage Utilisateur

Le chatbot aide à comprendre:
1. **Le POURQUOI** de chaque insight NafixAI
2. **Le COMMENT** de chaque calcul
3. **Le QUOI FAIRE** avec les données
4. **Le RETOUR SUR INVESTISSEMENT** attendu

---

## 🚀 Roadmap Futures Améliorations

- [ ] Intégration avec les données temps réel
- [ ] Recommandations personnalisées par rôle
- [ ] Chat contextuel (référence aux données actuelles)
- [ ] Export de conversations en PDF
- [ ] Multi-langue
- [ ] Système de ratings pour feedback

---

## 📞 Support

Pour toute question sur le chatbot ou NafixAI:
1. Consulter le chatbot (menu **Aide IA 💬**)
2. Contactez l'administrateur système
3. Vérifier la documentation des 4 axes

---

**Version:** 1.0  
**Dernière mise à jour:** Mars 2026  
**Développépar:** Équipe NafixAI
