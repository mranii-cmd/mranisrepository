/**
 * Service de détection de conflits dans l'emploi du temps
 * @author Ibrahim Mrani - UCD
 */

import { CRENEAUX_COUPLES_SUIVANT } from '../config/constants.js';
import ValidationService from './ValidationService.js';

class ConflictService {
    /**
     * Vérifie tous les conflits pour une séance
     * @param {Session} session - La séance à vérifier
     * @param {Array<Session>} allSessions - Toutes les séances
     * @param {Array<number>} excludeIds - IDs à exclure de la vérification
     * @param {Object} sallesInfo - Informations sur les salles
     * @returns {Array<string>} Liste des conflits détectés
     */
    checkAllConflicts(session, allSessions, excludeIds = [], sallesInfo = {}) {
        const conflicts = [];
        const seancesAComparer = allSessions.filter(s => !excludeIds.includes(s.id));

        // 1. Vérifier les créneaux à checker (incluant couplé si TP)
        const creneauxAChecker = [session.creneau];
        if (session.type === 'TP' && CRENEAUX_COUPLES_SUIVANT[session.creneau]) {
            creneauxAChecker.push(CRENEAUX_COUPLES_SUIVANT[session.creneau]);
        }

        // 2. Conflits enseignants
        conflicts.push(...this.checkTeacherConflicts(session, seancesAComparer));

        // 3. Conflits de salle et de groupe
        for (const creneau of creneauxAChecker) {
            conflicts.push(...this.checkRoomAndGroupConflicts(
                session, 
                creneau, 
                seancesAComparer,
                sallesInfo
            ));
        }

        // 4. Conflit de section (Cours vs TD/TP)
        conflicts.push(...this.checkSectionConflicts(session, seancesAComparer));

        // 5. Conflit de doublon
        conflicts.push(...this.checkDuplicateConflicts(session, seancesAComparer));

        // Retourner uniquement les conflits uniques
        return [...new Set(conflicts)].filter(Boolean);
    }

    /**
     * Vérifie les conflits d'enseignants
     * @param {Session} session - La séance
     * @param {Array<Session>} seancesAComparer - Les séances à comparer
     * @returns {Array<string>} Les conflits
     */
    checkTeacherConflicts(session, seancesAComparer) {
        const conflicts = [];

        for (const teacher of session.enseignantsArray) {
            if (!teacher) continue;

            if (!this.isTeacherAvailable(teacher, session.jour, session.creneau, session.type, seancesAComparer)) {
                conflicts.push(`❌ CONFLIT ENSEIGNANT: **${teacher}** est déjà occupé(e) sur ce créneau.`);
            }
        }

        return conflicts;
    }

    /**
     * Vérifie si un enseignant est disponible
     * @param {string} teacher - Le nom de l'enseignant
     * @param {string} jour - Le jour
     * @param {string} creneau - Le créneau
     * @param {string} type - Le type de séance
     * @param {Array<Session>} seancesAComparer - Les séances à vérifier
     * @returns {boolean} True si disponible
     */
    isTeacherAvailable(teacher, jour, creneau, type, seancesAComparer) {
        if (!teacher) return true;

        for (const s of seancesAComparer) {
            if (s.jour !== jour) continue;
            if (!Array.isArray(s.enseignantsArray) || s.enseignantsArray.length === 0) continue;
            if (!s.enseignantsArray.includes(teacher)) continue;

            // Conflit direct: même créneau de départ
            if (s.creneau === creneau) return false;

            // Conflits liés aux TP couplés (vérifier dans les deux sens)
            if (s.type === 'TP' && CRENEAUX_COUPLES_SUIVANT[s.creneau] === creneau) return false;
            if (type === 'TP' && CRENEAUX_COUPLES_SUIVANT[creneau] === s.creneau) return false;
        }

        return true;
    }

    /**
     * Vérifie les conflits de salle et de groupe
     * @param {Session} session - La séance
     * @param {string} creneau - Le créneau à vérifier
     * @param {Array<Session>} seancesAComparer - Les séances à comparer
     * @param {Object} sallesInfo - Informations sur les salles
     * @returns {Array<string>} Les conflits
     */
    checkRoomAndGroupConflicts(session, creneau, seancesAComparer, sallesInfo) {
        const conflicts = [];

        for (const s of seancesAComparer) {
            if (s.jour !== session.jour) continue;

            const sOccupeCeCreneau = (s.creneau === creneau) || 
                (s.type === 'TP' && CRENEAUX_COUPLES_SUIVANT[s.creneau] === creneau);

            if (sOccupeCeCreneau) {
                // Conflit de salle (seulement si les deux séances ont une salle définie et non vide)
                if (session.salle !== "" && s.salle === session.salle) {
                    conflicts.push(`❌ CONFLIT SALLE: La salle **${session.salle}** est déjà utilisée à ${creneau} par ${s.matiere} (${s.groupe}).`);
                }

                // Conflit de groupe étudiant
                if (s.uniqueStudentEntity === session.uniqueStudentEntity) {
                    conflicts.push(`❌ CONFLIT GROUPE: Le groupe **${session.uniqueStudentEntity}** est déjà occupé à ${creneau}.`);
                }
            }
        }

        // Vérification de compatibilité de salle
        if (session.type !== 'TP' && session.salle && !ValidationService.validateSalleCompatibility(session.type, session.salle, sallesInfo)) {
            conflicts.push(`❌ CONFLIT SALLE TYPE: Un (${session.type}) n'est pas compatible avec cette salle.`);
        }

        return conflicts;
    }

    /**
     * Vérifie les conflits de section (Cours vs TD/TP simultanés)
     * @param {Session} session - La séance
     * @param {Array<Session>} seancesAComparer - Les séances à comparer
     * @returns {Array<string>} Les conflits
     */
    checkSectionConflicts(session, seancesAComparer) {
        const conflicts = [];

        const chevauchement = seancesAComparer.find(s => {
            if (s.jour === session.jour && 
                s.creneau === session.creneau && 
                s.filiere === session.filiere && 
                s.section === session.section) {
                
                if (session.type === 'Cours' && (s.type === 'TD' || s.type === 'TP')) {
                    return true;
                }
                if ((session.type === 'TD' || session.type === 'TP') && s.type === 'Cours') {
                    return true;
                }
            }
            return false;
        });

        if (chevauchement) {
            conflicts.push(`❌ CONFLIT SECTION: Un **${chevauchement.type}** est déjà programmé pour la section **${session.section}**. Impossible de programmer un ${session.type} en parallèle.`);
        }

        return conflicts;
    }

    /**
     * Vérifie les conflits de doublon (même séance déjà planifiée)
     * @param {Session} session - La séance
     * @param {Array<Session>} seancesAComparer - Les séances à comparer
     * @returns {Array<string>} Les conflits
     */
    checkDuplicateConflicts(session, seancesAComparer) {
        const conflicts = [];

        const seanceIdentique = seancesAComparer.find(s =>
            s.matiere === session.matiere &&
            s.type === session.type &&
            s.uniqueStudentEntity === session.uniqueStudentEntity
        );

        if (seanceIdentique) {
            if (session.type === 'Cours') {
                conflicts.push(`❌ CONFLIT DE DOUBLON: La **${session.section}** a déjà un **Cours** pour la matière **${session.matiere}**.`);
            } else {
                conflicts.push(`❌ CONFLIT DE DOUBLON: Le groupe **${session.uniqueStudentEntity}** a déjà une séance de **${session.type}** pour la matière **${session.matiere}**.`);
            }
        }

        return conflicts;
    }

    /**
     * Vérifie si une salle est occupée à un créneau donné
     * @param {string} roomName - Le nom de la salle
     * @param {string} jour - Le jour
     * @param {string} creneau - Le créneau
     * @param {Array<Session>} allSessions - Toutes les séances
     * @param {number} excludeSessionId - ID de séance à exclure
     * @returns {boolean} True si occupée
     */
    isRoomOccupied(roomName, jour, creneau, allSessions, excludeSessionId = null) {
        if (!roomName || !jour || !creneau) return false;

        for (const s of allSessions) {
            if (excludeSessionId && s.id === excludeSessionId) continue;
            if (s.jour !== jour || !s.salle) continue;
            if (s.salle !== roomName) continue;

            // Occupation directe
            if (s.creneau === creneau) return true;

            // Occupation par TP couplé
            if (s.type === 'TP' && CRENEAUX_COUPLES_SUIVANT[s.creneau] === creneau) {
                return true;
            }
        }

        return false;
    }

    /**
     * Obtient les salles libres pour un créneau
     * @param {string} jour - Le jour
     * @param {string} creneau - Le créneau
     * @param {string} type - Le type de séance
     * @param {Object} sallesInfo - Informations sur les salles
     * @param {Array<Session>} allSessions - Toutes les séances
     * @param {number} excludeSessionId - ID à exclure
     * @returns {Array<string>} Les salles libres
     */
    getFreeRooms(jour, creneau, type, sallesInfo, allSessions, excludeSessionId = null) {
        if (!jour || !creneau) return [];

        const allRooms = Object.keys(sallesInfo || {});
        const pairedCreneau = (type === 'TP') ? CRENEAUX_COUPLES_SUIVANT[creneau] : null;

        const freeRooms = allRooms.filter(room => {
            // Vérifier la compatibilité
            if (!ValidationService.validateSalleCompatibility(type, room, sallesInfo)) {
                return false;
            }

            // Vérifier si libre sur le créneau de début
            if (this.isRoomOccupied(room, jour, creneau, allSessions, excludeSessionId)) {
                return false;
            }

            // Si TP, vérifier aussi le créneau couplé
            if (pairedCreneau && this.isRoomOccupied(room, jour, pairedCreneau, allSessions, excludeSessionId)) {
                return false;
            }

            return true;
        });

        return freeRooms.sort((a, b) => a.localeCompare(b));
    }
}

// Export d'une instance singleton
export default new ConflictService();