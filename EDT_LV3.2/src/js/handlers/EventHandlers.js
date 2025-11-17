/**
 * Gestionnaire global des événements DOM (nettoyé)
 * @author ...
 */
import SessionController from '../controllers/SessionController.js';
import StateManager from '../controllers/StateManager.js';
import DialogManager from '../ui/DialogManager.js';
import TableRenderer from '../ui/TableRenderer.js';
import FormManager from '../ui/FormManager.js';
import FormHandlers from './FormHandlers.js';
import { escapeHTML } from '../utils/sanitizers.js';

class EventHandlers {
    constructor() {
        this.draggedSessionId = null;
    }

    /**
     * Supprime une séance
     * @param {number} id - L'ID de la séance
     */
    supprimerSeance(id) {
        const seance = StateManager.findSeanceById(id);
        if (!seance) return;

        DialogManager.confirm(
            'Supprimer la Séance',
            `Voulez-vous vraiment supprimer cette séance de <strong>${seance.matiere}</strong> ?`,
            () => {
                SessionController.deleteSession(id);
                TableRenderer.render();
            }
        );
    }

    /**
     * Ouvre le formulaire pour modifier une séance
     * @param {number} id - L'ID de la séance
     */
    ouvrirFormulairePourModifier(id) {
        const seance = StateManager.findSeanceById(id);
        if (!seance) return;

        FormManager.fillSeanceForm(seance);
    }

    /**
     * Attribue directement la séance configurée dans le formulaire
     * @param {string} jour - Le jour
     * @param {string} creneau - Le créneau
     */
    attribuerSeanceDirectement(jour, creneau) {
        FormHandlers.attribuerSeanceDirectement(jour, creneau);
    }

    /**
     * Gère le début du drag
     * @param {Event} event - L'événement
     * @param {number} sessionId - L'ID de la séance
     */
    handleDragStart(event, sessionId) {
        this.draggedSessionId = sessionId;
        try {
            event.dataTransfer.setData('text/plain', sessionId);
            event.dataTransfer.effectAllowed = 'move';
        } catch (err) {
            // certains navigateurs/restreints peuvent lancer une erreur
            console.warn('dataTransfer non disponible', err);
        }
        setTimeout(() => {
            if (event.target) event.target.style.opacity = '0.5';
        }, 0);
    }

    /**
     * Gère la fin du drag
     * @param {Event} event - L'événement
     */
    handleDragEnd(event) {
        if (event.target) event.target.style.opacity = '1';
        this.draggedSessionId = null;
        document.querySelectorAll('#edtTable td').forEach(cell => {
            cell.classList.remove('drop-target-active', 'cellule-conflit');
        });
    }

    /**
     * Gère le survol pendant le drag
     * @param {Event} event - L'événement
     */
    handleDragOver(event) {
        event.preventDefault();
        const targetCell = event.target.closest('td[data-jour]');
        if (!targetCell || !this.draggedSessionId) return;
        targetCell.classList.add('drop-target-active');
    }

    /**
     * Gère la sortie du survol
     * @param {Event} event - L'événement
     */
    handleDragLeave(event) {
        const targetCell = event.target.closest('td');
        if (targetCell) {
            targetCell.classList.remove('drop-target-active');
        }
    }

    /**
     * Gère le drop
     * @param {Event} event - L'événement
     */
    handleDrop(event) {
        event.preventDefault();

        const targetCell = event.target.closest('td[data-jour]');
        // Clear visual feedback
        document.querySelectorAll('.drop-target-active, .cellule-conflit').forEach(cell => {
            cell.classList.remove('drop-target-active', 'cellule-conflit');
        });

        if (!targetCell || !this.draggedSessionId) return;

        const newJour = targetCell.dataset.jour;
        const newCreneau = targetCell.dataset.creneau;

        SessionController.moveSession(this.draggedSessionId, newJour, newCreneau);
        TableRenderer.render();

        this.draggedSessionId = null;
    }
}

// Export d'une instance singleton
export default new EventHandlers();