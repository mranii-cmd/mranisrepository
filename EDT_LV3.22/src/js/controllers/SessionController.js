/**
 * Contrôleur pour la gestion des séances (CRUD)
 * @author Ibrahim Mrani - UCD
 */

import Session from '../models/Session.js';
import StateManager from './StateManager.js';
import ConflictService from '../services/ConflictService.js';
import ValidationService from '../services/ValidationService.js';
import LogService from '../services/LogService.js';
import DialogManager from '../ui/DialogManager.js';
import { CRENEAUX_COUPLES_SUIVANT } from '../config/constants.js';

class SessionController {
    /**
     * Crée une nouvelle séance
     * @param {Object} formData - Les données du formulaire
     * @param {Object} options - Options (allowNoRoom, excludeIds)
     * @returns {Object} { success: boolean, session: Session|null, conflicts: Array }
     */
    createSession(formData, options = {}) {
        const { allowNoRoom = false, excludeIds = [] } = options;

        // 1. Validation des données
        const validation = ValidationService.validateSeanceData(formData, allowNoRoom);
        
        if (!validation.isValid) {
            ValidationService.highlightFormErrors(
                validation.missingFields.map(f => `input${f.replace(/\s/g, '')}`)
            );
            
            DialogManager.error(
                `Veuillez remplir les champs manquants : <strong>${validation.missingFields.join(', ')}</strong>.`
            );
            
            return { success: false, session: null, conflicts: validation.errors };
        }

        // 2. Créer la session principale
        const htpValue = this.getHtpForSubject(formData.matiere, formData.type);
        const session = Session.fromFormData(formData, StateManager.state.nextSessionId, htpValue);

        // 3. Vérifier les conflits
        const conflicts = ConflictService.checkAllConflicts(
            session,
            StateManager.getSeances(),
            excludeIds,
            StateManager.state.sallesInfo
        );

        if (conflicts.length > 0) {
            const errorHtml = '<ul>' + conflicts.map(c => `<li>${c}</li>`).join('') + '</ul>';
            DialogManager.error(`Conflits détectés :<br>${errorHtml}`);
            return { success: false, session: null, conflicts };
        }

        // 4. Ajouter la session
        StateManager.addSeance(session);

        // 5. Si TP, créer la deuxième partie
        if (formData.type === 'TP') {
            const paired = CRENEAUX_COUPLES_SUIVANT[formData.creneau];
            
            if (paired) {
                const secondPart = session.clone();
                secondPart.id = StateManager.state.nextSessionId;
                secondPart.creneau = paired;
                secondPart.hTP_Affecte = 0;
                
                StateManager.addSeance(secondPart);
            }
        }

        LogService.success(
            `Séance ajoutée: ${formData.matiere} (${formData.type}) - ${formData.filiere} ${session.groupe} [${formData.jour} ${formData.creneau}]`
        );

        return { success: true, session, conflicts: [] };
    }

    /**
     * Supprime une séance (avec gestion TP couplés)
     * @param {number} id - L'ID de la séance
     * @returns {Object} { success: boolean, deletedCount: number }
     */
    deleteSession(id) {
        const seance = StateManager.findSeanceById(id);
        if (!seance) {
            return { success: false, deletedCount: 0 };
        }

        const allSeances = StateManager.getSeances();
        let idsToDelete = [id];

        // Gestion des TP couplés
        if (seance.type === 'TP' && seance.hTP_Affecte > 0 && CRENEAUX_COUPLES_SUIVANT.hasOwnProperty(seance.creneau)) {
            // C'est la première partie d'un TP, chercher la deuxième
            const nextCreneau = CRENEAUX_COUPLES_SUIVANT[seance.creneau];
            const coupledSession = allSeances.find(s =>
                s.jour === seance.jour &&
                s.creneau === nextCreneau &&
                s.uniqueStudentEntity === seance.uniqueStudentEntity &&
                s.type === seance.type
            );

            if (coupledSession) {
                idsToDelete.push(coupledSession.id);
                LogService.info(`Suppression du créneau TP couplé de ${nextCreneau}.`);
            }
        } else if (seance.type === 'TP' && seance.hTP_Affecte === 0) {
            // C'est la deuxième partie, chercher la première
            const prevCreneau = Object.keys(CRENEAUX_COUPLES_SUIVANT).find(
                k => CRENEAUX_COUPLES_SUIVANT[k] === seance.creneau
            );

            if (prevCreneau) {
                const firstPartSession = allSeances.find(s =>
                    s.jour === seance.jour &&
                    s.creneau === prevCreneau &&
                    s.uniqueStudentEntity === seance.uniqueStudentEntity &&
                    s.type === seance.type
                );

                if (firstPartSession) {
                    idsToDelete.push(firstPartSession.id);
                    LogService.info(`Suppression de la première partie TP (${prevCreneau}).`);
                }
            }
        }

        // Supprimer toutes les séances identifiées
        let deletedCount = 0;
        idsToDelete.forEach(sessionId => {
            if (StateManager.removeSeance(sessionId)) {
                deletedCount++;
            }
        });

        LogService.success(`${deletedCount} séance(s) supprimée(s).`);
        
        return { success: true, deletedCount };
    }

    /**
     * Met à jour une séance existante
     * @param {number} id - L'ID de la séance
     * @param {Object} formData - Les nouvelles données
     * @param {Object} options - Options
     * @returns {Object} { success: boolean, session: Session|null }
     */
    updateSession(id, formData, options = {}) {
        // Stratégie : supprimer puis recréer
        const deleteResult = this.deleteSession(id);
        
        if (!deleteResult.success) {
            return { success: false, session: null };
        }

        const createResult = this.createSession(formData, {
            ...options,
            excludeIds: [id]
        });

        if (createResult.success) {
            LogService.success(`Séance ID ${id} modifiée avec succès.`);
        } else {
            LogService.error(`Échec de la modification de la séance ID ${id}.`);
        }

        return createResult;
    }

    /**
     * Déplace une séance vers un nouveau créneau
     * @param {number} id - L'ID de la séance
     * @param {string} newJour - Le nouveau jour
     * @param {string} newCreneau - Le nouveau créneau
     * @returns {Object} { success: boolean }
     */
    moveSession(id, newJour, newCreneau) {
        const seance = StateManager.findSeanceById(id);
        if (!seance) {
            return { success: false, message: 'Séance introuvable' };
        }

        // Interdire le déplacement des TP
        if (seance.type === 'TP') {
            DialogManager.error(
                "Le glisser-déposer des séances de TP n'est pas pris en charge pour garantir la cohérence des créneaux couplés."
            );
            return { success: false, message: 'TP non déplaçable' };
        }

        // Ne rien faire si même position
        if (seance.jour === newJour && seance.creneau === newCreneau) {
            return { success: false, message: 'Même position' };
        }

        // Vérifier les conflits
        const hypotheticalSession = seance.clone();
        hypotheticalSession.jour = newJour;
        hypotheticalSession.creneau = newCreneau;

        const conflicts = ConflictService.checkAllConflicts(
            hypotheticalSession,
            StateManager.getSeances(),
            [id],
            StateManager.state.sallesInfo
        );

        if (conflicts.length > 0) {
            // Gérer spécifiquement les conflits de salle
            const roomConflicts = conflicts.filter(c => c.startsWith('❌ CONFLIT SALLE:'));
            
            if (roomConflicts.length > 0 && conflicts.length === roomConflicts.length) {
                // Seulement conflit de salle, proposer alternative
                const freeRooms = ConflictService.getFreeRooms(
                    newJour,
                    newCreneau,
                    seance.type,
                    StateManager.state.sallesInfo,
                    StateManager.getSeances(),
                    id
                );

                if (freeRooms.length > 0) {
                    const suggestedRoom = freeRooms[0];
                    
                    DialogManager.confirm(
                        'Conflit de Salle Détecté',
                        `La salle <strong>${seance.salle}</strong> est déjà occupée.<br><br>Utiliser la salle <strong>${suggestedRoom}</strong> ?`,
                        () => {
                            seance.jour = newJour;
                            seance.creneau = newCreneau;
                            seance.salle = suggestedRoom;
                            LogService.success(
                                `Séance déplacée vers ${newJour} ${newCreneau} (Salle: ${suggestedRoom})`
                            );
                            StateManager.notify('seance:moved', { seance });
                        }
                    );
                    
                    return { success: false, message: 'En attente de confirmation' };
                }
            }

            // Autres conflits
            const errorHtml = '<ul>' + conflicts.map(c => `<li>${c}</li>`).join('') + '</ul>';
            DialogManager.error(`Déplacement impossible :<br>${errorHtml}`);
            return { success: false, message: 'Conflits détectés' };
        }

        // Déplacement réussi
        seance.jour = newJour;
        seance.creneau = newCreneau;
        LogService.success(`Séance déplacée vers ${newJour} ${newCreneau}`);
        StateManager.notify('seance:moved', { seance });

        return { success: true };
    }

    /**
     * Obtient le volume hTP pour une matière et un type
     * @param {string} matiere - La matière
     * @param {string} type - Le type
     * @returns {number} Le volume hTP
     */
    getHtpForSubject(matiere, type) {
        const info = StateManager.state.matiereGroupes[matiere];
        if (info && info.volumeHTP && info.volumeHTP[type] !== undefined) {
            return info.volumeHTP[type];
        }
        // Fallback
        return { Cours: 48, TD: 32, TP: 36 }[type] || 0;
    }
}

// Export d'une instance singleton
export default new SessionController();