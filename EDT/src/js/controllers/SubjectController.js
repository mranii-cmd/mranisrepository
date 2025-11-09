/**
 * Contrôleur pour la gestion des matières
 * @author Ibrahim Mrani - UCD
 */

import StateManager from './StateManager.js';
import Subject from '../models/Subject.js';
import LogService from '../services/LogService.js';
import DialogManager from '../ui/DialogManager.js';
import NotificationManager from '../ui/NotificationManager.js';
import VolumeService from '../services/VolumeService.js';

class SubjectController {
    /**
     * Ajoute une matière
     * @param {string} nom - Le nom de la matière
     * @param {Object} config - La configuration
     * @returns {boolean} Succès de l'ajout
     */
    addSubject(nom, config = {}) {
        if (!nom || nom.trim() === '') {
            DialogManager.error('Veuillez saisir un nom de matière valide.');
            return false;
        }

        const trimmedNom = nom.trim();

        if (StateManager.state.matiereGroupes[trimmedNom]) {
            DialogManager.error(`La matière "${trimmedNom}" existe déjà.`);
            return false;
        }

        const success = StateManager.addSubject(trimmedNom, config);

        if (success) {
            LogService.success(`✅ Matière "${trimmedNom}" ajoutée`);
            NotificationManager.success('Matière ajoutée');
            StateManager.saveState();
        }

        return success;
    }

    /**
     * Supprime une matière
     * @param {string} nom - Le nom de la matière
     */
    removeSubject(nom) {
        // Vérifier si la matière a des séances
        const seances = StateManager.getSeances();
        const hasSeances = seances.some(s => s.matiere === nom);

        if (hasSeances) {
            DialogManager.warning(
                `La matière <strong>${nom}</strong> a des séances planifiées.<br><br>
                Voulez-vous vraiment la supprimer ?<br>
                <em>Toutes les séances associées seront également supprimées.</em>`,
                () => {
                    this.performRemoveSubject(nom);
                }
            );
        } else {
            DialogManager.confirm(
                'Supprimer la Matière',
                `Voulez-vous vraiment supprimer <strong>${nom}</strong> ?`,
                () => {
                    this.performRemoveSubject(nom);
                }
            );
        }
    }

    /**
     * Effectue la suppression de la matière
     * @param {string} nom - Le nom de la matière
     */
    performRemoveSubject(nom) {
        // Supprimer toutes les séances associées
        const seances = StateManager.getSeances();
        const seancesToRemove = seances.filter(s => s.matiere === nom);

        seancesToRemove.forEach(seance => {
            StateManager.removeSeance(seance.id);
        });

        // Supprimer la matière
        const success = StateManager.removeSubject(nom);

        if (success) {
            LogService.success(`✅ Matière "${nom}" supprimée (${seancesToRemove.length} séance(s))`);
            NotificationManager.success('Matière supprimée');
            StateManager.saveState();
        }
    }

    /**
     * Met à jour la configuration d'une matière
     * @param {string} nom - Le nom de la matière
     * @param {Object} config - La nouvelle configuration
     * @returns {boolean} Succès de la mise à jour
     */
    updateSubject(nom, config) {
        if (!StateManager.state.matiereGroupes[nom]) {
            DialogManager.error(`Matière "${nom}" introuvable.`);
            return false;
        }

        StateManager.state.matiereGroupes[nom] = {
            ...StateManager.state.matiereGroupes[nom],
            ...config
        };

        LogService.success(`✅ Matière "${nom}" mise à jour`);
        NotificationManager.success('Matière mise à jour');
        StateManager.saveState();

        return true;
    }

    /**
     * Calcule les statistiques d'une matière
     * @param {string} nom - Le nom de la matière
     * @returns {Object} Les statistiques
     */
    getSubjectStats(nom) {
        const subject = new Subject(nom, StateManager.state.matiereGroupes[nom]);
        const seances = StateManager.getSeances().filter(s => s.matiere === nom);

        const plannedGroups = VolumeService.calculatePlannedGroups([...seances]);
        const assignedGroups = VolumeService.calculateAssignedGroups([...seances]);

        const totalGroups = subject.getTotalGroups();
        const vht = subject.calculateVHT();

        const stats = {
            totalSeances: seances.length,
            plannedCours: plannedGroups[nom]?.Cours?.size || 0,
            plannedTD: plannedGroups[nom]?.TD?.size || 0,
            plannedTP: plannedGroups[nom]?.TP?.size || 0,
            assignedCours: assignedGroups[nom]?.Cours || 0,
            assignedTD: assignedGroups[nom]?.TD || 0,
            assignedTP: assignedGroups[nom]?.TP || 0,
            expectedCours: totalGroups.cours,
            expectedTD: totalGroups.td,
            expectedTP: totalGroups.tp,
            vht,
            enseignants: [...new Set(seances.flatMap(s => s.enseignantsArray))],
            completionRate: this.calculateCompletionRate(
                plannedGroups[nom],
                totalGroups
            )
        };

        return stats;
    }

    /**
     * Calcule le taux de complétion d'une matière
     * @param {Object} planned - Groupes planifiés
     * @param {Object} expected - Groupes attendus
     * @returns {number} Taux de complétion (0-100)
     */
    calculateCompletionRate(planned, expected) {
        if (!planned) return 0;

        const totalPlanned = (planned.Cours?.size || 0) + 
                            (planned.TD?.size || 0) + 
                            (planned.TP?.size || 0);
        
        const totalExpected = expected.cours + expected.td + expected.tp;

        if (totalExpected === 0) return 0;

        return Math.round((totalPlanned / totalExpected) * 100);
    }

    /**
     * Obtient toutes les matières avec leurs statistiques
     * @returns {Array<Object>} Les matières avec stats
     */
    getAllSubjectsWithStats() {
        return Object.keys(StateManager.state.matiereGroupes).map(nom => {
            const config = StateManager.state.matiereGroupes[nom];
            const stats = this.getSubjectStats(nom);

            return {
                nom,
                config,
                stats
            };
        });
    }

    /**
     * Vérifie les incohérences dans la configuration d'une matière
     * @param {string} nom - Le nom de la matière
     * @returns {Array<string>} Les incohérences détectées
     */
    checkSubjectInconsistencies(nom) {
        const inconsistencies = [];
        const subject = new Subject(nom, StateManager.state.matiereGroupes[nom]);
        const stats = this.getSubjectStats(nom);

        // Vérifier si toutes les séances théoriques sont planifiées
        if (stats.plannedCours < stats.expectedCours) {
            inconsistencies.push(`Cours : ${stats.plannedCours}/${stats.expectedCours} planifiés`);
        }
        if (stats.plannedTD < stats.expectedTD) {
            inconsistencies.push(`TD : ${stats.plannedTD}/${stats.expectedTD} planifiés`);
        }
        if (stats.plannedTP < stats.expectedTP) {
            inconsistencies.push(`TP : ${stats.plannedTP}/${stats.expectedTP} planifiés`);
        }

        // Vérifier si toutes les séances ont un enseignant
        if (stats.assignedCours < stats.plannedCours) {
            inconsistencies.push(`Cours sans enseignant : ${stats.plannedCours - stats.assignedCours}`);
        }
        if (stats.assignedTD < stats.plannedTD) {
            inconsistencies.push(`TD sans enseignant : ${stats.plannedTD - stats.assignedTD}`);
        }
        if (stats.assignedTP < stats.plannedTP) {
            inconsistencies.push(`TP sans enseignant : ${stats.plannedTP - stats.assignedTP}`);
        }

        return inconsistencies;
    }

    /**
     * Exporte les données d'une matière
     * @param {string} nom - Le nom de la matière
     * @returns {Object} Les données exportées
     */
    exportSubjectData(nom) {
        const config = StateManager.state.matiereGroupes[nom];
        const stats = this.getSubjectStats(nom);
        const seances = StateManager.getSeances().filter(s => s.matiere === nom);

        return {
            nom,
            config,
            stats,
            seances: seances.map(s => s.toJSON())
        };
    }
}

// Export d'une instance singleton
export default new SubjectController();