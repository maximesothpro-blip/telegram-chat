// Planning de Repas - Version_1
// Configuration
const API_URL = window.BACKEND_API_URL || 'http://localhost:3000';

// État global
let recipes = [];
let planning = [];
let allWeeksPlanning = {}; // Store planning for all weeks { 'week-year': [...] }
let shoppingList = [];
let currentWeek = getCurrentWeek();
let currentYear = new Date().getFullYear();
let settingsWeek = currentWeek; // Week currently displayed in settings popup
let settingsYear = currentYear;
let mealInclusions = {}; // Track which meals are included (green) or excluded (red)

// Shopping list management
let currentShoppingListId = null; // Airtable record ID of current list
let autoSaveTimer = null; // Timer for auto-save debounce
let isSaving = false; // Track save status
let isListModified = false; // Track if shopping list has been modified (v3.3)

// Recipe creation management (v3.10.2)
let currentRecipeData = null; // Store recipe data from n8n for Accept button

// Servings management (v3.7 - Moved to Airtable)
let defaultServings = parseInt(localStorage.getItem('defaultServings')) || 2; // Default number of servings

// Éléments DOM
const recipesList = document.getElementById('recipesList');
const calendar = document.getElementById('calendar');
const sidebar = document.getElementById('sidebar');
const toggleSidebar = document.getElementById('toggleSidebar');
const showSidebar = document.getElementById('showSidebar');
// const refreshRecipes = document.getElementById('refreshRecipes'); // v3.11: Removed
const recipePopup = document.getElementById('recipePopup');
const closePopup = document.getElementById('closePopup');
const createRecipeBtn = document.getElementById('createRecipeBtn');
const createRecipePopup = document.getElementById('createRecipePopup');
const closeCreateRecipePopup = document.getElementById('closeCreateRecipePopup');
const createRecipeForm = document.getElementById('createRecipeForm');
const recipeLoading = document.getElementById('recipeLoading');
const recipePreview = document.getElementById('recipePreview');
const recipePreviewContent = document.getElementById('recipePreviewContent');
const recipeModifyBtn = document.getElementById('recipeModifyBtn');
const recipeAcceptBtn = document.getElementById('recipeAcceptBtn');
const modifyRecipePopup = document.getElementById('modifyRecipePopup');
const closeModifyRecipePopup = document.getElementById('closeModifyRecipePopup');
const modifyRecipeForm = document.getElementById('modifyRecipeForm');
const modifyLoading = document.getElementById('modifyLoading');
const notificationPopup = document.getElementById('notificationPopup');
const notificationMessage = document.getElementById('notificationMessage');
const prevWeek = document.getElementById('prevWeek');
const nextWeek = document.getElementById('nextWeek');
const weekDisplay = document.getElementById('weekDisplay');
const searchRecipes = document.getElementById('searchRecipes');
// v3.10: generateListBtn and exportListBtn removed (no longer in HTML)
// const generateListBtn = document.getElementById('generateList');
// const exportListBtn = document.getElementById('exportList');
// v3.11: clearListBtn and settingsBtn removed (no longer needed)
// const clearListBtn = document.getElementById('clearList');
const shoppingContent = document.getElementById('shoppingContent');
// const settingsBtn = document.getElementById('settingsBtn');
const shoppingSettingsPopup = document.getElementById('shoppingSettingsPopup');
const closeSettingsPopup = document.getElementById('closeSettingsPopup');
const settingsCalendar = document.getElementById('settingsCalendar');
const settingsListContent = document.getElementById('settingsListContent');
const settingsWeekDisplay = document.getElementById('settingsWeekDisplay');
const settingsPrevWeek = document.getElementById('settingsPrevWeek');
const settingsNextWeek = document.getElementById('settingsNextWeek');
const settingsSelectAll = document.getElementById('settingsSelectAll');
const settingsSelectNone = document.getElementById('settingsSelectNone');
const applySettings = document.getElementById('applySettings');
const resetSettings = document.getElementById('resetSettings');

// Jours de la semaine
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MEALS = ['Déjeuner', 'Dîner'];

// ===== INITIALISATION =====
async function init() {
    updateWeekDisplay();
    await loadRecipes();
    await loadPlanning();
    createCalendar();
    displayPlanning();
    // v3.8: Shopping list disabled for rebuild
    // await initializeShoppingList();
    // initializeMealInclusions();
    // v3.9: Load shopping list on startup
    await loadShoppingListOnStartup();
    setupEventListeners();
}

// ===== HELPER: Get Monday and Sunday from week number =====
function getWeekDates(week, year) {
    // Get first day of the year
    const firstDayOfYear = new Date(year, 0, 1);

    // Calculate days to Monday of week 1
    const daysToMonday = (1 - firstDayOfYear.getDay() + 7) % 7;
    const firstMonday = new Date(year, 0, 1 + daysToMonday);

    // Calculate Monday of target week
    const monday = new Date(firstMonday);
    monday.setDate(firstMonday.getDate() + (week - 1) * 7);

    // Calculate Sunday (6 days after Monday)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return { monday, sunday };
}

// ===== METTRE À JOUR L'AFFICHAGE DE LA SEMAINE =====
function updateWeekDisplay() {
    const { monday, sunday } = getWeekDates(currentWeek, currentYear);

    const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

    const mondayDay = monday.getDate();
    const sundayDay = sunday.getDate();
    const mondayMonth = months[monday.getMonth()];
    const sundayMonth = months[sunday.getMonth()];

    // Format: "Lundi 7 au dimanche 13 mars" or "Lundi 28 février au dimanche 6 mars" (cross-month)
    if (monday.getMonth() === sunday.getMonth()) {
        weekDisplay.textContent = `Lundi ${mondayDay} au dimanche ${sundayDay} ${mondayMonth}`;
    } else {
        weekDisplay.textContent = `Lundi ${mondayDay} ${mondayMonth} au dimanche ${sundayDay} ${sundayMonth}`;
    }
}

// ===== CHARGER LES RECETTES =====
async function loadRecipes() {
    try {
        const response = await fetch(`${API_URL}/api/recipes`);
        const data = await response.json();

        if (data.success) {
            recipes = data.recipes;
            displayRecipes();
        }
    } catch (error) {
        console.error('Error loading recipes:', error);
        recipesList.innerHTML = '<div class="loading">Erreur de chargement</div>';
    }
}

// ===== CHARGER LE PLANNING =====
async function loadPlanning() {
    try {
        const response = await fetch(`${API_URL}/api/planning?week=${currentWeek}&year=${currentYear}`);
        const data = await response.json();

        if (data.success) {
            planning = data.planning;
            allWeeksPlanning[`${currentWeek}-${currentYear}`] = data.planning;
            console.log(`Loaded ${planning.length} planned meals for week ${currentWeek}`);
        }
    } catch (error) {
        console.error('Error loading planning:', error);
    }
}

// Load planning for a specific week
async function loadPlanningForWeek(week, year) {
    const key = `${week}-${year}`;

    // Return from cache if already loaded
    if (allWeeksPlanning[key]) {
        return allWeeksPlanning[key];
    }

    try {
        const response = await fetch(`${API_URL}/api/planning?week=${week}&year=${year}`);
        const data = await response.json();

        if (data.success) {
            allWeeksPlanning[key] = data.planning;
            console.log(`Loaded ${data.planning.length} planned meals for week ${week}-${year}`);
            return data.planning;
        }
    } catch (error) {
        console.error('Error loading planning:', error);
    }

    return [];
}

// ===== METTRE À JOUR LE RÉSUMÉ NUTRITIONNEL D'UN JOUR =====
function updateDaySummary(day) {
    const daySummary = document.querySelector(`.day-summary[data-day="${day}"]`);
    if (!daySummary) return;

    // Trouver toutes les recettes de ce jour
    const daySlots = document.querySelectorAll(`[data-day="${day}"]`);
    let totalCalories = 0;
    let totalProteins = 0;
    let totalCarbs = 0;
    let totalFats = 0;

    daySlots.forEach(slot => {
        if (slot.classList.contains('meal-slot')) {
            const plannedRecipe = slot.querySelector('.planned-recipe');
            if (plannedRecipe) {
                const recipeId = plannedRecipe.dataset.recipeId;
                const recipe = recipes.find(r => r.id === recipeId);
                if (recipe) {
                    totalCalories += recipe.calories || 0;
                    totalProteins += recipe.proteins || 0;
                    totalCarbs += recipe.carbs || 0;
                    totalFats += recipe.fats || 0;
                }
            }
        }
    });

    // Mettre à jour l'affichage
    daySummary.querySelector('.calories-total').textContent = Math.round(totalCalories);
    daySummary.querySelector('.protein-total').textContent = Math.round(totalProteins);

    // Stocker les totaux pour le popup
    daySummary.dataset.calories = totalCalories;
    daySummary.dataset.proteins = totalProteins;
    daySummary.dataset.carbs = totalCarbs;
    daySummary.dataset.fats = totalFats;
}

// ===== AFFICHER LE POPUP DE RÉSUMÉ DU JOUR =====
function showDaySummaryPopup(day) {
    const daySummary = document.querySelector(`.day-summary[data-day="${day}"]`);
    if (!daySummary) return;

    const calories = Math.round(parseFloat(daySummary.dataset.calories) || 0);
    const proteins = Math.round(parseFloat(daySummary.dataset.proteins) || 0);
    const carbs = Math.round(parseFloat(daySummary.dataset.carbs) || 0);
    const fats = Math.round(parseFloat(daySummary.dataset.fats) || 0);

    const popupTitle = document.getElementById('popupTitle');
    const popupBody = document.getElementById('popupBody');

    popupTitle.textContent = `Résumé nutritionnel - ${day}`;

    popupBody.innerHTML = `
        <div class="popup-section">
            <strong>Totaux de la journée :</strong>
            <ul>
                <li>🔥 Calories : ${calories} kcal</li>
                <li>💪 Protéines : ${proteins}g</li>
                <li>🍞 Glucides : ${carbs}g</li>
                <li>🥑 Lipides : ${fats}g</li>
            </ul>
        </div>
    `;

    recipePopup.classList.add('active');
}

// ===== AFFICHER LE PLANNING =====
function displayPlanning() {
    planning.forEach(item => {
        // Trouver le slot correspondant dans le calendrier
        const slot = document.querySelector(`[data-day="${item.day}"][data-meal="${item.meal}"]`);
        if (!slot) return;

        // Trouver le nom de la recette
        let recipeName = 'Recette inconnue';
        let recipeData = null;

        if (item.recipe && item.recipe.length > 0) {
            const recipeId = item.recipe[0];
            recipeData = recipes.find(r => r.id === recipeId);
            if (recipeData) {
                recipeName = recipeData.name;
            }
        }

        // Afficher la recette dans le slot
        const mealContent = slot.querySelector('.meal-content');

        // v3.7: Get servings from Airtable (item.servings)
        const mealServingsCount = item.servings || defaultServings;

        mealContent.innerHTML = `
            <div class="planned-recipe" data-record-id="${item.id}" data-recipe-id="${item.recipe[0] || ''}">
                <span class="recipe-name-text">${recipeName} <span class="servings-indicator">👤 × ${mealServingsCount}</span></span>
                <button class="delete-recipe-btn" data-record-id="${item.id}">×</button>
            </div>
        `;

        // Ajouter l'event listener pour la suppression
        const deleteBtn = mealContent.querySelector('.delete-recipe-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteRecipeFromPlanning(item.id, slot);
        });

        // Ajouter l'event listener pour afficher le popup
        const plannedRecipeDiv = mealContent.querySelector('.planned-recipe');
        plannedRecipeDiv.addEventListener('click', () => {
            if (recipeData) {
                // v3.7: Pass item (with servings from Airtable) to popup
                showRecipePopup(recipeData, item);
            }
        });
    });

    // Mettre à jour tous les résumés nutritionnels
    DAYS.forEach(day => updateDaySummary(day));
}

// ===== AFFICHER LES RECETTES =====
function displayRecipes() {
    recipesList.innerHTML = '';

    recipes.forEach(recipe => {
        const recipeEl = document.createElement('div');
        recipeEl.className = 'recipe-item';
        recipeEl.draggable = true;
        recipeEl.dataset.recipeId = recipe.id;
        recipeEl.dataset.recipeName = recipe.name;

        recipeEl.innerHTML = `
            <div class="recipe-name">${recipe.name}</div>
            <div class="recipe-tags">${recipe.tags.join(', ') || 'Sans tag'}</div>
        `;

        // Click pour voir détails
        recipeEl.addEventListener('click', () => showRecipePopup(recipe));

        // Drag events
        recipeEl.addEventListener('dragstart', handleDragStart);
        recipeEl.addEventListener('dragend', handleDragEnd);

        recipesList.appendChild(recipeEl);
    });
}

// ===== CRÉER LE CALENDRIER =====
function createCalendar() {
    calendar.innerHTML = '';

    DAYS.forEach((day, index) => {
        const dayColumn = document.createElement('div');
        dayColumn.className = 'day-column';

        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.textContent = day;
        dayColumn.appendChild(dayHeader);

        MEALS.forEach(meal => {
            const mealSlot = document.createElement('div');
            mealSlot.className = 'meal-slot';
            mealSlot.dataset.day = day;
            mealSlot.dataset.meal = meal;

            mealSlot.innerHTML = `
                <div class="meal-label">${meal}</div>
                <div class="meal-content">
                    <div class="empty-slot">Glissez une recette ici</div>
                </div>
            `;

            // Drop events
            mealSlot.addEventListener('dragover', handleDragOver);
            mealSlot.addEventListener('dragleave', handleDragLeave);
            mealSlot.addEventListener('drop', handleDrop);

            dayColumn.appendChild(mealSlot);
        });

        // Ajouter le résumé nutritionnel du jour
        const daySummary = document.createElement('div');
        daySummary.className = 'day-summary';
        daySummary.dataset.day = day;
        daySummary.innerHTML = `
            <div class="summary-content">
                <div class="summary-line">🔥 <span class="calories-total">0</span> kcal</div>
                <div class="summary-line">💪 <span class="protein-total">0</span>g prot</div>
            </div>
        `;
        daySummary.addEventListener('click', () => showDaySummaryPopup(day));
        dayColumn.appendChild(daySummary);

        calendar.appendChild(dayColumn);
    });
}

// ===== DRAG & DROP =====
function handleDragStart(e) {
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('recipeId', e.target.dataset.recipeId);
    e.dataTransfer.setData('recipeName', e.target.dataset.recipeName);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    const slot = e.target.closest('.meal-slot');
    if (slot) {
        slot.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const slot = e.target.closest('.meal-slot');
    if (slot) {
        slot.classList.remove('drag-over');
    }
}

async function handleDrop(e) {
    e.preventDefault();

    const slot = e.target.closest('.meal-slot');
    if (!slot) return;

    slot.classList.remove('drag-over');

    const recipeId = e.dataTransfer.getData('recipeId');
    const recipeName = e.dataTransfer.getData('recipeName');
    const day = slot.dataset.day;
    const meal = slot.dataset.meal;

    // Afficher immédiatement dans l'UI (sans bouton delete pour l'instant, on attend la réponse)
    const mealContent = slot.querySelector('.meal-content');
    mealContent.innerHTML = `<div class="planned-recipe">${recipeName}</div>`;

    // Sauvegarder dans Airtable
    try {
        const date = getDateForDay(day);

        const response = await fetch(`${API_URL}/api/planning`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                day: day,
                date: date,
                meal: meal,
                recipeId: recipeId,
                week: currentWeek,
                year: currentYear,
                servings: defaultServings // v3.7: Send default servings to Airtable
            })
        });

        const data = await response.json();

        if (data.success && data.record) {
            // Mettre à jour avec le bouton delete
            const recordId = data.record.id;

            mealContent.innerHTML = `
                <div class="planned-recipe" data-record-id="${recordId}" data-recipe-id="${recipeId}">
                    <span class="recipe-name-text">${recipeName} <span class="servings-indicator">👤 × ${defaultServings}</span></span>
                    <button class="delete-recipe-btn" data-record-id="${recordId}">×</button>
                </div>
            `;

            // Ajouter l'event listener pour la suppression
            const deleteBtn = mealContent.querySelector('.delete-recipe-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteRecipeFromPlanning(recordId, slot);
            });

            // Ajouter l'event listener pour afficher le popup
            const plannedRecipeDiv = mealContent.querySelector('.planned-recipe');
            plannedRecipeDiv.addEventListener('click', () => {
                const recipe = recipes.find(r => r.id === recipeId);
                if (recipe) {
                    // v3.7: Pass meal item with servings from response
                    const mealItem = {
                        id: recordId,
                        servings: defaultServings // Just dropped, use default
                    };
                    showRecipePopup(recipe, mealItem);
                }
            });

            // v3.9: Add to planning array in memory
            planning.push({
                id: recordId,
                day: day,
                date: date,
                meal: meal,
                recipe: [recipeId],
                servings: defaultServings,
                status: 'Planifié'
            });
            console.log('✅ Added to planning array:', planning.length, 'meals');

            // Mettre à jour le résumé nutritionnel du jour
            updateDaySummary(day);

            // v3.8.2: Add ingredients to shopping list
            const recipe = recipes.find(r => r.id === recipeId);
            if (recipe) {
                addIngredientsToShoppingList(recipe, defaultServings);
            }
        } else {
            console.error('Failed to save to Airtable');
        }
    } catch (error) {
        console.error('Error saving to Airtable:', error);
    }
}

// ===== SUPPRIMER UNE RECETTE DU PLANNING =====
async function deleteRecipeFromPlanning(recordId, slot) {
    if (!confirm('Supprimer cette recette du planning ?')) {
        return;
    }

    try {
        // v3.9: Get meal info BEFORE deleting for shopping list update
        const planningItem = planning.find(item => item.id === recordId);
        console.log('🔍 Planning item found:', planningItem);
        let recipeToRemove = null;
        let servingsToRemove = defaultServings;

        if (planningItem && planningItem.recipe && planningItem.recipe.length > 0) {
            const recipeId = planningItem.recipe[0];
            recipeToRemove = recipes.find(r => r.id === recipeId);
            servingsToRemove = planningItem.servings || defaultServings;
            console.log('🔍 Recipe to remove:', recipeToRemove?.name, 'servings:', servingsToRemove);
        } else {
            console.log('❌ No planning item or recipe found!');
        }

        const response = await fetch(`${API_URL}/api/planning/${recordId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            // Vider le slot
            const mealContent = slot.querySelector('.meal-content');
            mealContent.innerHTML = '<div class="empty-slot">Glissez une recette ici</div>';

            // Mettre à jour le résumé nutritionnel du jour
            const day = slot.dataset.day;
            updateDaySummary(day);

            // v3.9: Remove from planning array in memory
            const index = planning.findIndex(item => item.id === recordId);
            if (index > -1) {
                planning.splice(index, 1);
                console.log('✅ Removed from planning array:', planning.length, 'meals remaining');
            }

            // v3.9: Remove ingredients from shopping list
            if (recipeToRemove) {
                await removeIngredientsFromShoppingList(recipeToRemove, servingsToRemove);
            }

            console.log('Recipe deleted successfully');
        } else {
            alert('Erreur lors de la suppression');
        }
    } catch (error) {
        console.error('Error deleting recipe:', error);
        alert('Erreur lors de la suppression');
    }
}

// ===== POPUP RECETTE (v3.7 - Airtable servings) =====
function showRecipePopup(recipe, mealItem = null) {
    const popupTitle = document.getElementById('popupTitle');
    const popupBody = document.getElementById('popupBody');

    // v3.7: Get servings from mealItem (Airtable) or use default
    const currentServings = mealItem ? (mealItem.servings || defaultServings) : defaultServings;
    const recordId = mealItem ? mealItem.id : null;

    popupTitle.textContent = recipe.name;

    // Parse ingredients
    let ingredientsList = [];
    try {
        ingredientsList = typeof recipe.ingredients === 'string'
            ? JSON.parse(recipe.ingredients)
            : recipe.ingredients;
    } catch (e) {
        console.warn('Could not parse ingredients:', e);
        ingredientsList = [];
    }

    // Format ingredients with quantities multiplied by servings
    const ingredientsHTML = ingredientsList.map(item => {
        const name = item.ingredient || item.nom || 'Ingrédient inconnu';
        const baseQuantity = parseFloat(item.quantite) || 0;
        const adjustedQuantity = baseQuantity * currentServings;
        const unit = item.unite || '';

        return `<li>${adjustedQuantity}${unit} ${name}</li>`;
    }).join('');

    // Parse recipe steps
    let recipeSteps = [];
    try {
        recipeSteps = typeof recipe.recipe === 'string'
            ? JSON.parse(recipe.recipe)
            : (recipe.recipe || []);
    } catch (e) {
        console.warn('Could not parse recipe steps:', e);
        recipeSteps = [];
    }

    // Format recipe steps
    const recipeStepsHTML = recipeSteps.map((step, index) =>
        `<li><strong>Étape ${index + 1}:</strong> ${step}</li>`
    ).join('');

    // Two-column layout
    popupBody.innerHTML = `
        <div class="popup-two-columns" data-record-id="${recordId || ''}">
            <!-- Left column: Info -->
            <div class="popup-left-column">
                <div class="popup-section">
                    <strong>Description:</strong>
                    <p>${recipe.description || 'Pas de description disponible'}</p>
                </div>

                <div class="popup-section">
                    <strong>Valeurs nutritionnelles (pour 1 personne):</strong>
                    <ul>
                        <li>🔥 Calories: ${recipe.calories} kcal</li>
                        <li>💪 Protéines: ${recipe.proteins}g</li>
                        <li>🍞 Glucides: ${recipe.carbs}g</li>
                        <li>🥑 Lipides: ${recipe.fats}g</li>
                    </ul>
                </div>

                <div class="popup-section">
                    <strong>Ingrédients (pour ${currentServings} personne${currentServings > 1 ? 's' : ''}):</strong>
                    <ul id="ingredientsList">
                        ${ingredientsHTML || '<li>Aucun ingrédient</li>'}
                    </ul>
                </div>
            </div>

            <!-- Right column: Recipe + Servings control -->
            <div class="popup-right-column">
                ${recordId ? `
                <div class="popup-servings-control">
                    <label>👤 Nombre de personnes:</label>
                    <div class="servings-control-inline">
                        <button class="popup-servings-btn" id="popupDecreaseServings">−</button>
                        <input type="number" id="popupServingsInput" min="1" max="20" value="${currentServings}" />
                        <button class="popup-servings-btn" id="popupIncreaseServings">+</button>
                    </div>
                </div>
                ` : ''}

                <div class="popup-section">
                    <strong>Recette étape par étape:</strong>
                    <ol class="recipe-steps">
                        ${recipeStepsHTML || '<li>Pas d\'étapes disponibles</li>'}
                    </ol>
                </div>
            </div>
        </div>
    `;

    recipePopup.classList.add('active');

    // Add event listeners for servings control (only if recordId exists)
    if (recordId) {
        setupPopupServingsControl(recipe, recordId);
    }
}

// Setup servings control in popup
function setupPopupServingsControl(recipe, recordId) {
    const decreaseBtn = document.getElementById('popupDecreaseServings');
    const increaseBtn = document.getElementById('popupIncreaseServings');
    const servingsInput = document.getElementById('popupServingsInput');

    if (!decreaseBtn || !increaseBtn || !servingsInput) return;

    const updatePopupServings = async (newServings) => {
        // v3.7: Save to Airtable instead of localStorage
        try {
            // Get old servings before updating
            const oldServings = parseInt(servingsInput.value);

            const response = await fetch(`${API_URL}/api/planning/${recordId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    servings: newServings
                })
            });

            const data = await response.json();

            if (data.success) {
                servingsInput.value = newServings;

                // v3.8: Update planning array in memory (so popup shows correct value on reopen)
                const planningItem = planning.find(item => item.id === recordId);
                if (planningItem) {
                    planningItem.servings = newServings;
                }

                // Update ingredients display
                updatePopupIngredients(recipe, newServings);

                // Update planning display to show new servings
                updateMealServingsDisplay(recordId, newServings);

                // v3.9: Update shopping list (add/subtract 1 portion)
                await updateShoppingListServings(recipe, oldServings, newServings);

                console.log(`✅ Servings updated to ${newServings} in Airtable and local cache`);
            } else {
                console.error('Failed to update servings:', data);
            }
        } catch (error) {
            console.error('Error updating servings:', error);
        }
    };

    decreaseBtn.addEventListener('click', () => {
        let current = parseInt(servingsInput.value);
        if (current > 1) {
            updatePopupServings(current - 1);
        }
    });

    increaseBtn.addEventListener('click', () => {
        let current = parseInt(servingsInput.value);
        if (current < 20) {
            updatePopupServings(current + 1);
        }
    });

    servingsInput.addEventListener('change', () => {
        let value = parseInt(servingsInput.value);
        if (isNaN(value) || value < 1) value = 1;
        if (value > 20) value = 20;
        updatePopupServings(value);
    });
}

// Update ingredients quantities in popup
function updatePopupIngredients(recipe, servings) {
    const ingredientsList = document.getElementById('ingredientsList');
    if (!ingredientsList) return;

    let ingredients = [];
    try {
        ingredients = typeof recipe.ingredients === 'string'
            ? JSON.parse(recipe.ingredients)
            : recipe.ingredients;
    } catch (e) {
        console.warn('Could not parse ingredients:', e);
        return;
    }

    const ingredientsHTML = ingredients.map(item => {
        const name = item.ingredient || item.nom || 'Ingrédient inconnu';
        const baseQuantity = parseFloat(item.quantite) || 0;
        const adjustedQuantity = baseQuantity * servings;
        const unit = item.unite || '';

        return `<li>${adjustedQuantity}${unit} ${name}</li>`;
    }).join('');

    ingredientsList.innerHTML = ingredientsHTML || '<li>Aucun ingrédient</li>';

    // Update servings label
    const section = ingredientsList.closest('.popup-section');
    const strong = section.querySelector('strong');
    if (strong) {
        strong.textContent = `Ingrédients (pour ${servings} personne${servings > 1 ? 's' : ''}):`;
    }
}

// Update meal servings display in planning
function updateMealServingsDisplay(recordId, servings) {
    const plannedRecipe = document.querySelector(`[data-record-id="${recordId}"]`);
    if (!plannedRecipe) return;

    const servingsIndicator = plannedRecipe.querySelector('.servings-indicator');
    if (servingsIndicator) {
        servingsIndicator.textContent = `👤 × ${servings}`;
    }
}

closePopup.addEventListener('click', () => {
    recipePopup.classList.remove('active');
});

recipePopup.addEventListener('click', (e) => {
    if (e.target === recipePopup) {
        recipePopup.classList.remove('active');
    }
});

// ===== TOGGLE SIDEBAR (NOW AT BOTTOM) =====
toggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    toggleSidebar.textContent = sidebar.classList.contains('collapsed') ? '▲' : '▼';

    // Afficher/cacher le bouton fixe
    if (sidebar.classList.contains('collapsed')) {
        showSidebar.classList.add('visible');
    } else {
        showSidebar.classList.remove('visible');
    }
});

// Bouton pour rouvrir la sidebar
showSidebar.addEventListener('click', () => {
    sidebar.classList.remove('collapsed');
    toggleSidebar.textContent = '▼';
    showSidebar.classList.remove('visible');
});

// ===== REFRESH RECIPES ===== (v3.11: Removed, button no longer in UI)
// refreshRecipes.addEventListener('click', async () => {
//     refreshRecipes.style.opacity = '0.5';
//     refreshRecipes.disabled = true;
//     await loadRecipes();
//     refreshRecipes.style.opacity = '1';
//     refreshRecipes.disabled = false;
// });

// ===== NAVIGATION DE SEMAINE =====
prevWeek.addEventListener('click', async () => {
    currentWeek--;
    if (currentWeek < 1) {
        currentWeek = 52;
        currentYear--;
    }
    await reloadWeek();
});

nextWeek.addEventListener('click', async () => {
    currentWeek++;
    if (currentWeek > 52) {
        currentWeek = 1;
        currentYear++;
    }
    await reloadWeek();
});

async function reloadWeek() {
    updateWeekDisplay();
    planning = [];
    await loadPlanning();
    createCalendar();
    displayPlanning();
    // v3.10: Load shopping list for new week
    await loadShoppingListOnStartup();
}

// ===== SERVINGS CONTROL (v3.5) =====
const servingsInput = document.getElementById('servingsInput');
const decreaseServings = document.getElementById('decreaseServings');
const increaseServings = document.getElementById('increaseServings');

// Initialize servings input with saved value
servingsInput.value = defaultServings;

// Decrease servings
decreaseServings.addEventListener('click', async () => {
    if (defaultServings > 1) {
        defaultServings--;
        servingsInput.value = defaultServings;
        localStorage.setItem('defaultServings', defaultServings);
        displayPlanning(); // Refresh to show new servings

        // v3.8: Shopping list disabled for rebuild
        // await populateShoppingListFromPlanning();
    }
});

// Increase servings
increaseServings.addEventListener('click', async () => {
    if (defaultServings < 20) {
        defaultServings++;
        servingsInput.value = defaultServings;
        localStorage.setItem('defaultServings', defaultServings);
        displayPlanning(); // Refresh to show new servings

        // v3.8: Shopping list disabled for rebuild
        // await populateShoppingListFromPlanning();
    }
});

// Manual input change
servingsInput.addEventListener('change', async () => {
    let value = parseInt(servingsInput.value);
    if (isNaN(value) || value < 1) value = 1;
    if (value > 20) value = 20;

    defaultServings = value;
    servingsInput.value = value;
    localStorage.setItem('defaultServings', defaultServings);
    displayPlanning(); // Refresh to show new servings

    // v3.5.1: Régénérer la liste de courses automatiquement
    await populateShoppingListFromPlanning();
});

// ===== RECHERCHE DE RECETTES =====
searchRecipes.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    const recipeItems = document.querySelectorAll('.recipe-item');

    recipeItems.forEach(item => {
        const recipeName = item.dataset.recipeName.toLowerCase();
        const recipeTags = item.querySelector('.recipe-tags').textContent.toLowerCase();

        if (recipeName.includes(searchTerm) || recipeTags.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
});

// ===== UTILS =====
function getCurrentWeek() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diff / oneWeek) + 1;
}

function getDateForDay(dayName) {
    // Retourne la date au format YYYY-MM-DD pour le jour de la semaine courante
    const today = new Date();
    const currentDay = today.getDay(); // 0 = dimanche
    const dayIndex = DAYS.indexOf(dayName);

    // Calculer la différence (lundi = 0 dans DAYS, mais lundi = 1 dans getDay)
    const diff = (dayIndex + 1) - currentDay;

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + diff);

    return targetDate.toISOString().split('T')[0];
}

function setupEventListeners() {
    // Déjà fait dans le code ci-dessus
}

// ===== SHOPPING LIST AIRTABLE FUNCTIONS =====

// Save shopping list to Airtable
async function saveShoppingListToAirtable(ingredients, repasInclus, week, year) {
    try {
        setSaveStatus('saving');

        const response = await fetch(`${API_URL}/api/shopping-list`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nom: `Liste semaine ${week} - ${year}`,
                semaine: week,
                annee: year,
                ingredients: ingredients,
                repasInclus: repasInclus,
                statut: 'Active'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        currentShoppingListId = data.shoppingList.id;

        console.log('Shopping list saved to Airtable:', currentShoppingListId);
        setSaveStatus('saved');

        return data.shoppingList;
    } catch (error) {
        console.error('Error saving shopping list:', error);
        setSaveStatus('error');
        throw error;
    }
}

// Update shopping list in Airtable
async function updateShoppingListInAirtable(listId, ingredients, repasInclus, name = null) {
    try {
        setSaveStatus('saving');

        const body = {
            ingredients: ingredients,
            repasInclus: repasInclus
        };

        // v3.3.1: Add name if provided
        if (name) {
            body.nom = name;
        }

        const response = await fetch(`${API_URL}/api/shopping-list/${listId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Shopping list updated in Airtable');
        setSaveStatus('saved');

        return data.shoppingList;
    } catch (error) {
        console.error('Error updating shopping list:', error);
        setSaveStatus('error');
        throw error;
    }
}

// Load shopping list from Airtable
async function loadShoppingListFromAirtable(week, year) {
    try {
        // Get all shopping lists and find the one matching week/year
        const response = await fetch(`${API_URL}/api/shopping-lists`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const lists = data.shoppingLists;

        // Find active list for this week
        const matchingList = lists.find(list =>
            list.semaine === week &&
            list.annee === year &&
            (list.statut === 'Active' || list.statut === 'Brouillon')
        );

        if (matchingList) {
            currentShoppingListId = matchingList.id;
            shoppingList = JSON.parse(matchingList.ingredientsJSON || '[]');
            mealInclusions = JSON.parse(matchingList.repasInclusJSON || '{}');

            console.log('Shopping list loaded from Airtable:', matchingList.id);
            return matchingList;
        }

        return null;
    } catch (error) {
        console.error('Error loading shopping list:', error);
        return null;
    }
}

// Delete shopping list from Airtable
async function deleteShoppingListFromAirtable(listId) {
    try {
        const response = await fetch(`${API_URL}/api/shopping-list/${listId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log('Shopping list deleted from Airtable');
        currentShoppingListId = null;

        return true;
    } catch (error) {
        console.error('Error deleting shopping list:', error);
        throw error;
    }
}

// Debounced auto-save
function scheduleAutoSave() {
    // Clear existing timer
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }

    // Schedule new save in 30 seconds
    autoSaveTimer = setTimeout(async () => {
        if (currentShoppingListId && shoppingList.length > 0) {
            console.log('Auto-saving shopping list...');
            await updateShoppingListInAirtable(currentShoppingListId, shoppingList, mealInclusions);
        }
    }, 30000); // 30 seconds
}

// Set save status indicator
function setSaveStatus(status) {
    isSaving = status === 'saving';

    // Update UI indicator (we'll add this to HTML later)
    const statusIndicator = document.getElementById('saveStatus');
    if (statusIndicator) {
        if (status === 'saving') {
            statusIndicator.textContent = '💾 Sauvegarde...';
            statusIndicator.className = 'save-status saving';
        } else if (status === 'saved') {
            statusIndicator.textContent = '✓ Sauvegardé';
            statusIndicator.className = 'save-status saved';
            // Hide after 2 seconds
            setTimeout(() => {
                statusIndicator.textContent = '';
                statusIndicator.className = 'save-status';
            }, 2000);
        } else if (status === 'error') {
            statusIndicator.textContent = '❌ Erreur';
            statusIndicator.className = 'save-status error';
        }
    }
}

// ===== V3.1 - SHOPPING LIST REAL-TIME FUNCTIONS =====

// Initialize shopping list on page load
async function initializeShoppingList() {
    try {
        console.log('Initializing shopping list for week', currentWeek, currentYear);

        // Check if list exists for current week
        const existingList = await loadShoppingListFromAirtable(currentWeek, currentYear);

        if (existingList) {
            // List exists → Load and display
            currentShoppingListId = existingList.id;
            console.log('Loaded existing shopping list:', currentShoppingListId);
        } else {
            // New week or first time → Create list and populate from existing planning
            console.log('Creating new shopping list for week', currentWeek);
            await createEmptyShoppingList(currentWeek, currentYear);

            // Populate with existing planning meals
            await populateShoppingListFromPlanning();
        }

        // Display the list from Airtable
        await displayShoppingListFromAirtable();

        // Load and display shopping history
        await displayShoppingHistory();

    } catch (error) {
        console.error('Error initializing shopping list:', error);
    }
}

// Create empty shopping list for new week
async function createEmptyShoppingList(week, year) {
    try {
        const response = await fetch(`${API_URL}/api/shopping-list`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nom: `Liste semaine ${week} - ${year}`,
                semaine: week,
                annee: year,
                ingredients: [],
                repasInclus: {},
                statut: 'Active'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        currentShoppingListId = data.shoppingList.id;

        console.log('Created empty shopping list:', currentShoppingListId);
        return data.shoppingList;
    } catch (error) {
        console.error('Error creating empty shopping list:', error);
        throw error;
    }
}

// Display shopping list from Airtable (not from cache)
async function displayShoppingListFromAirtable() {
    try {
        if (!currentShoppingListId) {
            shoppingContent.innerHTML = '<p class="empty-shopping">Aucune liste de courses disponible.</p>';
            return;
        }

        // Fetch list from Airtable
        const response = await fetch(`${API_URL}/api/shopping-list/${currentShoppingListId}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const list = data.shoppingList;

        // Parse ingredients JSON
        const ingredients = JSON.parse(list.ingredientsJSON || '[]');

        console.log('Displaying shopping list from Airtable:', ingredients.length, 'items');

        if (ingredients.length === 0) {
            shoppingContent.innerHTML = '<p class="empty-shopping">Aucun repas planifié pour cette semaine.</p>';
            return;
        }

        // Group by category
        const byCategory = {};
        ingredients.forEach(item => {
            if (!byCategory[item.category]) {
                byCategory[item.category] = [];
            }
            byCategory[item.category].push(item);
        });

        // v3.3.2: Display list name from Airtable (includes "- Modifié" if modified)
        const listName = list.nom || `Liste semaine ${currentWeek} - ${currentYear}`;

        // Generate HTML with categories
        let html = '<div class="shopping-list">';
        html += `<h3>${listName}</h3>`;

        // Sort categories
        const categories = Object.keys(byCategory).sort();

        categories.forEach(category => {
            html += `<div class="shopping-category">`;
            html += `<h4>${category}</h4>`;
            html += `<ul>`;

            byCategory[category].forEach(item => {
                const quantityStr = item.quantity % 1 === 0
                    ? item.quantity
                    : item.quantity.toFixed(1);
                html += `<li>${quantityStr} ${item.unit} ${item.name}</li>`;
            });

            html += `</ul>`;
            html += `</div>`;
        });

        html += '</div>';

        shoppingContent.innerHTML = html;

    } catch (error) {
        console.error('Error displaying shopping list from Airtable:', error);
        shoppingContent.innerHTML = '<p class="empty-shopping">Erreur lors du chargement de la liste.</p>';
    }
}

// Parse recipe ingredients to standard format
function parseRecipeIngredients(recipe, servings = null) {
    if (!recipe || !recipe.ingredients) {
        return [];
    }

    try {
        let ingredientsList;

        if (typeof recipe.ingredients === 'string') {
            ingredientsList = JSON.parse(recipe.ingredients);
        } else {
            ingredientsList = recipe.ingredients;
        }

        if (!Array.isArray(ingredientsList)) {
            return [];
        }

        const parsedIngredients = [];

        // v3.7: Use provided servings, or default if not provided
        const finalServings = servings !== null ? servings : defaultServings;

        ingredientsList.forEach(item => {
            // Support both 'ingredient' and 'nom' fields
            const name = item.ingredient || item.nom;

            if (!name) {
                console.warn('Item sans nom d\'ingrédient:', item);
                return;
            }

            // v3.7: Multiply quantities by meal-specific servings (recipes in Airtable are for 1 person)
            const baseQuantity = parseFloat(item.quantite) || 0;
            const adjustedQuantity = baseQuantity * finalServings;

            parsedIngredients.push({
                name: name,
                quantity: adjustedQuantity,
                unit: item.unite || 'unité',
                category: categorizeIngredient(name)
            });
        });

        return parsedIngredients;

    } catch (error) {
        console.error('Error parsing recipe ingredients:', error);
        return [];
    }
}

// Merge and aggregate ingredients
function mergeIngredients(existing, newOnes) {
    const map = {};

    // Add existing ingredients to map
    existing.forEach(item => {
        const key = `${item.name.toLowerCase()}_${item.unit}`;
        map[key] = { ...item };
    });

    // Merge new ingredients
    newOnes.forEach(item => {
        const key = `${item.name.toLowerCase()}_${item.unit}`;
        if (map[key]) {
            // Same ingredient + unit → Add quantities
            map[key].quantity += item.quantity;
        } else {
            // New ingredient
            map[key] = { ...item };
        }
    });

    return Object.values(map);
}

// ===== SIMPLE SHOPPING LIST (v3.8.2) =====
// Simple list: just append ingredients from each meal, no merging
let shoppingListIngredients = [];

function addIngredientsToShoppingList(recipe, servings) {
    console.log(`🛒 Adding ingredients for ${recipe.name} (${servings} pers)`);

    // Get ingredients with quantities multiplied by servings
    const ingredients = parseRecipeIngredients(recipe, servings);

    // Add to our simple list
    shoppingListIngredients = shoppingListIngredients.concat(ingredients);

    // Display the list
    displayShoppingList();
}

function displayShoppingList() {
    const shoppingContent = document.getElementById('shoppingContent');

    if (shoppingListIngredients.length === 0) {
        shoppingContent.innerHTML = '<p class="empty-shopping">Aucun ingrédient dans la liste.</p>';
        return;
    }

    // Simple list, no grouping, no merging
    let html = '<ul class="ingredients-list">';
    shoppingListIngredients.forEach(ingredient => {
        const quantity = Math.round(ingredient.quantity * 100) / 100;
        html += `<li><strong>${quantity}${ingredient.unit}</strong> ${ingredient.name}</li>`;
    });
    html += '</ul>';

    shoppingContent.innerHTML = html;
    console.log(`✅ Shopping list: ${shoppingListIngredients.length} ingrédients`);
}

// Populate shopping list from existing planning
async function populateShoppingListFromPlanning() {
    try {
        console.log('Populating shopping list from existing planning...');

        // Get current week planning
        const weekKey = `${currentWeek}-${currentYear}`;
        const weekPlanning = allWeeksPlanning[weekKey] || planning;

        if (!weekPlanning || weekPlanning.length === 0) {
            console.log('No meals in planning yet');
            return;
        }

        let allIngredients = [];

        // Loop through all planning items
        for (const item of weekPlanning) {
            if (item.recipe && item.recipe.length > 0) {
                const recipeId = item.recipe[0];
                const recipe = recipes.find(r => r.id === recipeId);

                if (recipe) {
                    // v3.7: Pass item.servings (from Airtable) to use meal-specific servings
                    const servings = item.servings || defaultServings;
                    const ingredients = parseRecipeIngredients(recipe, servings);
                    allIngredients = allIngredients.concat(ingredients);
                    console.log(`Added ${ingredients.length} ingredients from ${recipe.name} (${servings} personnes)`);
                }
            }
        }

        if (allIngredients.length === 0) {
            console.log('No ingredients found in planning');
            return;
        }

        // Merge all ingredients
        const mergedIngredients = mergeIngredients([], allIngredients);
        console.log(`Total merged ingredients: ${mergedIngredients.length}`);

        // Update shopping list in Airtable
        await updateShoppingListInAirtable(currentShoppingListId, mergedIngredients, {});

        console.log('✅ Shopping list populated from planning');

    } catch (error) {
        console.error('Error populating shopping list from planning:', error);
    }
}

// Add meal ingredients to shopping list (auto-update on drop)
async function addMealToShoppingList(recipeId) {
    try {
        console.log('Adding meal to shopping list:', recipeId);

        // 1. Find the recipe
        const recipe = recipes.find(r => r.id === recipeId);
        if (!recipe) {
            console.error('Recipe not found:', recipeId);
            return;
        }

        // 2. Parse recipe ingredients
        const newIngredients = parseRecipeIngredients(recipe);
        console.log('Parsed ingredients:', newIngredients);

        if (newIngredients.length === 0) {
            console.warn('No ingredients found for recipe:', recipe.name);
            return;
        }

        // 3. Fetch current shopping list from Airtable
        if (!currentShoppingListId) {
            console.error('No current shopping list ID');
            return;
        }

        const response = await fetch(`${API_URL}/api/shopping-list/${currentShoppingListId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const existingIngredients = JSON.parse(data.shoppingList.ingredientsJSON || '[]');

        // 4. Merge ingredients
        const mergedIngredients = mergeIngredients(existingIngredients, newIngredients);
        console.log('Merged ingredients:', mergedIngredients.length, 'items');

        // 5. Update in Airtable
        await updateShoppingListInAirtable(currentShoppingListId, mergedIngredients, {});

        // 6. Refresh display
        await displayShoppingListFromAirtable();

        console.log('✅ Shopping list updated successfully');

    } catch (error) {
        console.error('Error adding meal to shopping list:', error);
    }
}

// ===== LISTE DE COURSES =====

// Initialize meal inclusions (all meals included by default)
function initializeMealInclusions() {
    mealInclusions = {};
    planning.forEach((item, index) => {
        mealInclusions[index] = true; // true = included (green), false = excluded (red)
    });
}

// Open settings popup (v3.11: Removed, button no longer in UI)
// settingsBtn.addEventListener('click', () => {
//     settingsWeek = currentWeek;
//     settingsYear = currentYear;
//     initializeSettingsPopup();
//     shoppingSettingsPopup.classList.add('active');
// });

// Close settings popup
closeSettingsPopup.addEventListener('click', () => {
    shoppingSettingsPopup.classList.remove('active');
});

// Close on outside click
shoppingSettingsPopup.addEventListener('click', (e) => {
    if (e.target === shoppingSettingsPopup) {
        shoppingSettingsPopup.classList.remove('active');
    }
});

// Apply and close
applySettings.addEventListener('click', async () => {
    await applySettingsAndSave();
    shoppingSettingsPopup.classList.remove('active');
});

// Initialize settings popup (v3.2 - Airtable version)
async function initializeSettingsPopup() {
    try {
        // Load meal inclusions from Airtable
        await loadMealInclusionsFromAirtable();

        // Display planning grid
        await displaySettingsCalendar();

        // Load and display current shopping list for editing from Airtable
        await displayEditableShoppingListFromAirtable();
    } catch (error) {
        console.error('Error initializing settings popup:', error);
    }
}

// Load meal inclusions from Airtable (v3.2)
async function loadMealInclusionsFromAirtable() {
    try {
        if (!currentShoppingListId) {
            // No list exists, initialize all as included
            initializeMealInclusions();
            return;
        }

        // Fetch current shopping list
        const response = await fetch(`${API_URL}/api/shopping-list/${currentShoppingListId}`);
        const data = await response.json();

        if (data.success) {
            const savedInclusions = JSON.parse(data.shoppingList.repasInclusJSON || '{}');

            // Merge with current mealInclusions
            mealInclusions = { ...mealInclusions, ...savedInclusions };

            console.log('Loaded meal inclusions from Airtable:', Object.keys(savedInclusions).length, 'items');
        } else {
            // Fallback to default
            initializeMealInclusions();
        }
    } catch (error) {
        console.error('Error loading meal inclusions:', error);
        initializeMealInclusions();
    }
}

// Display planning in settings popup
async function displaySettingsCalendar() {
    // Update week display with modification indicator (v3.3)
    const modifiedText = isListModified ? ' - Modifié' : '';
    settingsWeekDisplay.textContent = `Semaine ${settingsWeek} - ${settingsYear}${modifiedText}`;

    // Load planning for this week if not loaded
    const weekPlanning = await loadPlanningForWeek(settingsWeek, settingsYear);
    const isCurrentWeek = (settingsWeek === currentWeek && settingsYear === currentYear);

    // Initialize mealInclusions for this week if not exists
    weekPlanning.forEach((item, index) => {
        const globalKey = `${settingsWeek}-${settingsYear}-${index}`;
        if (mealInclusions[globalKey] === undefined) {
            mealInclusions[globalKey] = isCurrentWeek; // Current week: included by default, others: excluded
        }
    });

    settingsCalendar.innerHTML = '';

    DAYS.forEach((day, dayIndex) => {
        const dayColumn = document.createElement('div');
        dayColumn.className = 'settings-day-column';

        const dayHeader = document.createElement('div');
        dayHeader.className = 'settings-day-header';
        dayHeader.textContent = day;
        dayColumn.appendChild(dayHeader);

        MEALS.forEach(meal => {
            const mealSlot = document.createElement('div');
            mealSlot.className = 'settings-meal-slot';

            const mealLabel = document.createElement('div');
            mealLabel.className = 'settings-meal-label';
            mealLabel.textContent = meal;
            mealSlot.appendChild(mealLabel);

            // Find planning item for this day/meal in the displayed week
            const planningIndex = weekPlanning.findIndex(p => p.day === day && p.meal === meal);

            if (planningIndex !== -1) {
                const item = weekPlanning[planningIndex];
                const recipeId = item.recipe && item.recipe.length > 0 ? item.recipe[0] : null;
                const recipe = recipeId ? recipes.find(r => r.id === recipeId) : null;
                const recipeName = recipe ? recipe.name : 'Recette inconnue';

                const mealItem = document.createElement('div');
                mealItem.className = 'settings-meal-item';

                const globalKey = `${settingsWeek}-${settingsYear}-${planningIndex}`;
                const isIncluded = mealInclusions[globalKey];

                // v3.3: Simplified color system - just green/red
                const boxClass = `settings-meal-box ${isIncluded ? 'included' : 'excluded'}`;

                const mealBox = document.createElement('div');
                mealBox.className = boxClass;
                mealBox.textContent = recipeName;
                mealBox.dataset.globalKey = globalKey;
                mealBox.dataset.settingsWeek = settingsWeek;
                mealBox.dataset.settingsYear = settingsYear;

                // Toggle inclusion/exclusion
                mealBox.addEventListener('click', async () => {
                    mealInclusions[globalKey] = !mealInclusions[globalKey];
                    const nowIncluded = mealInclusions[globalKey];

                    // v3.3: Simplified - just toggle green/red
                    mealBox.className = `settings-meal-box ${nowIncluded ? 'included' : 'excluded'}`;

                    // Mark list as modified (v3.3)
                    isListModified = true;
                    updateSettingsWeekDisplay();

                    // v3.2: Update editable list in real-time
                    await updateEditableListPreview();
                });

                const infoBtn = document.createElement('button');
                infoBtn.className = 'settings-info-btn';
                infoBtn.textContent = 'i';
                infoBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (recipe) {
                        showRecipePopup(recipe);
                    }
                });

                mealItem.appendChild(mealBox);
                mealItem.appendChild(infoBtn);
                mealSlot.appendChild(mealItem);
            }

            dayColumn.appendChild(mealSlot);
        });

        settingsCalendar.appendChild(dayColumn);
    });
}

// Display editable shopping list
function displayEditableShoppingList() {
    if (shoppingList.length === 0) {
        settingsListContent.innerHTML = '<p class="empty-shopping">Générez d\'abord la liste pour l\'éditer.</p>';
        return;
    }

    // Group by category
    const byCategory = {};
    shoppingList.forEach((item, index) => {
        if (!byCategory[item.category]) {
            byCategory[item.category] = [];
        }
        byCategory[item.category].push({ ...item, index });
    });

    let html = '<div class="editable-shopping-list">';

    const categories = Object.keys(byCategory).sort();
    categories.forEach(category => {
        html += `<div class="shopping-category">`;
        html += `<h4>${category}</h4>`;

        byCategory[category].forEach(item => {
            const quantityStr = item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1);
            html += `
                <div class="editable-ingredient" data-index="${item.index}">
                    <input type="number" class="ingredient-qty" value="${quantityStr}" step="1" min="0">
                    <select class="ingredient-unit">
                        <option value="g" ${item.unit === 'g' ? 'selected' : ''}>g</option>
                        <option value="kg" ${item.unit === 'kg' ? 'selected' : ''}>kg</option>
                        <option value="ml" ${item.unit === 'ml' ? 'selected' : ''}>ml</option>
                        <option value="L" ${item.unit === 'L' ? 'selected' : ''}>L</option>
                        <option value="c.à.s" ${item.unit === 'c.à.s' ? 'selected' : ''}>c.à.s</option>
                        <option value="c.à.c" ${item.unit === 'c.à.c' ? 'selected' : ''}>c.à.c</option>
                        <option value="pièce" ${item.unit === 'pièce' ? 'selected' : ''}>pièce</option>
                        <option value="pincée" ${item.unit === 'pincée' ? 'selected' : ''}>pincée</option>
                        <option value="unité" ${item.unit === 'unité' ? 'selected' : ''}>unité</option>
                    </select>
                    <span class="ingredient-name">${item.name}</span>
                    <button class="ingredient-delete-btn" data-index="${item.index}">🗑️</button>
                </div>
            `;
        });

        html += `</div>`;
    });

    html += '</div>';
    settingsListContent.innerHTML = html;

    // Add event listeners for editing
    document.querySelectorAll('.ingredient-qty').forEach(input => {
        input.addEventListener('change', (e) => {
            const index = parseInt(e.target.closest('.editable-ingredient').dataset.index);
            shoppingList[index].quantity = parseFloat(e.target.value) || 0;
            scheduleAutoSave(); // Auto-save après modification
        });
    });

    document.querySelectorAll('.ingredient-unit').forEach(select => {
        select.addEventListener('change', (e) => {
            const index = parseInt(e.target.closest('.editable-ingredient').dataset.index);
            shoppingList[index].unit = e.target.value;
            scheduleAutoSave(); // Auto-save après modification
        });
    });

    document.querySelectorAll('.ingredient-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            shoppingList.splice(index, 1);
            displayEditableShoppingList();
            displayShoppingList(); // Update main display
            scheduleAutoSave(); // Auto-save après suppression
        });
    });
}

// ===== V3.2 - SETTINGS POPUP AIRTABLE FUNCTIONS =====

// Display editable shopping list from Airtable (v3.2)
async function displayEditableShoppingListFromAirtable() {
    try {
        if (!currentShoppingListId) {
            settingsListContent.innerHTML = '<p class="empty-shopping">Aucune liste disponible.</p>';
            return;
        }

        // Fetch current shopping list from Airtable
        const response = await fetch(`${API_URL}/api/shopping-list/${currentShoppingListId}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error('Failed to load shopping list');
        }

        const list = data.shoppingList;
        const ingredients = JSON.parse(list.ingredientsJSON || '[]');

        if (ingredients.length === 0) {
            settingsListContent.innerHTML = '<p class="empty-shopping">Liste vide.</p>';
            return;
        }

        displayEditableIngredients(ingredients);

    } catch (error) {
        console.error('Error displaying editable list from Airtable:', error);
        settingsListContent.innerHTML = '<p class="empty-shopping">Erreur de chargement.</p>';
    }
}

// Display ingredients as editable list
function displayEditableIngredients(ingredients) {
    // Group by category
    const byCategory = {};
    ingredients.forEach((item, index) => {
        const category = item.category || 'Autre';
        if (!byCategory[category]) {
            byCategory[category] = [];
        }
        byCategory[category].push({ ...item, index });
    });

    let html = '<div class="editable-shopping-list">';

    const categories = Object.keys(byCategory).sort();
    categories.forEach(category => {
        html += `<div class="shopping-category">`;
        html += `<h4>${category}</h4>`;

        byCategory[category].forEach(item => {
            const quantityStr = item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1);
            html += `
                <div class="editable-ingredient" data-index="${item.index}">
                    <input type="number" class="ingredient-qty" value="${quantityStr}" step="0.1" min="0" data-index="${item.index}">
                    <select class="ingredient-unit" data-index="${item.index}">
                        <option value="g" ${item.unit === 'g' ? 'selected' : ''}>g</option>
                        <option value="kg" ${item.unit === 'kg' ? 'selected' : ''}>kg</option>
                        <option value="ml" ${item.unit === 'ml' ? 'selected' : ''}>ml</option>
                        <option value="L" ${item.unit === 'L' ? 'selected' : ''}>L</option>
                        <option value="c.à.s" ${item.unit === 'c.à.s' ? 'selected' : ''}>c.à.s</option>
                        <option value="c.à.c" ${item.unit === 'c.à.c' ? 'selected' : ''}>c.à.c</option>
                        <option value="pièce" ${item.unit === 'pièce' ? 'selected' : ''}>pièce</option>
                        <option value="pincée" ${item.unit === 'pincée' ? 'selected' : ''}>pincée</option>
                        <option value="unité" ${item.unit === 'unité' ? 'selected' : ''}>unité</option>
                    </select>
                    <span class="ingredient-name">${item.name}</span>
                    <button class="ingredient-delete-btn" data-index="${item.index}">🗑️</button>
                </div>
            `;
        });

        html += `</div>`;
    });

    html += '</div>';
    settingsListContent.innerHTML = html;

    // Add event listeners (modifications are kept in memory until "Apply")
    attachEditableListeners();
}

// Attach event listeners to editable ingredients
function attachEditableListeners() {
    // Note: We don't save to Airtable here, just update the DOM
    // Actual save happens when clicking "Apply"

    document.querySelectorAll('.ingredient-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.editable-ingredient').remove();
        });
    });
}

// Update editable list preview based on meal inclusions (v3.3 - cross-week support)
async function updateEditableListPreview() {
    try {
        let allIngredients = [];

        // Loop through ALL meal inclusions (any week)
        for (const globalKey in mealInclusions) {
            const isIncluded = mealInclusions[globalKey];

            if (isIncluded) {
                // Parse the global key: "week-year-index"
                const parts = globalKey.split('-');
                const week = parseInt(parts[0]);
                const year = parseInt(parts[1]);
                const index = parseInt(parts[2]);

                // Load planning for this week if needed
                const weekKey = `${week}-${year}`;
                let weekPlanning = allWeeksPlanning[weekKey];

                if (!weekPlanning) {
                    // Load this week's planning
                    weekPlanning = await loadPlanningForWeek(week, year);
                }

                // Get the meal item
                if (weekPlanning && weekPlanning[index]) {
                    const item = weekPlanning[index];

                    if (item.recipe && item.recipe.length > 0) {
                        const recipeId = item.recipe[0];
                        const recipe = recipes.find(r => r.id === recipeId);

                        if (recipe) {
                            const ingredients = parseRecipeIngredients(recipe);
                            allIngredients = allIngredients.concat(ingredients);
                            console.log(`Added ingredients from ${recipe.name} (Week ${week})`);
                        }
                    }
                }
            }
        }

        // Merge ingredients
        const mergedIngredients = mergeIngredients([], allIngredients);

        // Display
        if (mergedIngredients.length === 0) {
            settingsListContent.innerHTML = '<p class="empty-shopping">Aucun repas sélectionné.</p>';
        } else {
            displayEditableIngredients(mergedIngredients);
            console.log(`Total: ${mergedIngredients.length} ingredients from all weeks`);
        }

    } catch (error) {
        console.error('Error updating editable list preview:', error);
    }
}

// Update settings week display with modification indicator (v3.3)
function updateSettingsWeekDisplay() {
    const modifiedText = isListModified ? ' - Modifié' : '';
    settingsWeekDisplay.textContent = `Semaine ${settingsWeek} - ${settingsYear}${modifiedText}`;
}

// Apply settings and save to Airtable (v3.2)
async function applySettingsAndSave() {
    try {
        console.log('Applying settings and saving to Airtable...');

        // Collect modified ingredients from the editable list
        const modifiedIngredients = [];
        document.querySelectorAll('.editable-ingredient').forEach(el => {
            const qty = parseFloat(el.querySelector('.ingredient-qty').value) || 0;
            const unit = el.querySelector('.ingredient-unit').value;
            const name = el.querySelector('.ingredient-name').textContent;
            const category = el.closest('.shopping-category')?.querySelector('h4')?.textContent || 'Autre';

            if (qty > 0) {
                modifiedIngredients.push({
                    name,
                    quantity: qty,
                    unit,
                    category
                });
            }
        });

        // v3.3.1: Update list name in Airtable if modified
        let updatedName = `Liste semaine ${currentWeek} - ${currentYear}`;
        if (isListModified) {
            updatedName += ' - Modifié';
        }

        // Save to Airtable with updated name
        await updateShoppingListInAirtable(currentShoppingListId, modifiedIngredients, mealInclusions, updatedName);

        // Refresh main display
        await displayShoppingListFromAirtable();

        // Reset modified flag (v3.3)
        isListModified = false;
        updateSettingsWeekDisplay();

        console.log('✅ Settings saved to Airtable');

    } catch (error) {
        console.error('Error applying settings:', error);
        alert('Erreur lors de la sauvegarde. Veuillez réessayer.');
    }
}

// Reset shopping list to default (v3.3)
async function resetShoppingListToDefault() {
    try {
        if (!confirm('Voulez-vous réinitialiser la liste de courses ?\n\nCela va :\n- Inclure tous les repas de la semaine actuelle\n- Exclure tous les repas des autres semaines\n- Restaurer les quantités par défaut des recettes')) {
            return;
        }

        console.log('Resetting shopping list to default...');

        // Reset all meal inclusions
        const weekKey = `${currentWeek}-${currentYear}`;
        const currentWeekPlanning = allWeeksPlanning[weekKey] || planning;

        // Clear all inclusions
        mealInclusions = {};

        // Set current week meals as included
        currentWeekPlanning.forEach((item, index) => {
            const globalKey = `${currentWeek}-${currentYear}-${index}`;
            mealInclusions[globalKey] = true; // Include current week meals
        });

        // Regenerate list from current week planning only
        let allIngredients = [];
        currentWeekPlanning.forEach((item, index) => {
            if (item.recipe && item.recipe.length > 0) {
                const recipeId = item.recipe[0];
                const recipe = recipes.find(r => r.id === recipeId);

                if (recipe) {
                    const ingredients = parseRecipeIngredients(recipe);
                    allIngredients = allIngredients.concat(ingredients);
                }
            }
        });

        // Merge ingredients
        const mergedIngredients = mergeIngredients([], allIngredients);

        // v3.3.1: Restore original name (without "- Modifié")
        const originalName = `Liste semaine ${currentWeek} - ${currentYear}`;

        // Save to Airtable with original name
        await updateShoppingListInAirtable(currentShoppingListId, mergedIngredients, mealInclusions, originalName);

        // Reset modified flag
        isListModified = false;

        // Refresh displays
        await displaySettingsCalendar();
        await displayEditableShoppingListFromAirtable();
        await displayShoppingListFromAirtable();

        console.log('✅ Shopping list reset to default');

    } catch (error) {
        console.error('Error resetting shopping list:', error);
        alert('Erreur lors de la réinitialisation. Veuillez réessayer.');
    }
}

// Reset button event listener (v3.3)
resetSettings.addEventListener('click', resetShoppingListToDefault);

// Clear shopping list (v3.11: Removed, button no longer in UI)
// clearListBtn.addEventListener('click', async () => {
//     if (confirm('Voulez-vous vraiment vider la liste de courses ?')) {
//         // Delete from Airtable if exists
//         if (currentShoppingListId) {
//             try {
//                 await deleteShoppingListFromAirtable(currentShoppingListId);
//             } catch (error) {
//                 console.error('Error deleting from Airtable:', error);
//             }
//         }
//         shoppingList = [];
//         currentShoppingListId = null;
//         shoppingContent.innerHTML = '<p class="empty-shopping">La liste a été vidée.</p>';
//     }
// });

// Week navigation in settings popup
settingsPrevWeek.addEventListener('click', async () => {
    settingsWeek--;
    if (settingsWeek < 1) {
        settingsWeek = 52;
        settingsYear--;
    }
    await loadPlanningForWeek(settingsWeek, settingsYear);
    displaySettingsCalendar();
});

settingsNextWeek.addEventListener('click', async () => {
    settingsWeek++;
    if (settingsWeek > 52) {
        settingsWeek = 1;
        settingsYear++;
    }
    await loadPlanningForWeek(settingsWeek, settingsYear);
    displaySettingsCalendar();
});

// Select all / none meals
settingsSelectAll.addEventListener('click', () => {
    Object.keys(mealInclusions).forEach(key => {
        mealInclusions[key] = true;
    });
    displaySettingsCalendar();
});

settingsSelectNone.addEventListener('click', () => {
    Object.keys(mealInclusions).forEach(key => {
        mealInclusions[key] = false;
    });
    displaySettingsCalendar();
});

// v3.10: generateListBtn removed, no longer needed
// Rafraîchir la liste de courses depuis Airtable
// generateListBtn.addEventListener('click', async () => {
//     console.log('Rafraîchissement de la liste depuis Airtable...');
//     await displayShoppingListFromAirtable();
// });

async function generateShoppingList() {
    shoppingList = [];

    console.log('=== DEBUG GÉNÉRATION LISTE ===');
    console.log('All weeks planning:', allWeeksPlanning);
    console.log('Recettes disponibles:', recipes);
    console.log('Meal inclusions:', mealInclusions);

    // Map pour agréger les ingrédients
    const ingredientsMap = {};

    // Parcourir toutes les semaines chargées
    Object.keys(allWeeksPlanning).forEach(weekKey => {
        const [week, year] = weekKey.split('-').map(Number);
        const weekPlanning = allWeeksPlanning[weekKey];

        console.log(`Processing week ${week}-${year}:`, weekPlanning);

        weekPlanning.forEach((item, index) => {
            const globalKey = `${week}-${year}-${index}`;

            // Skip if meal is excluded
            if (mealInclusions[globalKey] === false) {
                console.log(`Skipping excluded meal: ${item.day} - ${item.meal} (${weekKey})`);
                return;
            }

            console.log('Item planning:', item);

            if (item.recipe && item.recipe.length > 0) {
                const recipeId = item.recipe[0];
                const recipe = recipes.find(r => r.id === recipeId);

                console.log('Recette trouvée:', recipe);

                if (recipe) {
                    console.log(`Type de ingredients:`, typeof recipe.ingredients);
                    console.log(`Ingrédients bruts:`, recipe.ingredients);

                    if (recipe.ingredients) {
                        try {
                            // Parser le JSON des ingrédients
                            let ingredientsList;

                            if (typeof recipe.ingredients === 'string') {
                                ingredientsList = JSON.parse(recipe.ingredients);
                            } else {
                                ingredientsList = recipe.ingredients;
                            }

                            console.log(`Ingrédients parsés:`, ingredientsList);

                            if (Array.isArray(ingredientsList)) {
                                ingredientsList.forEach(item => {
                                    // Support both 'ingredient' and 'nom' fields
                                    const name = item.ingredient || item.nom;

                                    // Skip invalid items
                                    if (!name) {
                                        console.warn('Item sans nom d\'ingrédient:', item);
                                        return;
                                    }
                                    const quantity = parseFloat(item.quantite) || 0;
                                    const unit = item.unite || 'unité';

                                    console.log(`Traitement: ${quantity} ${unit} ${name}`);

                                    const key = name.toLowerCase();

                                    if (ingredientsMap[key]) {
                                        // Agréger les quantités (seulement si même unité)
                                        if (ingredientsMap[key].unit === unit) {
                                            ingredientsMap[key].quantity += quantity;
                                        } else {
                                            // Créer une entrée séparée avec l'unité différente
                                            const newKey = `${key}_${unit}`;
                                            if (ingredientsMap[newKey]) {
                                                ingredientsMap[newKey].quantity += quantity;
                                            } else {
                                                ingredientsMap[newKey] = {
                                                    name: name,
                                                    quantity: quantity,
                                                    unit: unit,
                                                    category: categorizeIngredient(name)
                                                };
                                            }
                                        }
                                    } else {
                                        ingredientsMap[key] = {
                                            name: name,
                                            quantity: quantity,
                                            unit: unit,
                                            category: categorizeIngredient(name)
                                        };
                                    }
                                });
                            }
                        } catch (error) {
                            console.error(`Erreur parsing JSON pour ${recipe.name}:`, error);
                        }
                    } else {
                        console.warn(`Pas d'ingrédients pour la recette: ${recipe.name}`);
                    }
                }
            }
        });
    });

    // Convertir en tableau
    shoppingList = Object.values(ingredientsMap);
    console.log('Liste agrégée:', shoppingList);

    // Sauvegarder dans Airtable
    try {
        await saveShoppingListToAirtable(shoppingList, mealInclusions, currentWeek, currentYear);
        console.log('Liste sauvegardée dans Airtable avec succès');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde dans Airtable:', error);
        alert('Erreur lors de la sauvegarde de la liste. Vérifiez votre connexion.');
    }

    // Afficher la liste
    displayShoppingList();
}

// Parser une ligne d'ingrédient (ex: "200g de farine", "2 oeufs", "1 cuillère à soupe d'huile")
function parseIngredient(line) {
    line = line.trim();
    if (!line) return null;

    // Patterns de parsing
    // Pattern 1: "200g de farine" ou "200 g farine"
    let match = line.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Zéè]+)?\s*(?:de|d')?\s*(.+)$/i);

    if (match) {
        return {
            quantity: parseFloat(match[1].replace(',', '.')),
            unit: match[2] || 'unité',
            name: match[3].trim(),
            category: categorizeIngredient(match[3].trim())
        };
    }

    // Pattern 2: Juste le nom (ex: "Sel", "Poivre")
    return {
        quantity: 1,
        unit: 'unité',
        name: line,
        category: categorizeIngredient(line)
    };
}

// Catégoriser un ingrédient (simple pour l'instant)
function categorizeIngredient(name) {
    const nameLower = name.toLowerCase();

    if (nameLower.includes('tomate') || nameLower.includes('salade') || nameLower.includes('carotte') ||
        nameLower.includes('oignon') || nameLower.includes('légume') || nameLower.includes('courgette') ||
        nameLower.includes('poivron') || nameLower.includes('pomme de terre')) {
        return 'Fruits & Légumes';
    }

    // Poissons (check first - more specific)
    if (nameLower.includes('poisson') || nameLower.includes('saumon') || nameLower.includes('thon') ||
        nameLower.includes('truite') || nameLower.includes('cabillaud') || nameLower.includes('colin') ||
        nameLower.includes('dorade') || nameLower.includes('crevette') || nameLower.includes('fruits de mer')) {
        return 'Poissons';
    }

    // Viandes
    if (nameLower.includes('poulet') || nameLower.includes('boeuf') || nameLower.includes('porc') ||
        nameLower.includes('viande') || nameLower.includes('bœuf') || nameLower.includes('agneau') ||
        nameLower.includes('veau') || nameLower.includes('dinde') || nameLower.includes('canard') ||
        nameLower.includes('steak') || nameLower.includes('escalope')) {
        return 'Viandes';
    }

    if (nameLower.includes('lait') || nameLower.includes('fromage') || nameLower.includes('yaourt') ||
        nameLower.includes('beurre') || nameLower.includes('crème')) {
        return 'Produits Laitiers';
    }

    if (nameLower.includes('farine') || nameLower.includes('pâtes') || nameLower.includes('riz') ||
        nameLower.includes('pain') || nameLower.includes('céréale')) {
        return 'Féculents';
    }

    if (nameLower.includes('huile') || nameLower.includes('sel') || nameLower.includes('poivre') ||
        nameLower.includes('épice') || nameLower.includes('sucre')) {
        return 'Épicerie';
    }

    return 'Autre';
}

// Afficher la liste de courses
function displayShoppingList() {
    console.log('Affichage liste:', shoppingList);

    if (shoppingList.length === 0) {
        shoppingContent.innerHTML = '<p class="empty-shopping">Aucun repas planifié pour cette semaine.</p>';
        return;
    }

    // Grouper par catégorie
    const byCategory = {};
    shoppingList.forEach(item => {
        if (!byCategory[item.category]) {
            byCategory[item.category] = [];
        }
        byCategory[item.category].push(item);
    });

    // Générer le HTML avec catégories
    let html = '<div class="shopping-list">';
    html += '<h3>Liste de courses</h3>';

    // Trier les catégories
    const categories = Object.keys(byCategory).sort();

    categories.forEach(category => {
        html += `<div class="shopping-category">`;
        html += `<h4>${category}</h4>`;
        html += `<ul>`;

        byCategory[category].forEach(item => {
            const quantityStr = item.quantity % 1 === 0
                ? item.quantity
                : item.quantity.toFixed(1);
            // Format with space between quantity and unit: "200 g de farine"
            html += `<li>${quantityStr} ${item.unit} ${item.name}</li>`;
        });

        html += `</ul>`;
        html += `</div>`;
    });

    html += '</div>';

    shoppingContent.innerHTML = html;
}

// ===== SHOPPING HISTORY =====

// Display shopping history (previous weeks' lists)
async function displayShoppingHistory() {
    const historyItems = document.getElementById('historyItems');

    try {
        console.log('Loading shopping history...');

        // Fetch all shopping lists
        const response = await fetch(`${API_URL}/api/shopping-lists`);
        const data = await response.json();

        if (!data.success) {
            throw new Error('Failed to load shopping lists');
        }

        const allLists = data.shoppingLists;

        // Filter out current week's list
        const historicalLists = allLists.filter(list => {
            return !(list.semaine === currentWeek && list.annee === currentYear);
        });

        // Sort by week/year (most recent first)
        historicalLists.sort((a, b) => {
            if (a.annee !== b.annee) return b.annee - a.annee;
            return b.semaine - a.semaine;
        });

        console.log(`Found ${historicalLists.length} historical lists`);

        if (historicalLists.length === 0) {
            historyItems.innerHTML = '<p class="empty-shopping" style="padding: 10px; font-size: 12px;">Aucune liste précédente</p>';
            return;
        }

        // Display historical lists (v3.3.2: show full name with "Modifié" if applicable)
        let html = '';
        historicalLists.forEach(list => {
            // Use the full name from Airtable (includes "- Modifié" if modified)
            const displayName = list.nom || `Liste semaine ${list.semaine} - ${list.annee}`;
            html += `
                <div class="history-item" data-list-id="${list.id}">
                    <div class="history-item-title">📋 ${displayName}</div>
                    <div class="history-item-info">${list.nbItems} articles</div>
                </div>
            `;
        });

        historyItems.innerHTML = html;

        // Add click event listeners to history items
        const historyItemEls = document.querySelectorAll('.history-item');
        historyItemEls.forEach(item => {
            item.addEventListener('click', () => {
                const listId = item.dataset.listId;
                showHistoricalList(listId);
            });
        });

    } catch (error) {
        console.error('Error loading shopping history:', error);
        historyItems.innerHTML = '<p class="empty-shopping" style="padding: 10px; font-size: 12px;">Erreur de chargement</p>';
    }
}

// Show a historical shopping list in left popup
async function showHistoricalList(listId) {
    const historyPopup = document.getElementById('historyPopup');
    const historyPopupTitle = document.getElementById('historyPopupTitle');
    const historyPopupBody = document.getElementById('historyPopupBody');

    try {
        console.log('Loading historical list:', listId);

        // Fetch list from Airtable
        const response = await fetch(`${API_URL}/api/shopping-list/${listId}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error('Failed to load shopping list');
        }

        const list = data.shoppingList;

        // Update title
        historyPopupTitle.textContent = `Liste Semaine ${list.semaine} - ${list.annee}`;

        // Parse ingredients
        const ingredients = JSON.parse(list.ingredientsJSON || '[]');

        if (ingredients.length === 0) {
            historyPopupBody.innerHTML = '<p class="empty-shopping">Liste vide</p>';
        } else {
            // Group by category
            const byCategory = {};
            ingredients.forEach(item => {
                const category = item.category || 'Autre';
                if (!byCategory[category]) {
                    byCategory[category] = [];
                }
                byCategory[category].push(item);
            });

            // Generate HTML
            let html = '<div class="shopping-list">';

            const categories = Object.keys(byCategory).sort();

            categories.forEach(category => {
                html += `<div class="shopping-category">`;
                html += `<h4>${category}</h4>`;
                html += `<ul>`;

                byCategory[category].forEach(item => {
                    const quantityStr = item.quantity % 1 === 0
                        ? item.quantity
                        : item.quantity.toFixed(1);
                    html += `<li>${quantityStr} ${item.unit} ${item.name}</li>`;
                });

                html += `</ul>`;
                html += `</div>`;
            });

            html += '</div>';

            historyPopupBody.innerHTML = html;
        }

        // Show popup
        historyPopup.classList.add('active');

    } catch (error) {
        console.error('Error loading historical list:', error);
        alert('Erreur lors du chargement de la liste');
    }
}

// Close history popup
const closeHistoryPopup = document.getElementById('closeHistoryPopup');
const historyPopup = document.getElementById('historyPopup');

closeHistoryPopup.addEventListener('click', () => {
    historyPopup.classList.remove('active');
});

// Close on outside click
historyPopup.addEventListener('click', (e) => {
    if (e.target === historyPopup) {
        historyPopup.classList.remove('active');
    }
});

// ===== SHOPPING LIST V3.9 - CLEAN RESTART =====
// Simple shopping list: add ingredients to Airtable, sum if exists, display raw JSON

let currentListId = null; // ID of the current week's shopping list in Airtable

// Get or create shopping list for current week
async function getOrCreateShoppingList(week, year) {
    try {
        console.log(`📋 Getting shopping list for week ${week}-${year}`);

        // Try to find existing list for this week
        const response = await fetch(`${API_URL}/api/shopping-lists`);
        const data = await response.json();

        if (data.success) {
            const existingList = data.shoppingLists.find(list =>
                list.semaine === week && list.annee === year
            );

            if (existingList) {
                console.log(`✓ Found existing list: ${existingList.id}`);
                currentListId = existingList.id;
                return existingList;
            }
        }

        // Create new list if not found
        console.log(`✓ Creating new list for week ${week}-${year}`);
        const createResponse = await fetch(`${API_URL}/api/shopping-list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                semaine: week,
                annee: year,
                ingredients: [],
                repasInclus: {}
            })
        });

        const createData = await createResponse.json();
        if (createData.success && createData.shoppingList) {
            currentListId = createData.shoppingList.id;
            console.log(`✓ Created new list: ${currentListId}`);
            return {
                id: currentListId,
                ingredientsJSON: createData.shoppingList['Ingrédients JSON'] || '[]'
            };
        }

    } catch (error) {
        console.error('Error getting/creating shopping list:', error);
        return null;
    }
}

// Add ingredients to shopping list (sum if exists)
async function addIngredientsToShoppingList(recipe, servings) {
    try {
        console.log(`🛒 Adding ingredients for ${recipe.name} (${servings} pers)`);

        // Get or create list for current week
        const list = await getOrCreateShoppingList(currentWeek, currentYear);
        if (!list) {
            console.error('Failed to get/create shopping list');
            return;
        }

        // Parse recipe ingredients (multiplied by servings)
        const newIngredients = parseRecipeIngredients(recipe, servings);
        console.log(`  → Parsed ${newIngredients.length} ingredients`);

        // Get existing ingredients from list
        const existingIngredients = JSON.parse(list.ingredientsJSON || '[]');
        console.log(`  → Existing: ${existingIngredients.length} ingredients`);

        // Merge: sum quantities if ingredient name matches
        const mergedIngredients = [...existingIngredients];

        newIngredients.forEach(newIng => {
            const existing = mergedIngredients.find(ing =>
                ing.name === newIng.name && ing.unit === newIng.unit
            );

            if (existing) {
                // Sum quantities
                existing.quantity += newIng.quantity;
                console.log(`  ✓ Summed: ${newIng.name} (${existing.quantity}${existing.unit})`);
            } else {
                // Add new ingredient
                mergedIngredients.push(newIng);
                console.log(`  ✓ Added: ${newIng.name} (${newIng.quantity}${newIng.unit})`);
            }
        });

        // Update list in Airtable
        const updateResponse = await fetch(`${API_URL}/api/shopping-list/${currentListId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ingredients: mergedIngredients
            })
        });

        const updateData = await updateResponse.json();
        if (updateData.success) {
            console.log(`✅ Shopping list updated: ${mergedIngredients.length} ingredients`);
            // Display the updated list
            displayRawShoppingList(mergedIngredients);
        }

    } catch (error) {
        console.error('Error adding ingredients:', error);
    }
}

// Display raw JSON in shopping tab
function displayRawShoppingList(ingredients) {
    const shoppingContent = document.getElementById('shoppingContent');

    if (!ingredients || ingredients.length === 0) {
        shoppingContent.innerHTML = '<p class="empty-shopping">Aucun ingrédient dans la liste</p>';
        return;
    }

    // Group by category
    const byCategory = {};
    ingredients.forEach(ing => {
        const cat = ing.category || 'Autres';
        if (!byCategory[cat]) {
            byCategory[cat] = [];
        }
        byCategory[cat].push(ing);
    });

    // Sort categories alphabetically
    const sortedCategories = Object.keys(byCategory).sort();

    // Build HTML
    let html = '<div class="shopping-list-organized">';

    sortedCategories.forEach(category => {
        html += `<div class="ingredient-category">`;
        html += `<h4>${category}</h4>`;
        html += `<ul class="ingredients-list">`;

        // Sort ingredients by name within category
        byCategory[category].sort((a, b) => a.name.localeCompare(b.name));

        byCategory[category].forEach(ing => {
            const quantity = Math.round(ing.quantity * 100) / 100; // 2 decimals
            html += `<li>`;
            html += `<span class="ingredient-quantity">${quantity}${ing.unit}</span> `;
            html += `<span class="ingredient-name">${ing.name}</span>`;
            html += `</li>`;
        });

        html += `</ul></div>`;
    });

    html += '</div>';

    shoppingContent.innerHTML = html;
}

// Update shopping list when servings change (+/- buttons)
// Add or subtract ingredients for 1 person
async function updateShoppingListServings(recipe, oldServings, newServings) {
    try {
        const difference = newServings - oldServings;
        console.log(`📊 Servings changed: ${oldServings} → ${newServings} (diff: ${difference > 0 ? '+' : ''}${difference})`);

        // Get current shopping list
        const list = await getOrCreateShoppingList(currentWeek, currentYear);
        if (!list) {
            console.error('Failed to get shopping list');
            return;
        }

        // Parse recipe ingredients for 1 person
        const ingredientsFor1 = parseRecipeIngredients(recipe, 1);
        console.log(`  → Ingredients for 1 person: ${ingredientsFor1.length}`);

        // Get existing ingredients from list
        const existingIngredients = JSON.parse(list.ingredientsJSON || '[]');
        const mergedIngredients = [...existingIngredients];

        // Add or subtract difference × ingredients for 1 person
        ingredientsFor1.forEach(ing1 => {
            const existing = mergedIngredients.find(ing =>
                ing.name === ing1.name && ing.unit === ing1.unit
            );

            if (existing) {
                // Add or subtract quantity
                existing.quantity += (ing1.quantity * difference);
                console.log(`  ${difference > 0 ? '➕' : '➖'} ${ing1.name}: ${existing.quantity}${existing.unit}`);
            } else if (difference > 0) {
                // Only add if increasing (not decreasing non-existent ingredient)
                mergedIngredients.push({
                    ...ing1,
                    quantity: ing1.quantity * difference
                });
                console.log(`  ➕ ${ing1.name}: ${ing1.quantity * difference}${ing1.unit} (new)`);
            }
        });

        // Update list in Airtable
        const updateResponse = await fetch(`${API_URL}/api/shopping-list/${currentListId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ingredients: mergedIngredients
            })
        });

        const updateData = await updateResponse.json();
        if (updateData.success) {
            console.log(`✅ Shopping list updated after servings change`);
            displayRawShoppingList(mergedIngredients);
        }

    } catch (error) {
        console.error('Error updating shopping list servings:', error);
    }
}

// Remove ingredients from shopping list when deleting a meal
async function removeIngredientsFromShoppingList(recipe, servings) {
    try {
        console.log(`🗑️ Removing ingredients for ${recipe.name} (${servings} pers)`);

        // Get current shopping list
        const list = await getOrCreateShoppingList(currentWeek, currentYear);
        if (!list) {
            console.error('Failed to get shopping list');
            return;
        }

        // Parse recipe ingredients (multiplied by servings)
        const ingredientsToRemove = parseRecipeIngredients(recipe, servings);
        console.log(`  → Removing ${ingredientsToRemove.length} ingredients`);

        // Get existing ingredients from list
        const existingIngredients = JSON.parse(list.ingredientsJSON || '[]');
        const updatedIngredients = [];

        // Subtract quantities and filter out ingredients at 0 or below
        existingIngredients.forEach(existing => {
            const toRemove = ingredientsToRemove.find(ing =>
                ing.name === existing.name && ing.unit === existing.unit
            );

            if (toRemove) {
                // Subtract quantity
                const newQuantity = existing.quantity - toRemove.quantity;

                if (newQuantity > 0) {
                    // Keep ingredient with reduced quantity
                    updatedIngredients.push({
                        ...existing,
                        quantity: newQuantity
                    });
                    console.log(`  ➖ ${existing.name}: ${existing.quantity}${existing.unit} → ${newQuantity}${existing.unit}`);
                } else {
                    // Remove ingredient (quantity is 0 or negative)
                    console.log(`  ❌ ${existing.name}: removed (was ${existing.quantity}${existing.unit})`);
                }
            } else {
                // Keep ingredient that's not being removed
                updatedIngredients.push(existing);
            }
        });

        // Update list in Airtable
        const updateResponse = await fetch(`${API_URL}/api/shopping-list/${currentListId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ingredients: updatedIngredients
            })
        });

        const updateData = await updateResponse.json();
        if (updateData.success) {
            console.log(`✅ Shopping list updated after deletion (${updatedIngredients.length} ingredients remaining)`);
            displayRawShoppingList(updatedIngredients);
        }

    } catch (error) {
        console.error('Error removing ingredients:', error);
    }
}

// Load shopping list on page startup
async function loadShoppingListOnStartup() {
    try {
        console.log('📋 Loading shopping list for current week on startup...');

        // Get or create list for current week
        const list = await getOrCreateShoppingList(currentWeek, currentYear);
        if (!list) {
            console.log('No shopping list found');
            return;
        }

        // Parse and display ingredients
        const ingredients = JSON.parse(list.ingredientsJSON || '[]');
        displayRawShoppingList(ingredients);

        console.log(`✅ Loaded ${ingredients.length} ingredients from Airtable`);
    } catch (error) {
        console.error('Error loading shopping list on startup:', error);
    }
}

// ===== CRÉATION DE RECETTE (v3.10) =====

// Open create recipe popup
createRecipeBtn.addEventListener('click', () => {
    createRecipePopup.classList.add('active');
});

// Close create recipe popup
closeCreateRecipePopup.addEventListener('click', () => {
    createRecipePopup.classList.remove('active');
});

// Close on outside click
createRecipePopup.addEventListener('click', (e) => {
    if (e.target === createRecipePopup) {
        createRecipePopup.classList.remove('active');
    }
});

// Handle form submission
createRecipeForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Get form data
    const formData = {
        title: document.getElementById('recipeTitle').value,
        description: document.getElementById('recipeDescription').value,
        ingredients: document.getElementById('recipeIngredients').value,
        recipe: document.getElementById('recipeSteps').value
    };

    console.log('📝 Sending recipe to n8n:', formData);

    try {
        // Hide form, show loading
        createRecipeForm.style.display = 'none';
        recipeLoading.style.display = 'block';
        recipePreview.style.display = 'none';

        // Send to backend which will forward to n8n
        const response = await fetch(`${API_URL}/api/create-recipe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ n8n response:', result);
        console.log('✅ n8n response keys:', Object.keys(result));
        console.log('✅ n8n response stringified:', JSON.stringify(result, null, 2));

        // Store recipe data for Accept button
        currentRecipeData = result;

        // Display preview with n8n response
        displayRecipePreview(result);

        // Hide loading, show preview
        recipeLoading.style.display = 'none';
        recipePreview.style.display = 'block';

    } catch (error) {
        console.error('❌ Error sending to n8n:', error);
        alert('Erreur lors de la création de la recette. Veuillez réessayer.');

        // Hide loading, show form again
        recipeLoading.style.display = 'none';
        createRecipeForm.style.display = 'block';
    }
});

// Display recipe preview from n8n response
function displayRecipePreview(recipeData) {
    console.log('📄 Displaying recipe preview with data:', recipeData);

    let html = '';

    // Handle different response structures
    const data = recipeData.success ? recipeData : recipeData;

    console.log('📄 Processed data:', data);

    // Title
    if (data.title) {
        html += `<h4 style="color: #6b21a8; margin-bottom: 12px;">${data.title}</h4>`;
    }

    // Description
    if (data.description) {
        html += `<p style="font-style: italic; color: #666; margin-bottom: 16px;">${data.description}</p>`;
    }

    // Nutritional info
    if (data.calories || data.proteines || data.glucides || data.lipides) {
        html += `<div style="background: #faf5ff; padding: 12px; border-radius: 8px; margin-bottom: 16px;">`;
        html += `<p style="margin: 4px 0;"><strong>📊 Valeurs nutritionnelles :</strong></p>`;
        html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;">`;
        if (data.calories) html += `<p style="margin: 0;">🔥 ${data.calories} kcal</p>`;
        if (data.proteines) html += `<p style="margin: 0;">💪 ${data.proteines}g protéines</p>`;
        if (data.glucides) html += `<p style="margin: 0;">🍞 ${data.glucides}g glucides</p>`;
        if (data.lipides) html += `<p style="margin: 0;">🥑 ${data.lipides}g lipides</p>`;
        html += `</div></div>`;
    }

    // Ingredients (array of objects)
    if (data.ingredients) {
        html += `<div style="margin-bottom: 16px;">`;
        html += `<p style="margin-bottom: 8px;"><strong>🛒 Ingrédients :</strong></p>`;

        if (Array.isArray(data.ingredients)) {
            html += `<ul style="margin: 0; padding-left: 20px;">`;
            data.ingredients.forEach(ing => {
                const quantity = ing.quantite || ing.quantity || '';
                const unit = ing.unite || ing.unit || '';
                const ingredient = ing.ingredient || ing.name || '';
                // Add space between quantity and unit: "200 g de farine"
                html += `<li style="margin: 4px 0;">${quantity} ${unit} ${ingredient}</li>`;
            });
            html += `</ul>`;
        } else {
            // Fallback if it's a string
            html += `<p>${data.ingredients}</p>`;
        }
        html += `</div>`;
    }

    // Recipe steps (array of strings)
    if (data.recipe) {
        html += `<div style="margin-bottom: 16px;">`;
        html += `<p style="margin-bottom: 8px;"><strong>👨‍🍳 Préparation :</strong></p>`;

        if (Array.isArray(data.recipe)) {
            html += `<ol style="margin: 0; padding-left: 20px;">`;
            data.recipe.forEach(step => {
                html += `<li style="margin: 8px 0; line-height: 1.6;">${step}</li>`;
            });
            html += `</ol>`;
        } else {
            // Fallback if it's a string
            html += `<p>${data.recipe}</p>`;
        }
        html += `</div>`;
    }

    // If no content was added, show debug info
    if (html === '') {
        html = `<p style="color: red;"><strong>⚠️ Aucune donnée à afficher</strong></p>`;
        html += `<p>Structure reçue de n8n :</p>`;
        html += `<pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto;">${JSON.stringify(recipeData, null, 2)}</pre>`;
    }

    recipePreviewContent.innerHTML = html;
}

// Modify button - open modify popup with pre-filled data (v3.10.3)
recipeModifyBtn.addEventListener('click', () => {
    if (!currentRecipeData) {
        console.error('No recipe data to modify');
        return;
    }

    console.log('🔧 Opening modify popup with data:', currentRecipeData);

    // Pre-fill form fields with current recipe data
    document.getElementById('modifyTitle').value = currentRecipeData.title || '';
    document.getElementById('modifyDescription').value = currentRecipeData.description || '';

    // Convert ingredients array to text format
    if (Array.isArray(currentRecipeData.ingredients)) {
        const ingredientsText = currentRecipeData.ingredients.map(ing => {
            if (typeof ing === 'string') return ing;
            // Handle both formats: {quantity, unit, name} and {quantite, unite, ingredient}
            const quantity = ing.quantity || ing.quantite;
            const unit = ing.unit || ing.unite;
            const name = ing.name || ing.ingredient;
            // Format: "200 g de farine" with space between quantity and unit
            const quantityStr = quantity % 1 === 0 ? quantity : quantity.toFixed(1);
            return `${quantityStr} ${unit} de ${name}`;
        }).join('\n');
        document.getElementById('modifyIngredients').value = ingredientsText;
    } else {
        document.getElementById('modifyIngredients').value = currentRecipeData.ingredients || '';
    }

    // Convert recipe steps array to text format
    if (Array.isArray(currentRecipeData.recipe)) {
        document.getElementById('modifySteps').value = currentRecipeData.recipe.join('\n');
    } else {
        document.getElementById('modifySteps').value = currentRecipeData.recipe || '';
    }

    // Clear remark field
    document.getElementById('modifyRemark').value = '';

    // Show modify popup
    modifyRecipePopup.classList.add('active');
});

// Accept button - save recipe and close
recipeAcceptBtn.addEventListener('click', async () => {
    console.log('✅ Recipe accepted by user');

    try {
        // Disable button
        recipeAcceptBtn.disabled = true;
        recipeAcceptBtn.textContent = 'Enregistrement...';

        // Call backend to accept recipe with recipe data
        console.log('📤 Sending to accept webhook:', currentRecipeData);
        console.log('📤 JSON stringified:', JSON.stringify(currentRecipeData));

        const response = await fetch(`${API_URL}/api/accept-recipe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(currentRecipeData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Recipe accepted:', result);

        // Show success notification
        showNotification('Recette enregistrée avec succès !');

        // Reset and close
        createRecipeForm.reset();
        createRecipeForm.style.display = 'block';
        recipePreview.style.display = 'none';
        recipeLoading.style.display = 'none';
        createRecipePopup.classList.remove('active');

        // Re-enable button
        recipeAcceptBtn.disabled = false;
        recipeAcceptBtn.textContent = 'Accepter';

        // Reload recipes to show the new one
        await loadRecipes();

    } catch (error) {
        console.error('❌ Error accepting recipe:', error);
        showNotification('Erreur lors de l\'enregistrement', 'error');

        // Re-enable button
        recipeAcceptBtn.disabled = false;
        recipeAcceptBtn.textContent = 'Accepter';
    }
});

// Show notification popup
function showNotification(message, type = 'success') {
    notificationMessage.textContent = message;

    // Change style based on type
    const notificationContent = notificationPopup.querySelector('.notification-content');
    if (type === 'error') {
        notificationContent.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    } else {
        notificationContent.style.background = 'linear-gradient(135deg, #34d399 0%, #10b981 100%)';
    }

    // Show notification
    notificationPopup.classList.add('show');

    // Hide after 3 seconds
    setTimeout(() => {
        notificationPopup.classList.remove('show');
    }, 3000);
}

// ===== MODIFY RECIPE POPUP HANDLERS (v3.10.3) =====

// Close modify recipe popup
closeModifyRecipePopup.addEventListener('click', () => {
    modifyRecipePopup.classList.remove('active');
});

// Close on outside click
modifyRecipePopup.addEventListener('click', (e) => {
    if (e.target === modifyRecipePopup) {
        modifyRecipePopup.classList.remove('active');
    }
});

// Handle modify recipe form submission
modifyRecipeForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    console.log('🔧 Modifying recipe...');

    // Get form data
    const formData = new FormData(modifyRecipeForm);
    const remark = formData.get('remark');
    const title = formData.get('title');
    const description = formData.get('description');
    const ingredients = formData.get('ingredients');
    const recipe = formData.get('recipe');

    console.log('📝 Modification data:', { remark, title, description, ingredients, recipe });

    try {
        // Hide form, show loading
        modifyRecipeForm.style.display = 'none';
        modifyLoading.style.display = 'flex';

        // Prepare complete data with nutritional info from currentRecipeData
        const dataToSend = {
            remark,
            title,
            description,
            ingredients,
            recipe,
            calories: currentRecipeData?.calories || 0,
            proteines: currentRecipeData?.proteines || 0,
            glucides: currentRecipeData?.glucides || 0,
            lipides: currentRecipeData?.lipides || 0
        };

        console.log('📤 Sending complete data to webhook:', dataToSend);

        // Call backend to modify recipe
        const response = await fetch(`${API_URL}/api/modify-recipe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dataToSend)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Recipe modified successfully:', result);

        // Update currentRecipeData with modified recipe
        currentRecipeData = result;

        // Hide loading, close modify popup
        modifyLoading.style.display = 'none';
        modifyRecipeForm.style.display = 'block';
        modifyRecipePopup.classList.remove('active');

        // Update preview with modified recipe data
        displayRecipePreview(result);

        // Show success notification
        showNotification('Recette modifiée avec succès !');

    } catch (error) {
        console.error('❌ Error modifying recipe:', error);

        // Hide loading, show form again
        modifyLoading.style.display = 'none';
        modifyRecipeForm.style.display = 'block';

        // Show error notification
        showNotification('Erreur lors de la modification', 'error');
    }
});

// ===== DÉMARRAGE =====
init();
