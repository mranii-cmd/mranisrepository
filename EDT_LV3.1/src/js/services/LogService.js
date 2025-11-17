/**
 * Service de gestion des logs et messages
 * @author Ibrahim Mrani - UCD
 */

import { LOG_TYPES } from '../config/constants.js';
import { safeText } from '../utils/sanitizers.js';

class LogService {
    constructor() {
        this.messagesContainer = null;
        this.initialized = false;
    }

    /**
     * Initialise le service avec le conteneur de messages
     * @param {string} containerId - L'ID du conteneur DOM
     */
    init(containerId = 'messages') {
        this.messagesContainer = document.getElementById(containerId);
        if (this.messagesContainer) {
            this.initialized = true;
        } else {
            console.warn(`Container #${containerId} not found for LogService`);
        }
    }

    /**
     * Ajoute un message au journal
     * @param {string} message - Le message à logger
     * @param {string} type - Le type de message (success, error, warning, initial)
     * @param {boolean} allowHtml - Permet le HTML dans le message
     */
    log(message, type = LOG_TYPES.INITIAL, allowHtml = false) {
        if (!this.initialized) {
            console.warn('LogService not initialized');
            console.log(`[${type}] ${message}`);
            return;
        }

        const p = document.createElement('p');
        p.className = type;
        
        if (allowHtml) {
            p.innerHTML = String(message);
        } else {
            p.textContent = String(message);
        }

        // Ajouter en haut de la liste (prepend)
        this.messagesContainer.prepend(p);

        // Limiter le nombre de messages (optionnel)
        this.trimLogs(100);
    }

    /**
     * Log avec HTML sécurisé
     * @param {string} message - Le message (peut contenir des balises <strong>, etc.)
     * @param {string} type - Le type de message
     */
    logHtml(message, type = LOG_TYPES.INITIAL) {
        this.log(message, type, true);
    }

    /**
     * Log de succès
     * @param {string} message - Le message
     */
    success(message) {
        this.log(message, LOG_TYPES.SUCCESS);
    }

    /**
     * Log d'erreur
     * @param {string} message - Le message
     */
    error(message) {
        this.log(message, LOG_TYPES.ERROR);
    }

    /**
     * Log d'avertissement
     * @param {string} message - Le message
     */
    warning(message) {
        this.log(message, LOG_TYPES.WARNING);
    }

    /**
     * Log informatif
     * @param {string} message - Le message
     */
    info(message) {
        this.log(message, LOG_TYPES.INITIAL);
    }

    /**
     * Vide le journal
     */
    clear() {
        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = '';
            this.log('🗑️ Journal des opérations vidé.', LOG_TYPES.INITIAL);
        }
    }

    /**
     * Limite le nombre de messages affichés
     * @param {number} maxMessages - Nombre maximum de messages
     */
    trimLogs(maxMessages = 100) {
        if (!this.messagesContainer) return;

        const messages = this.messagesContainer.children;
        while (messages.length > maxMessages) {
            this.messagesContainer.removeChild(messages[messages.length - 1]);
        }
    }

    /**
     * Obtient tous les messages
     * @returns {Array<Object>} Les messages { text, type }
     */
    getMessages() {
        if (!this.messagesContainer) return [];

        return Array.from(this.messagesContainer.children).map(p => ({
            text: p.textContent,
            type: p.className
        }));
    }

    /**
     * Export des logs en texte
     * @returns {string} Les logs formatés
     */
    exportLogs() {
        const messages = this.getMessages();
        return messages.map(m => `[${m.type.toUpperCase()}] ${m.text}`).join('\n');
    }
}

// Export d'une instance singleton
export default new LogService();