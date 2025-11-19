/**
 * Gestionnaire de dialogues modaux (durci pour sanitation)
 *
 * - Par défaut n'autorise pas le HTML (safe).
 * - Pour rendre du HTML (ex: <br>, <strong>...), appeler show/confirm avec allowHtml: true.
 * - Si DOMPurify est présent, il est utilisé pour assainir le HTML.
 * - Sinon fallback sûr : on échappe le HTML puis on remplace les sauts de ligne par <br>.
 */
import { escapeHTML } from '../utils/sanitizers.js';


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
     * options:
     *  - title
     *  - htmlMessage : string
     *  - confirmText, cancelText
     *  - onConfirm, onCancel
     *  - allowHtml : boolean (false par défaut). Si true, on autorise le rendu HTML APRES sanitation via DOMPurify si présent.
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
            onCancel = null,
            allowHtml = false
        } = options;

        // Titre (toujours en texte)
        if (this.titleElement) {
            this.titleElement.textContent = title;
        }

        // Corps : deux modes
        if (this.bodyElement) {
            try {
                if (allowHtml) {
                    // Si DOMPurify existe, l'utiliser pour assainir le HTML
                    if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
                        this.bodyElement.innerHTML = window.DOMPurify.sanitize(String(htmlMessage));
                    } else {
                        // Fallback sûr : échapper l'HTML puis remplacer les sauts de ligne par <br>
                        const escaped = escapeHTML(String(htmlMessage));
                        // remplacer explicitement les balises <br> écrites dans la chaîne (ex: "...<br>...") n'auraient pas
                        // d'effet car on a échappé le HTML. Cependant on transforme les \n en <br> pour lisibilité.
                        this.bodyElement.innerHTML = escaped.replace(/\r?\n/g, '<br>');
                        console.warn('DOMPurify non trouvé — le HTML fourni a été échappé pour des raisons de sécurité. Pour rendre du HTML assaini, ajoutez DOMPurify.');
                    }
                } else {
                    // Mode texte sécurisé : afficher le message en texte (pas de HTML rendu)
                    const text = String(htmlMessage).replace(/\r?\n/g, '\n');
                    this.bodyElement.textContent = text;
                }
            } catch (err) {
                // En cas d'erreur, tomber en mode texte sécurisé
                this.bodyElement.textContent = String(htmlMessage);
                console.error('DialogManager render error:', err);
            }
        }

        // Cloner les boutons pour supprimer d'anciens listeners potentiels
        if (this.confirmBtn && this.confirmBtn.parentNode) {
            const newConfirmBtn = this.confirmBtn.cloneNode(true);
            this.confirmBtn.parentNode.replaceChild(newConfirmBtn, this.confirmBtn);
            this.confirmBtn = newConfirmBtn;
        }
        if (this.cancelBtn && this.cancelBtn.parentNode) {
            const newCancelBtn = this.cancelBtn.cloneNode(true);
            this.cancelBtn.parentNode.replaceChild(newCancelBtn, this.cancelBtn);
            this.cancelBtn = newCancelBtn;
        }

        // Configurer boutons
        if (onConfirm) {
            if (this.confirmBtn) {
                this.confirmBtn.style.display = 'inline-block';
                this.confirmBtn.textContent = confirmText;
                this.confirmBtn.addEventListener('click', () => {
                    try { onConfirm(); } catch (err) { console.error(err); }
                    this.hide();
                });
            }
            if (this.cancelBtn) {
                this.cancelBtn.textContent = cancelText;
                this.cancelBtn.addEventListener('click', () => {
                    if (onCancel) {
                        try { onCancel(); } catch (err) { console.error(err); }
                    }
                    this.hide();
                });
            }
        } else {
            // Mode information seule
            if (this.confirmBtn) this.confirmBtn.style.display = 'none';
            if (this.cancelBtn) {
                this.cancelBtn.textContent = 'Fermer';
                this.cancelBtn.addEventListener('click', () => {
                    if (onCancel) {
                        try { onCancel(); } catch (err) { console.error(err); }
                    }
                    this.hide();
                });
            }
        }

        // Afficher le modal
        if (this.modal) {
            this.modal.style.display = 'flex';
        }
    }

    hide() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
    }

    // Méthodes utilitaires, confirm affiche le HTML assaini par défaut (pratique pour les messages formatés)
    confirm(title, message, onConfirm, onCancel = null) {
        this.show({
            title,
            htmlMessage: message,
            confirmText: 'Oui',
            cancelText: 'Non',
            onConfirm,
            onCancel,
            allowHtml: true
        });
    }

    info(title, message, onClose = null) {
        this.show({
            title,
            htmlMessage: message,
            onCancel: onClose,
            allowHtml: false
        });
    }

    warning(message, onConfirm, onCancel = null) {
        this.show({
            title: '⚠️ Avertissement',
            htmlMessage: message,
            confirmText: 'Continuer',
            cancelText: 'Annuler',
            onConfirm,
            onCancel,
            allowHtml: true
        });
    }

    error(message, onClose = null) {
        this.show({
            title: '❌ Erreur',
            htmlMessage: message,
            onCancel: onClose,
            allowHtml: true
        });
    }

    success(message, onClose = null) {
        this.show({
            title: '✅ Succès',
            htmlMessage: message,
            onCancel: onClose,
            allowHtml: true
        });
    }
}

export default new DialogManager();