/**
 * Gestionnaire de dialogues modaux
 * @author Ibrahim Mrani - UCD
 */

class DialogManager {
    constructor() {
        this.modal = null;
        this.titleElement = null;
        this.bodyElement = null;
        this.confirmBtn = null;
        this.cancelBtn = null;
        this.closeBtn = null;
        this.initialized = false;
    }

    /**
     * Initialise le gestionnaire avec les éléments DOM
     * @param {string} modalId - L'ID du modal
     */
    init(modalId = 'dialogModal') {
        this.modal = document.getElementById(modalId);
        
        if (!this.modal) {
            console.warn(`Modal #${modalId} not found`);
            return;
        }

        this.titleElement = this.modal.querySelector('#dialogTitle');
        this.bodyElement = this.modal.querySelector('#dialogBody');
        this.confirmBtn = this.modal.querySelector('#dialogConfirmBtn');
        this.cancelBtn = this.modal.querySelector('#dialogCancelBtn');
        this.closeBtn = this.modal.querySelector('#closeDialogBtn');

        // Event listeners pour fermeture
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.hide());
        }

        // Fermeture si clic en dehors du dialogue
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });

        this.initialized = true;
    }

    /**
     * Affiche un dialogue
     * @param {Object} options - Les options du dialogue
     * @param {string} options.title - Le titre
     * @param {string} options.htmlMessage - Le message (HTML autorisé)
     * @param {string} options.confirmText - Texte du bouton confirmer
     * @param {string} options.cancelText - Texte du bouton annuler
     * @param {Function} options.onConfirm - Callback de confirmation
     * @param {Function} options.onCancel - Callback d'annulation
     */
    show(options = {}) {
        if (!this.initialized) {
            console.warn('DialogManager not initialized');
            return;
        }

        const {
            title = 'Notification',
            htmlMessage = '',
            confirmText = 'Confirmer',
            cancelText = 'Annuler',
            onConfirm = null,
            onCancel = null
        } = options;

        // Définir le titre et le message
        if (this.titleElement) {
            this.titleElement.textContent = title;
        }

        if (this.bodyElement) {
            this.bodyElement.innerHTML = htmlMessage;
        }

        // Cloner les boutons pour supprimer les anciens listeners
        const newConfirmBtn = this.confirmBtn.cloneNode(true);
        this.confirmBtn.parentNode.replaceChild(newConfirmBtn, this.confirmBtn);
        this.confirmBtn = newConfirmBtn;

        const newCancelBtn = this.cancelBtn.cloneNode(true);
        this.cancelBtn.parentNode.replaceChild(newCancelBtn, this.cancelBtn);
        this.cancelBtn = newCancelBtn;

        // Configurer les boutons
        if (onConfirm) {
            this.confirmBtn.style.display = 'inline-block';
            this.cancelBtn.textContent = cancelText;
            this.confirmBtn.textContent = confirmText;

            this.confirmBtn.addEventListener('click', () => {
                onConfirm();
                this.hide();
            });

            this.cancelBtn.addEventListener('click', () => {
                if (onCancel) {
                    onCancel();
                }
                this.hide();
            });
        } else {
            // Mode information seule
            this.confirmBtn.style.display = 'none';
            this.cancelBtn.textContent = 'Fermer';

            this.cancelBtn.addEventListener('click', () => {
                if (onCancel) {
                    onCancel();
                }
                this.hide();
            });
        }

        // Afficher le modal
        this.modal.style.display = 'flex';
    }

    /**
     * Masque le dialogue
     */
    hide() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
    }

    /**
     * Affiche un dialogue de confirmation
     * @param {string} title - Le titre
     * @param {string} message - Le message
     * @param {Function} onConfirm - Callback si confirmé
     * @param {Function} onCancel - Callback si annulé
     */
    confirm(title, message, onConfirm, onCancel = null) {
        this.show({
            title,
            htmlMessage: message,
            confirmText: 'Oui',
            cancelText: 'Non',
            onConfirm,
            onCancel
        });
    }

    /**
     * Affiche un dialogue d'information
     * @param {string} title - Le titre
     * @param {string} message - Le message
     * @param {Function} onClose - Callback à la fermeture
     */
    info(title, message, onClose = null) {
        this.show({
            title,
            htmlMessage: message,
            onCancel: onClose
        });
    }

    /**
     * Affiche un dialogue d'avertissement
     * @param {string} message - Le message
     * @param {Function} onConfirm - Callback si confirmé
     */
    warning(message, onConfirm, onCancel = null) {
        this.show({
            title: '⚠️ Avertissement',
            htmlMessage: message,
            confirmText: 'Continuer',
            cancelText: 'Annuler',
            onConfirm,
            onCancel
        });
    }

    /**
     * Affiche un dialogue d'erreur
     * @param {string} message - Le message d'erreur
     * @param {Function} onClose - Callback à la fermeture
     */
    error(message, onClose = null) {
        this.show({
            title: '❌ Erreur',
            htmlMessage: message,
            onCancel: onClose
        });
    }

    /**
     * Affiche un dialogue de succès
     * @param {string} message - Le message de succès
     * @param {Function} onClose - Callback à la fermeture
     */
    success(message, onClose = null) {
        this.show({
            title: '✅ Succès',
            htmlMessage: message,
            onCancel: onClose
        });
    }
}

// Export d'une instance singleton
export default new DialogManager();