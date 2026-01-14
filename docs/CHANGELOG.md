# Historique des versions - Planning de Repas

## v3.10.2-beta (2026-01-13)
### Nouvelle fonctionnalité : Bouton Accepter recette
- **Bouton "Accepter"** : Enregistrement de la recette via n8n
- **Notification stylée** : Popup vert avec animation qui apparaît en haut à droite
- **Feedback utilisateur** : Message "Recette enregistrée avec succès !" pendant 3 secondes
- **Gestion d'erreur** : Notification rouge en cas d'échec

### Modifications techniques
- **Backend** : Nouvelle route `/api/accept-recipe` qui appelle le webhook n8n
- **Frontend** :
  - Nouveau composant `notification-popup` avec animation CSS
  - Fonction `showNotification(message, type)` réutilisable
  - Bouton "Accepter" désactivé pendant l'enregistrement
  - Auto-rechargement de la liste des recettes après acceptation

### Améliorations preview
- **Affichage ingrédients** : Liste à puces formatée depuis JSON array
- **Affichage recette** : Liste numérotée des étapes
- **Valeurs nutritionnelles** : Grid 2 colonnes avec icônes (calories, protéines, glucides, lipides)
- **Design amélioré** : Sections bien séparées avec couleurs et spacing

### Déploiement requis
- ⚠️ **Backend doit être redéployé** avec le nouveau `server.js`
- Frontend déjà déployé sur GitHub Pages

---

## v3.10.1-beta (2026-01-13)
### Corrections et améliorations : Création de recettes
- **État de chargement** : Ajout d'un spinner animé pendant le traitement n8n
- **Fix CORS** : Appel au backend au lieu d'appeler n8n directement depuis le frontend
- **Affichage preview** : La prévisualisation n'apparaît que APRÈS réception de la réponse n8n
- **Sécurité** : URL du webhook n8n cachée côté frontend

### Modifications techniques
- **Backend** : Nouvelle route `/api/create-recipe` qui fait proxy vers n8n
- **Frontend** :
  - Ajout section `recipeLoading` avec spinner CSS animé
  - Modification du flux : Form → Loading → Preview (avec vraies données)
  - Gestion d'état améliorée (form/loading/preview)
- **config.js** : Suppression de l'URL n8n webhook (maintenant dans backend)

### Déploiement requis
- ⚠️ **Backend doit être redéployé** avec le nouveau `server.js`
- Frontend déjà déployé sur GitHub Pages

---

## v3.10.0-beta (2026-01-13)
### Nouvelle fonctionnalité : Création de recettes
- **Suppression du bot** : Le chat bot a été entièrement supprimé de l'interface
- **Liste de courses plein écran** : La liste de courses occupe maintenant toute la sidebar droite
- **Bouton "Créer recette"** : Nouveau bouton dans le header de la liste de courses
- **Popup de création** : Formulaire avec 4 champs (Titre, Description, Ingrédients, Recette)
- **Design cohérent** : Style pastel violet assorti au thème global

### Modifications techniques
- **HTML** : Suppression tabs et bot content, ajout popup création recette
- **CSS** : Nouveaux styles pour `.create-recipe-btn`, `.shopping-title`, `.create-recipe-popup`
- **JavaScript** :
  - Suppression `setupTabs()`, `chatForm` handler, `addChatMessage()`
  - Nouveaux event listeners pour la popup (ouvrir, fermer, soumettre)
  - Code v3.10 (lignes 2759-2799)
- **Note** : Intégration n8n à venir dans une prochaine version

---

## v3.9.6-beta (2026-01-13)
### Refonte complète liste de courses
- **Architecture clean restart** : Code entièrement réécrit pour la liste de courses
- **Sauvegarde Airtable par semaine** : Une liste de courses par semaine dans Airtable
- **Ajout/soustraction intelligente** :
  - Drag & drop → ajoute les ingrédients × servings
  - Changement servings (+/-) → ajoute/soustrait 1 portion
  - Suppression repas → soustrait les ingrédients, supprime si quantité = 0
- **Affichage JSON brut** : Liste affichée en JSON formaté pour debug

### Corrections importantes
- Fix synchronisation `planning` array en mémoire (ajout/suppression)
- Fix appels API manquants
- Suppression anciennes fonctions conflictuelles
- Logs de debug ajoutés pour traçabilité

### Technique
- Nouvelles fonctions v3.9 (lignes 2470-2729) :
  - `getOrCreateShoppingList(week, year)` : Récupère ou crée liste Airtable
  - `addIngredientsToShoppingList(recipe, servings)` : Ajoute et somme ingrédients
  - `updateShoppingListServings(recipe, oldServings, newServings)` : +/- 1 portion
  - `removeIngredientsFromShoppingList(recipe, servings)` : Soustrait et supprime si 0
  - `displayRawShoppingList(ingredients)` : Affiche JSON
- Planning array synchronisé après drag & drop et suppression
- Backend `.env` mis à jour avec nouveau workspace Airtable

### Infrastructure
- Migration vers nouveau workspace Airtable (limite API dépassée sur l'ancien)
- Base ID : `appJEGDcsnuU70vJM`
- Déploiement backend `/var/www/public_html/telegram-bot-api/`

---

## v3.8.2-beta (2026-01-07)
### Nouvelles fonctionnalités
- **Liste de courses auto-générée** : La liste se régénère automatiquement à chaque modification du planning
- **Génération instantanée** : Mise à jour immédiate après drag & drop, suppression, changement de portions ou navigation entre semaines
- **Architecture simplifiée** : Génération on-demand sans sauvegarde Airtable

### Améliorations
- Liste basée sur les portions réelles de chaque repas (depuis Airtable)
- Fusion automatique des ingrédients identiques
- Affichage par catégories (Fruits & Légumes, Viandes, etc.)
- Plus besoin de cliquer sur "Générer la liste"

### Technique
- Nouvelle fonction `generateShoppingListSimple()` (ligne 1313-1384)
- Appels automatiques après : drag & drop, suppression, changement servings, changement semaine
- Utilise `parseRecipeIngredients(recipe, servings)` avec portions par repas
- Suppression de l'ancienne architecture avec localStorage et Airtable saves

---

## v3.8.1-beta (2026-01-07)
### Corrections
- **Fix du cache popup** : Correction du bug où le popup affichait les portions globales au lieu des portions du repas
- Mise à jour de l'array `planning` en mémoire après sauvegarde dans Airtable
- Synchronisation parfaite entre Airtable et l'affichage

### Technique
- Modification de `setupPopupServingsControl()` pour mettre à jour `planningItem.servings` (ligne 618-622)
- Fix dans `handleDrop()` pour passer le bon objet `mealItem` à `showRecipePopup()`

---

## v3.8.0-beta (2026-01-07)
### Refonte
- **Désactivation temporaire de la liste de courses** : Mise en commentaire de toutes les fonctions liées
- Préparation pour reconstruction complète de l'architecture

### Technique
- Commenté : `initializeShoppingList()`, `addMealToShoppingList()`, `populateShoppingListFromPlanning()`
- Conservation de la table Airtable "Liste de Courses" pour usage ultérieur

---

## v3.7.0 (2026-01-07)
### Refonte majeure
- **Migration localStorage → Airtable pour les portions** : Les portions par repas sont maintenant stockées dans Airtable
- **Synchronisation cross-device** : Les portions sont accessibles depuis n'importe quel appareil
- **Isolation du defaultServings** : Changer la valeur par défaut n'affecte plus les repas déjà planifiés

### Backend
- `POST /api/planning` : Ajout du champ `servings` (défaut : 2)
- `GET /api/planning` : Retourne le champ `servings` depuis Airtable
- `PATCH /api/planning/:id` : Nouvel endpoint pour mettre à jour les portions d'un repas

### Frontend
- Modification de `handleDrop()` pour envoyer `defaultServings` à Airtable
- Modification de `displayPlanning()` pour lire `item.servings` depuis Airtable
- Modification de `showRecipePopup()` pour accepter un objet `mealItem`
- Modification de `setupPopupServingsControl()` pour PATCH vers Airtable
- Modification de `parseRecipeIngredients()` pour accepter `servings` en paramètre
- Suppression complète du code localStorage `mealServings`

### Technique
- Nouvelle colonne Airtable : "Nombre de personnes" dans "Plannings Hebdomadaires"
- Suppression des fonctions : `getMealServings()`, `setMealServings()`, `saveMealServings()`
- Source unique de vérité : Airtable

---

## v3.6.0 (2025-12-05)
### Nouvelles fonctionnalités
- **Gestion du nombre de personnes par repas** : Chaque repas planifié a maintenant son propre nombre de personnes
- **Popup recette repensée** : Nouvelle mise en page à 2 colonnes
  - Colonne gauche : Description, valeurs nutritionnelles (pour 1 personne), ingrédients (multipliés)
  - Colonne droite : Recette étape par étape + contrôle du nombre de personnes
- **Contrôle dans le popup** : Boutons +/- pour ajuster le nombre de personnes d'un repas spécifique
- **Mise à jour dynamique** : Les quantités d'ingrédients se mettent à jour en temps réel dans le popup
- **Affichage individuel** : Chaque repas affiche son propre nombre de personnes sur le planning

### Améliorations
- Stockage localStorage des portions par repas (clé = recordId Airtable)
- Les recettes sont maintenant définies pour 1 personne dans Airtable
- Initialisation automatique avec `defaultServings` lors du drag & drop
- Mise à jour visuelle immédiate du planning depuis le popup
- Nouvelle présentation des étapes de recette avec numérotation

### Technique
- Nouvelle variable globale `mealServings` (objet recordId -> servings)
- Fonctions helpers : `getMealServings()`, `setMealServings()`, `saveMealServings()`
- Fonction `showRecipePopup()` refaite avec support `recordId`
- Nouvelles fonctions : `setupPopupServingsControl()`, `updatePopupIngredients()`, `updateMealServingsDisplay()`
- Backend : Ajout champs `description` et `recipe` (étapes) dans l'API `/api/recipes`
- CSS : Layout 2 colonnes avec `.popup-two-columns`, styles pour `.popup-servings-control`

### Interface
- Popup élargie à 900px pour accueillir les 2 colonnes
- Design pastel cohérent pour le contrôle de portions dans le popup
- Bordure verticale entre les deux colonnes pour meilleure lisibilité

---

## v3.5.1 (2025-12-05)
### Corrections
- **Mise à jour automatique de la liste de courses** : La liste se régénère maintenant automatiquement lors de la suppression d'un repas
- **Mise à jour des quantités** : La liste de courses se met à jour automatiquement lors du changement du nombre de personnes
- Amélioration de la synchronisation entre le planning et la liste de courses

### Technique
- Ajout de `await populateShoppingListFromPlanning()` dans `deleteRecipeFromPlanning()`
- Modification des event listeners pour les contrôles de portions (async/await)
- Régénération automatique de la liste après changement de servings

---

## v3.5.0 (2025-12-05)
### Nouvelles fonctionnalités
- **Gestion du nombre de personnes** : Contrôle du nombre de portions (1-20 personnes)
- Interface de contrôle dans le header du planning avec boutons +/- et input manuel
- Affichage "👤 × N" sur chaque repas du planning
- Multiplication automatique des quantités d'ingrédients selon le nombre de personnes
- Sauvegarde de la préférence en localStorage (persistant entre les sessions)

### Améliorations
- Les recettes dans Airtable sont maintenant définies pour 1 personne
- Ajustement automatique des quantités lors de la génération de la liste de courses
- Design pastel cohérent pour le contrôle de portions
- Interface intuitive avec feedback visuel immédiat

### Technique
- Nouvelle variable globale `defaultServings` (défaut: 2 personnes)
- Quantités multipliées dans `parseRecipeIngredients()`
- Nouvelle section `.header-controls` dans le planning-header
- CSS pour `.servings-control` et `.servings-indicator`
- Sauvegarde/chargement depuis localStorage

---

## v3.4.0 (2025-12-04)
### Nouvelles fonctionnalités
- Refonte complète du thème visuel en couleurs pastel douces
- Nouvelle palette de couleurs harmonieuse : violet, rose, bleu, vert, jaune et rouge pastel
- Fond d'application lavande très clair (#fdf4ff)
- Dégradés subtils sur les boutons et en-têtes pour un aspect moderne et doux

### Améliorations
- Augmentation des border-radius pour des coins plus arrondis (8px → 12-16px)
- Ajout de transitions et animations sur hover pour une meilleure interactivité
- Ombres portées douces avec couleurs pastel pour plus de profondeur
- Amélioration de la lisibilité avec des contrastes optimisés
- Indicateurs visuels améliorés (included/excluded avec couleurs pastel)
- Version info avec fond semi-transparent et couleur pastel

### Détails techniques
- Couleur primaire : #c4b5fd (violet pastel)
- Couleur primaire hover : #a78bfa
- Fond général : #fdf4ff (lavande très clair)
- Bordures : #e9d5ff (lavande clair)
- Vert inclus : #bbf7d0
- Rouge exclu : #fecaca
- Jaune autre semaine : #fef3c7
- Dégradés linéaires pour boutons principaux
- Box shadows avec rgba des couleurs pastel

---

## v3.3.2 (2025-12-04)
### Améliorations
- Affichage du nom complet de la liste (avec "- Modifié" si applicable) dans l'historique des listes précédentes
- Affichage du nom de la liste actuelle comme titre dans la section "Liste de courses"
- Amélioration de la cohérence visuelle : le statut "Modifié" est maintenant visible partout

### Technique
- Modification de `displayShoppingHistory()` pour utiliser le nom complet depuis Airtable
- Modification de `displayShoppingListFromAirtable()` pour afficher le nom comme titre

---

## v3.3.1 (2025-12-04)
### Nouvelles fonctionnalités
- Modification automatique du nom de la liste dans Airtable lors de personnalisations
- Ajout du suffixe "- Modifié" au nom de la liste dans Airtable quand elle est personnalisée
- Restauration du nom original lors de la réinitialisation

### Technique
- Modification de `updateShoppingListInAirtable()` pour accepter un paramètre `name` optionnel
- Mise à jour du backend `server.js` pour supporter le champ `nom` dans l'endpoint PATCH
- Modification de `applySettingsAndSave()` pour mettre à jour le nom avec "- Modifié"
- Modification de `resetShoppingListToDefault()` pour restaurer le nom original

---

## v3.3.0 (2025-12-04)
### Nouvelles fonctionnalités
- Système de couleurs simplifié : vert (inclus) et rouge (exclu) uniquement
- Support des repas multi-semaines : possibilité d'ajouter des repas d'autres semaines à la liste actuelle
- Indicateur "Modifié" dans le titre de la popup quand la liste est personnalisée
- Bouton "Réinitialiser" pour restaurer l'état par défaut

### Améliorations
- Navigation entre semaines dans la popup Paramètres avec suivi des modifications
- Boutons "Tout inclure" / "Tout exclure" pour sélection rapide
- Meilleure gestion de l'état modifié avec flag `isListModified`

### Technique
- Ajout de la variable globale `isListModified` pour tracker les modifications
- Nouvelle fonction `resetShoppingListToDefault()` pour réinitialisation
- Modification de `displaySettingsCalendar()` avec système de couleurs simplifié
- Amélioration de `updateEditableListPreview()` pour supporter les repas cross-semaines via parsing de `globalKey`
- Ajout du bouton Reset dans le HTML et le CSS

### Corrections
- Fix du bug empêchant l'affichage des repas d'autres semaines dans la liste éditable
- Fix du bug de navigation entre semaines qui appliquait les modifications à la mauvaise liste

---

## v3.2.0 (2025-12-04)
### Nouvelles fonctionnalités
- Réactivation de la popup Paramètres (bouton ⚙️)
- Édition complète des listes de courses directement depuis Airtable
- Modification des quantités et unités des ingrédients
- Toggle inclusion/exclusion des repas avec code couleur

### Technique
- Architecture 100% Airtable-centric (plus de cache localStorage)
- Nouvelle fonction `initializeSettingsPopup()` pour charger depuis Airtable
- Nouvelle fonction `displayEditableShoppingListFromAirtable()`
- Modification de `applySettingsAndSave()` pour sauvegarder directement dans Airtable
- Nouvelle fonction `loadMealInclusionsFromAirtable()`

---

## v3.1.0 (2025-12-03)
### Nouvelles fonctionnalités
- Historique des listes de courses sauvegardé dans Airtable
- Consultation des listes précédentes via popup dédiée
- Statut des listes : Active / Archivée
- Bouton "Vider la liste" pour archiver la liste actuelle

### Architecture
- Passage à une architecture Airtable-centric pour les listes de courses
- Nouvelle table Airtable "Liste de Courses" avec champs :
  - Nom, Semaine, Année
  - Ingrédients JSON, Repas Inclus JSON
  - Statut, Nb Items, Notes
  - Date Création, Date Modification

### Endpoints Backend
- `GET /api/shopping-lists` - Récupérer toutes les listes
- `GET /api/shopping-list/:id` - Récupérer une liste spécifique
- `POST /api/shopping-list` - Créer une nouvelle liste
- `PATCH /api/shopping-list/:id` - Mettre à jour une liste
- `DELETE /api/shopping-list/:id` - Supprimer une liste

### Technique
- Nouvelle fonction `fetchShoppingListsFromAirtable()` pour charger l'historique
- Nouvelle fonction `createShoppingListInAirtable()` pour créer des listes
- Nouvelle fonction `displayShoppingHistory()` pour afficher l'historique
- Popup dédiée pour visualiser les listes archivées

---

## v3.0.0 (2025-12-03)
### Refonte majeure
- Migration complète vers architecture Airtable-centric
- Suppression de la dépendance au cache localStorage
- Toutes les données maintenant stockées et synchronisées via Airtable

### Améliorations
- Performance améliorée grâce à la source unique de vérité
- Synchronisation automatique entre devices
- Meilleure fiabilité des données

---

## v2.2.0 (2025-12-02)
### Nouvelles fonctionnalités
- Génération de liste de courses depuis les repas planifiés
- Parsing intelligent des ingrédients depuis le format texte des recettes
- Extraction automatique de quantité, unité et nom d'ingrédient
- Agrégation des ingrédients identiques
- Catégorisation automatique par type (Fruits & Légumes, Viandes, etc.)
- Affichage formaté de la liste par catégories

### Technique
- Nouvelle fonction `parseRecipeIngredients()` pour extraire les ingrédients
- Nouvelle fonction `mergeIngredients()` pour agréger et dédupliquer
- Nouvelle fonction `categorizeIngredient()` pour classifier automatiquement
- Nouvelle fonction `displayShoppingList()` pour affichage structuré

---

## v2.1.0 (2025-12-01)
### Nouvelles fonctionnalités
- Bouton "Générer la liste" pour créer la liste de courses
- Affichage de la liste simplifiée des repas planifiés
- Format : Jour - Moment : Nom de la recette
- Interface dédiée dans l'onglet "Liste de courses"

### Améliorations
- Version centrée en bas de page
- Meilleure organisation visuelle de l'interface

---

## v2.0.0 (2025-11-30)
### Refonte majeure de l'interface
- Nouvelle organisation en 3 colonnes :
  - Sidebar gauche : Liste des recettes
  - Centre : Planning de la semaine
  - Sidebar droite : Bot + Liste de courses

### Nouvelles fonctionnalités
- Système d'onglets dans la sidebar droite
- Onglet "Bot" : Chat avec l'assistant
- Onglet "Liste de courses" : Gestion des courses
- Boutons Précédent/Suivant pour navigation hebdomadaire
- Affichage de la semaine actuelle (numéro + année)

### Améliorations
- Interface plus spacieuse et organisée
- Meilleure séparation des fonctionnalités
- Navigation facilitée entre les semaines

---

## v1.5.0 (2025-11-29)
### Nouvelles fonctionnalités
- Sidebar recettes masquable avec bouton ◀/▶
- Bouton de rafraîchissement pour recharger les recettes
- Recherche en temps réel dans les recettes
- Meilleure utilisation de l'espace écran

### Améliorations
- Interface plus épurée
- Performance de recherche améliorée
- Transitions fluides pour masquer/afficher la sidebar

---

## v1.4.0 (2025-11-28)
### Nouvelles fonctionnalités
- Popup de détails pour chaque recette
- Affichage des ingrédients, macros nutritionnelles et tags
- Icônes ❌ pour supprimer un repas du planning
- Confirmation avant suppression

### Améliorations
- Meilleure visualisation des informations recettes
- Interface de suppression plus intuitive

---

## v1.3.0 (2025-11-27)
### Nouvelles fonctionnalités
- Chat avec le bot via n8n webhook
- Envoi de messages et réception de réponses
- Interface de chat intégrée à la sidebar

### Technique
- Endpoint backend `/api/send-message`
- Intégration webhook n8n
- Timeout configuré à 30 secondes

---

## v1.2.0 (2025-11-26)
### Nouvelles fonctionnalités
- Suppression de repas du planning
- Mise à jour automatique de l'affichage après suppression

### Technique
- Endpoint backend `DELETE /api/planning/:id`
- Fonction `removeMeal()` dans le frontend
- Gestion des erreurs améliorée

---

## v1.1.0 (2025-11-25)
### Nouvelles fonctionnalités
- Ajout de recettes au planning par drag & drop
- Assignation aux créneaux : Petit-déjeuner, Déjeuner, Dîner
- Affichage des recettes assignées avec leur nom

### Technique
- API HTML5 Drag and Drop
- Endpoint backend `POST /api/planning`
- Stockage dans Airtable "Plannings Hebdomadaires"

---

## v1.0.0 (2025-11-24)
### Version initiale
- Affichage du planning hebdomadaire (7 jours × 3 repas)
- Liste des recettes depuis Airtable
- Affichage des macros nutritionnelles (calories, protéines, glucides, lipides)
- Architecture frontend (GitHub Pages) + backend (Hostinger)

### Endpoints initiaux
- `GET /api/recipes` - Récupérer les recettes
- `GET /api/planning` - Récupérer le planning
- `GET /health` - Health check

### Stack technique
- Frontend : HTML, CSS, JavaScript vanilla
- Backend : Node.js, Express.js
- Base de données : Airtable
- Hébergement : GitHub Pages + Hostinger + Cloudflare Tunnel
- Process manager : PM2
