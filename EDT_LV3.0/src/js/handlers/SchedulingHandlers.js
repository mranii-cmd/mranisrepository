/**
 * Gestionnaire des fonctions de planification automatique
 * @author Ibrahim Mrani - UCD
 */

import SchedulingService from '../services/SchedulingService.js';
import StateManager from '../controllers/StateManager.js';
import LogService from '../services/LogService.js';
import DialogManager from '../ui/DialogManager.js';
import SpinnerManager from '../ui/SpinnerManager.js';
import NotificationManager from '../ui/NotificationManager.js';
import TableRenderer from '../ui/TableRenderer.js';

class SchedulingHandlers {
    /**
     * Lance la génération automatique de toutes les séances
     */
    async generateAllSessions() {
        const subjects = StateManager.getCurrentSessionSubjects();

        if (subjects.length === 0) {
            DialogManager.error('Aucune matière configurée pour la session actuelle.');
            return;
        }

        const options = this.getSchedulingOptions();

        DialogManager.confirm(
            'Génération Automatique',
            `Voulez-vous générer automatiquement toutes les séances manquantes ?<br><br>
            <strong>Options sélectionnées :</strong><br>
            - Attribuer enseignants : ${options.assignTeachers ? 'Oui' : 'Non'}<br>
            - Attribuer salles : ${options.assignRooms ? 'Oui' : 'Non'}<br>
            - Respecter souhaits : ${options.respectWishes ? 'Oui' : 'Non'}<br>
            - Éviter conflits : ${options.avoidConflicts ? 'Oui' : 'Non'}<br><br>
            <em>Cette opération peut prendre quelques secondes...</em>`,
            async () => {
                SpinnerManager.show();

                try {
                    const result = await SchedulingService.autoGenerateAllSessions(options);

                    SpinnerManager.hide();

                    if (result.success) {
                        const { created, failed, skipped, total } = result.stats;
                        
                        DialogManager.success(
                            `✅ Génération terminée !<br><br>
                            <strong>Résultats :</strong><br>
                            - Séances créées : ${created}<br>
                            - Séances échouées : ${failed}<br>
                            - Séances existantes : ${skipped}<br>
                            - Total théorique : ${total}`
                        );

                        StateManager.saveState();
                        TableRenderer.render();
                    } else {
                        DialogManager.error('Erreur lors de la génération automatique.');
                    }
                } catch (error) {
                    SpinnerManager.hide();
                    LogService.error(`❌ Erreur : ${error.message}`);
                    DialogManager.error(`Erreur lors de la génération : ${error.message}`);
                }
            }
        );
    }

    /**
     * Génère les séances pour une matière spécifique
     * @param {string} matiereNom - Le nom de la matière
     */
    async generateSessionsForSubject(matiereNom) {
        const subject = StateManager.getSubjects().find(s => s.nom === matiereNom);

        if (!subject) {
            DialogManager.error('Matière introuvable.');
            return;
        }

        const options = this.getSchedulingOptions();

        DialogManager.confirm(
            'Génération Automatique',
            `Voulez-vous générer automatiquement les séances pour <strong>${matiereNom}</strong> ?`,
            async () => {
                SpinnerManager.show();

                try {
                    const result = await SchedulingService.autoGenerateSubjectSessions(subject, options);

                    SpinnerManager.hide();

                    const { created, failed, skipped, total } = result;

                    if (created > 0) {
                        NotificationManager.success(`${created} séance(s) créée(s) pour ${matiereNom}`);
                        StateManager.saveState();
                        TableRenderer.render();
                    } else if (skipped === total) {
                        NotificationManager.info('Toutes les séances existent déjà');
                    } else {
                        NotificationManager.warning(`${failed} séance(s) non créée(s)`);
                    }
                } catch (error) {
                    SpinnerManager.hide();
                    LogService.error(`❌ Erreur : ${error.message}`);
                    DialogManager.error(`Erreur : ${error.message}`);
                }
            }
        );
    }

    /**
     * Récupère les options de planification depuis l'interface
     * @returns {Object} Les options
     */
    getSchedulingOptions() {
        return {
            assignTeachers: document.getElementById('optionAssignTeachers')?.checked ?? true,
            assignRooms: document.getElementById('optionAssignRooms')?.checked ?? true,
            respectWishes: document.getElementById('optionRespectWishes')?.checked ?? true,
            avoidConflicts: document.getElementById('optionAvoidConflicts')?.checked ?? true
        };
    }

    /**
     * Optimise l'emploi du temps existant
     */
    async optimizeSchedule() {
        DialogManager.info(
            'Fonctionnalité en développement',
            'L\'optimisation automatique sera disponible dans une prochaine version.'
        );
    }

    /**
     * Détecte et résout automatiquement les conflits
     */
    async resolveConflicts() {
        const seances = StateManager.getSeances();
        const conflictsFound = [];

        // Détecter les conflits
        seances.forEach(seance => {
            const conflicts = window.EDTConflictService?.checkAllConflicts(
                seance,
                seances,
                [seance.id],
                StateManager.state.sallesInfo
            ) || [];

            if (conflicts.length > 0) {
                conflictsFound.push({
                    seance,
                    conflicts
                });
            }
        });

        if (conflictsFound.length === 0) {
            NotificationManager.success('Aucun conflit détecté !');
            return;
        }

        DialogManager.info(
         //   'Conflits Détectés',
          //  `${conflictsFound.length} séance(s) avec des conflits détectés.<br><br>
           // <em>La résolution automatique sera disponible dans une prochaine version.</em><br><br>
            //Consultez le journal pour plus de détails.`
        );
        // Message formaté sans balises HTML (DialogManager affiche du texte brut / sécurisé)
        const count = conflictsFound.length;
        const seancesText = `${count} séance${count > 1 ? 's' : ''} présentent des conflits détectés.`;
        const message = `${seancesText}\n\nLa résolution automatique sera disponible dans une prochaine version.\n\nConsultez le journal pour plus de détails.`;
        DialogManager.info('Conflits Détectés', message);
        // Logger les conflits
        conflictsFound.forEach(({ seance, conflicts }) => {
            LogService.warning(`⚠️ Conflits pour ${seance.matiere} (${seance.jour} ${seance.creneau}):`);
            conflicts.forEach(c => LogService.warning(`  - ${c}`));
        });
    }
}

// Export d'une instance singleton
export default new SchedulingHandlers();