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

// Éléments DOM
const recipesList = document.getElementById('recipesList');
const calendar = document.getElementById('calendar');
const sidebar = document.getElementById('sidebar');
const toggleSidebar = document.getElementById('toggleSidebar');
const showSidebar = document.getElementById('showSidebar');
const refreshRecipes = document.getElementById('refreshRecipes');
const recipePopup = document.getElementById('recipePopup');
const closePopup = document.getElementById('closePopup');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const chatMessages = document.getElementById('chatMessages');
const prevWeek = document.getElementById('prevWeek');
const nextWeek = document.getElementById('nextWeek');
const weekDisplay = document.getElementById('weekDisplay');
const searchRecipes = document.getElementById('searchRecipes');
const generateListBtn = document.getElementById('generateList');
const exportListBtn = document.getElementById('exportList');
const clearListBtn = document.getElementById('clearList');
const shoppingContent = document.getElementById('shoppingContent');
const settingsBtn = document.getElementById('settingsBtn');
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
    initializeMealInclusions();
    setupEventListeners();
    setupTabs();
}

// ===== METTRE À JOUR L'AFFICHAGE DE LA SEMAINE =====
function updateWeekDisplay() {
    weekDisplay.textContent = `Semaine ${currentWeek} - ${currentYear}`;
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
        mealContent.innerHTML = `
            <div class="planned-recipe" data-record-id="${item.id}" data-recipe-id="${item.recipe[0] || ''}">
                <span class="recipe-name-text">${recipeName}</span>
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
                showRecipePopup(recipeData);
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
                year: currentYear
            })
        });

        const data = await response.json();

        if (data.success && data.record) {
            // Mettre à jour avec le bouton delete
            const recordId = data.record.id;
            mealContent.innerHTML = `
                <div class="planned-recipe" data-record-id="${recordId}" data-recipe-id="${recipeId}">
                    <span class="recipe-name-text">${recipeName}</span>
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
                    showRecipePopup(recipe);
                }
            });

            // Mettre à jour le résumé nutritionnel du jour
            updateDaySummary(day);
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

            console.log('Recipe deleted successfully');
        } else {
            alert('Erreur lors de la suppression');
        }
    } catch (error) {
        console.error('Error deleting recipe:', error);
        alert('Erreur lors de la suppression');
    }
}

// ===== POPUP RECETTE =====
function showRecipePopup(recipe) {
    const popupTitle = document.getElementById('popupTitle');
    const popupBody = document.getElementById('popupBody');

    popupTitle.textContent = recipe.name;

    popupBody.innerHTML = `
        <div class="popup-section">
            <strong>Tags:</strong>
            ${recipe.tags.join(', ') || 'Aucun'}
        </div>
        <div class="popup-section">
            <strong>Informations nutritionnelles:</strong>
            <ul>
                <li>Protéines: ${recipe.proteins}g</li>
                <li>Glucides: ${recipe.carbs}g</li>
                <li>Lipides: ${recipe.fats}g</li>
            </ul>
        </div>
        <div class="popup-section">
            <strong>Portions:</strong>
            ${recipe.servings} personne(s)
        </div>
    `;

    recipePopup.classList.add('active');
}

closePopup.addEventListener('click', () => {
    recipePopup.classList.remove('active');
});

recipePopup.addEventListener('click', (e) => {
    if (e.target === recipePopup) {
        recipePopup.classList.remove('active');
    }
});

// ===== CHAT BOT =====
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const message = messageInput.value.trim();
    if (!message) return;

    // Ajouter le message utilisateur
    addChatMessage(message, 'user');
    messageInput.value = '';

    try {
        const response = await fetch(`${API_URL}/api/send-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });

        const data = await response.json();

        if (data.success) {
            addChatMessage(data.response, 'bot');
        }
    } catch (error) {
        console.error('Chat error:', error);
        addChatMessage('Erreur de connexion au bot', 'bot');
    }
});

function addChatMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;

    messageDiv.innerHTML = `
        <div class="message-content">
            <p>${text}</p>
        </div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ===== TOGGLE SIDEBAR =====
toggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    toggleSidebar.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';

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
    toggleSidebar.textContent = '◀';
    showSidebar.classList.remove('visible');
});

// ===== REFRESH RECIPES =====
refreshRecipes.addEventListener('click', async () => {
    refreshRecipes.style.opacity = '0.5';
    refreshRecipes.disabled = true;

    await loadRecipes();

    refreshRecipes.style.opacity = '1';
    refreshRecipes.disabled = false;
});

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
    initializeMealInclusions();
}

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

// ===== GESTION DES ONGLETS =====
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;

            // Retirer l'active de tous les boutons et contenus
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Activer le bouton et contenu sélectionné
            btn.classList.add('active');
            document.getElementById(`${targetTab}Tab`).classList.add('active');
        });
    });
}

// ===== LISTE DE COURSES =====

// Initialize meal inclusions (all meals included by default)
function initializeMealInclusions() {
    mealInclusions = {};
    planning.forEach((item, index) => {
        mealInclusions[index] = true; // true = included (green), false = excluded (red)
    });
}

// Open settings popup
settingsBtn.addEventListener('click', () => {
    settingsWeek = currentWeek;
    settingsYear = currentYear;
    initializeSettingsPopup();
    shoppingSettingsPopup.classList.add('active');
});

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
applySettings.addEventListener('click', () => {
    generateShoppingList();
    shoppingSettingsPopup.classList.remove('active');
});

// Initialize settings popup
function initializeSettingsPopup() {
    // Display planning grid
    displaySettingsCalendar();

    // Display current shopping list for editing
    displayEditableShoppingList();
}

// Display planning in settings popup
async function displaySettingsCalendar() {
    // Update week display
    settingsWeekDisplay.textContent = `Semaine ${settingsWeek} - ${settingsYear}`;

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

                let boxClass = 'settings-meal-box';
                if (!isCurrentWeek) {
                    // Yellow for other weeks, with green border if included
                    boxClass += isIncluded ? ' other-week-included' : ' other-week-excluded';
                } else {
                    boxClass += isIncluded ? ' included' : ' excluded';
                }

                const mealBox = document.createElement('div');
                mealBox.className = boxClass;
                mealBox.textContent = recipeName;
                mealBox.dataset.globalKey = globalKey;
                mealBox.dataset.isCurrentWeek = isCurrentWeek;

                // Toggle inclusion/exclusion
                mealBox.addEventListener('click', () => {
                    mealInclusions[globalKey] = !mealInclusions[globalKey];
                    const nowIncluded = mealInclusions[globalKey];
                    const isCurrent = mealBox.dataset.isCurrentWeek === 'true';

                    // Update color
                    if (!isCurrent) {
                        // Yellow for other weeks, border changes based on inclusion
                        mealBox.className = `settings-meal-box ${nowIncluded ? 'other-week-included' : 'other-week-excluded'}`;
                    } else {
                        mealBox.className = `settings-meal-box ${nowIncluded ? 'included' : 'excluded'}`;
                    }
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
                    <input type="number" class="ingredient-qty" value="${quantityStr}" step="0.1" min="0">
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
        });
    });

    document.querySelectorAll('.ingredient-unit').forEach(select => {
        select.addEventListener('change', (e) => {
            const index = parseInt(e.target.closest('.editable-ingredient').dataset.index);
            shoppingList[index].unit = e.target.value;
        });
    });

    document.querySelectorAll('.ingredient-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            shoppingList.splice(index, 1);
            displayEditableShoppingList();
            displayShoppingList(); // Update main display
        });
    });
}

// Clear shopping list
clearListBtn.addEventListener('click', () => {
    if (confirm('Voulez-vous vraiment vider la liste de courses ?')) {
        shoppingList = [];
        shoppingContent.innerHTML = '<p class="empty-shopping">La liste a été vidée.</p>';
    }
});

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

// Générer la liste de courses
generateListBtn.addEventListener('click', () => {
    console.log('Génération de la liste de courses...');
    initializeMealInclusions(); // Reset to all included
    generateShoppingList();
});

function generateShoppingList() {
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
                                    const name = item.ingredient;
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
            html += `<li>${quantityStr} ${item.unit} ${item.name}</li>`;
        });

        html += `</ul>`;
        html += `</div>`;
    });

    html += '</div>';

    shoppingContent.innerHTML = html;
}

// ===== DÉMARRAGE =====
init();
