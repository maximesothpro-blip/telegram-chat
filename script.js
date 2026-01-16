// Éléments DOM
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const chatMessages = document.getElementById('chatMessages');
const sendButton = document.getElementById('sendButton');
const typingIndicator = document.getElementById('typingIndicator');
const statusIndicator = document.querySelector('.status-indicator');
const statusText = document.querySelector('.status-text');

// Configuration
const API_URL = window.BACKEND_API_URL || 'http://localhost:3000';

// Vérifier la connexion au backend au chargement
checkBackendStatus();

// Gestionnaire de soumission du formulaire
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const message = messageInput.value.trim();
    if (!message) return;

    // Ajouter le message de l'utilisateur
    addMessage(message, 'user');

    // Vider l'input
    messageInput.value = '';

    // Désactiver le formulaire pendant l'envoi
    setFormState(false);

    // Afficher l'indicateur de saisie
    typingIndicator.classList.add('active');

    try {
        // Envoyer le message au backend
        const response = await fetch(`${API_URL}/api/send-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                userId: getChatId()
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erreur lors de l\'envoi du message');
        }

        const data = await response.json();

        // Masquer l'indicateur de saisie
        typingIndicator.classList.remove('active');

        // Ajouter la réponse du bot
        if (data.response) {
            addMessage(data.response, 'bot');
        }

    } catch (error) {
        console.error('Error:', error);
        typingIndicator.classList.remove('active');

        // Afficher un message d'erreur
        addMessage(
            `Erreur: ${error.message}. Veuillez vérifier que le backend est en ligne.`,
            'bot',
            true
        );

        updateStatus(false);
    } finally {
        // Réactiver le formulaire
        setFormState(true);
        messageInput.focus();
    }
});

// Fonction pour ajouter un message au chat
function addMessage(text, sender, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    if (isError) {
        contentDiv.style.background = '#fee2e2';
        contentDiv.style.border = '1px solid #fca5a5';
        contentDiv.style.color = '#991b1b';
    }

    const textP = document.createElement('p');
    textP.textContent = text;
    contentDiv.appendChild(textP);

    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = getTimeString();

    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);

    chatMessages.appendChild(messageDiv);

    // Scroller vers le bas
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Fonction pour obtenir l'heure actuelle
function getTimeString() {
    const now = new Date();
    return now.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Fonction pour activer/désactiver le formulaire
function setFormState(enabled) {
    messageInput.disabled = !enabled;
    sendButton.disabled = !enabled;
}

// Fonction pour obtenir ou créer un chat ID
function getChatId() {
    let chatId = localStorage.getItem('telegram_chat_id');
    if (!chatId) {
        chatId = 'web_user_' + Date.now();
        localStorage.setItem('telegram_chat_id', chatId);
    }
    return chatId;
}

// Fonction pour vérifier le statut du backend
async function checkBackendStatus() {
    try {
        const response = await fetch(`${API_URL}/health`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            updateStatus(true);
        } else {
            updateStatus(false);
        }
    } catch (error) {
        console.error('Backend health check failed:', error);
        updateStatus(false);
    }
}

// Fonction pour mettre à jour le statut visuel
function updateStatus(isOnline) {
    if (isOnline) {
        statusIndicator.style.background = '#4ade80';
        statusText.textContent = 'En ligne';
    } else {
        statusIndicator.style.background = '#f87171';
        statusText.textContent = 'Hors ligne';
    }
}

// Focus automatique sur l'input au chargement
messageInput.focus();

// Vérifier le statut toutes les 30 secondes
setInterval(checkBackendStatus, 30000);
