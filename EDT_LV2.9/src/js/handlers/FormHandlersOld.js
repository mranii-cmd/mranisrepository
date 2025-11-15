/**
 * Gestionnaire des événements de formulaires
 * @author Ibrahim Mrani - UCD
 */

import FormManager from '../ui/FormManager.js';
import SessionController from '../controllers/SessionController.js';
import StateManager from '../controllers/StateManager.js';
import LogService from '../services/LogService.js';
import NotificationManager from '../ui/NotificationManager.js';
import DialogManager from '../ui/DialogManager.js';
import TableRenderer from '../ui/TableRenderer.js';
import SchedulingService from '../services/SchedulingService.js'; // <-- ajouté

class FormHandlers {
    /**
     * Gère la soumission du formulaire de séance
     * @param {Event} event - L'événement de soumission
     */
    handleSeanceFormSubmit(event) {
        event.preventDefault();

        const formData = FormManager.getSeanceFormData();

        if (FormManager.currentMode === 'edit') {
            // Mode édition
            const result = SessionController.updateSession(
                FormManager.editingSessionId,
                formData
            );

            if (result.success) {
                NotificationManager.success('Séance modifiée avec succès');
                FormManager.resetSeanceForm();
                TableRenderer.render();
            }
        } else {
            // Mode création
            const result = SessionController.createSession(formData);

            if (result.success) {
                NotificationManager.success('Séance ajoutée avec succès');
                FormManager.resetSeanceForm();
                TableRenderer.render();
            }
        }
    }

    /**
     * Gère l'annulation de l'édition d'une séance
     */
    handleCancelSeanceEdit() {
        FormManager.resetSeanceForm();
        NotificationManager.info('Édition annulée', 2000);
    }

    /**
     * Gère la soumission du formulaire de matière
     * @param {Event} event - L'événement de soumission
     */
    async handleMatiereFormSubmit(event) {
        event.preventDefault();

        const data = FormManager.getMatiereFormData();

        if (!data.nom) {
            DialogManager.error('Veuillez saisir un nom de matière.');
            return;
        }

        if (StateManager.state.matiereGroupes[data.nom]) {
            DialogManager.error(`La matière "${data.nom}" existe déjà.`);
            return;
        }

        const success = StateManager.addSubject(data.nom, data);

        if (success) {
            LogService.success(`✅ Matière "${data.nom}" ajoutée`);
            NotificationManager.success('Matière ajoutée');
            FormManager.resetMatiereForm();
            StateManager.saveState();
            
            // Recharger les listes déroulantes
            window.EDTApp?.populateFormSelects();

            // Génération automatique des séances pour la matière nouvellement créée
            try {
                // Récupérer l'objet Subject (modèle) depuis le StateManager
                const subject = StateManager.getSubjects().find(s => s.nom === data.nom);
                if (subject) {
                    // Générer uniquement les séances (sans attribuer enseignants/salles)
                    await SchedulingService.autoGenerateSubjectSessions(subject, {
                        assignTeachers: false,
                        assignRooms: false,
                        respectWishes: false,
                        avoidConflicts: false
                    });

                    // Sauvegarder et re-rendre le planning
                    StateManager.saveState();
                    TableRenderer.render();

                    NotificationManager.success(`Séances générées pour ${data.nom}`, 3000);
                }
            } catch (err) {
                LogService.error(`Erreur génération séances pour ${data.nom} : ${err.message}`);
                NotificationManager.warning(`La matière a été ajoutée mais la génération automatique a échoué.`);
            }
        }
    }

    /**
     * Gère la soumission du formulaire d'enseignant
     * @param {Event} event - L'événement de soumission
     */
    handleEnseignantFormSubmit(event) {
        event.preventDefault();

        const data = FormManager.getEnseignantFormData();

        if (!data.nom || data.nom.trim() === '') {
            DialogManager.error('Veuillez saisir un nom d\'enseignant.');
            return;
        }

        if (StateManager.state.enseignants.includes(data.nom)) {
            DialogManager.error(`L'enseignant "${data.nom}" existe déjà.`);
            return;
        }

        const success = StateManager.addTeacher(data.nom);

        if (success) {
            LogService.success(`✅ Enseignant "${data.nom}" ajouté`);
            NotificationManager.success('Enseignant ajouté');
            FormManager.resetEnseignantForm();
            StateManager.saveState();
        }
    }

    /**
     * Gère la soumission du formulaire de salle
     * @param {Event} event - L'événement de soumission
     */
    handleSalleFormSubmit(event) {
        event.preventDefault();

        const data = FormManager.getSalleFormData();

        if (!data.nom || data.nom.trim() === '') {
            DialogManager.error('Veuillez saisir un nom de salle.');
            return;
        }

        if (StateManager.state.sallesInfo[data.nom]) {
            DialogManager.error(`La salle "${data.nom}" existe déjà.`);
            return;
        }

        StateManager.state.sallesInfo[data.nom] = data.type;
        LogService.success(`✅ Salle "${data.nom}" (${data.type}) ajoutée`);
        NotificationManager.success('Salle ajoutée');
        FormManager.resetSalleForm();
        StateManager.saveState();
        
        // Recharger les listes déroulantes
        window.EDTApp?.populateFormSelects();
    }

    /**
     * Gère la soumission du formulaire de filière
     * @param {Event} event - L'événement de soumission
     */
    handleFiliereFormSubmit(event) {
        event.preventDefault();

        const data = FormManager.getFiliereFormData();

        if (!data.nom || data.nom.trim() === '') {
            DialogManager.error('Veuillez saisir un nom de filière.');
            return;
        }

        const exists = StateManager.state.filieres.some(f => f.nom === data.nom);
        if (exists) {
            DialogManager.error(`La filière "${data.nom}" existe déjà.`);
            return;
        }

        StateManager.state.filieres.push({
            nom: data.nom,
            session: data.session
        });

        LogService.success(`✅ Filière "${data.nom}" (${data.session}) ajoutée`);
        NotificationManager.success('Filière ajoutée');
        FormManager.resetFiliereForm();
        StateManager.saveState();
        
        // Recharger les listes déroulantes
        window.EDTApp?.populateFormSelects();
    }

    /**
     * Attribue rapidement la séance configurée à une cellule
     * @param {string} jour - Le jour
     * @param {string} creneau - Le créneau
     */
    attribuerSeanceDirectement(jour, creneau) {
        const formData = FormManager.getSeanceFormData();

        // Surcharger le jour et le créneau
        formData.jour = jour;
        formData.creneau = creneau;

        const result = SessionController.createSession(formData);

        if (result.success) {
            LogService.success(`✅ Séance attribuée à ${jour} ${creneau}`);
            NotificationManager.success('Séance attribuée', 2000);
            TableRenderer.render();
        }
    }
}

// Export d'une instance singleton
export default new FormHandlers();