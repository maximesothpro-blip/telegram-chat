// Configuration
const API_URL = window.BACKEND_API_URL || 'http://localhost:3000';

// État global
let recipes = [];
let currentWeek = getCurrentWeek();
let currentYear = new Date().getFullYear();

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

// Jours de la semaine
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MEALS = ['Déjeuner', 'Dîner'];

// ===== INITIALISATION =====
async function init() {
    await loadRecipes();
    createCalendar();
    setupEventListeners();
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

    // Afficher immédiatement dans l'UI
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
                recipeId: recipeId
            })
        });

        const data = await response.json();

        if (!data.success) {
            console.error('Failed to save to Airtable');
            // Optionnel: afficher un message d'erreur
        }
    } catch (error) {
        console.error('Error saving to Airtable:', error);
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

// ===== DÉMARRAGE =====
init();
