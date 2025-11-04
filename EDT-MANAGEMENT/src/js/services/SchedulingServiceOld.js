/**
 * Service de planification automatique des séances
 * @author Ibrahim Mrani - UCD
 */

import { LISTE_JOURS, MAX_AUTO_PLANNING_ITERATIONS } from '../config/constants.js';
import { getSortedCreneauxKeys, isAfternoonCreneau } from '../utils/helpers.js';
import Session from '../models/Session.js';
import StateManager from '../controllers/StateManager.js';
import ConflictService from './ConflictService.js';
import TeacherAvailabilityService from './TeacherAvailabilityService.js';
import VolumeService from './VolumeService.js';
import LogService from './LogService.js';

class SchedulingService {
    /**
     * Génère automatiquement toutes les séances manquantes
     * @param {Object} options - Options de génération
     * @returns {Object} { success: boolean, stats: Object }
     */
    async autoGenerateAllSessions(options = {}) {
        const {
            assignTeachers = true,
            assignRooms = true,
            respectWishes = true,
            avoidConflicts = true
        } = options;

        LogService.info('🚀 Début de la génération automatique...');

        const stats = {
            total: 0,
            created: 0,
            failed: 0,
            skipped: 0
        };

        const subjects = StateManager.getCurrentSessionSubjects();

        for (const subject of subjects) {
            const subjectStats = await this.autoGenerateSubjectSessions(
                subject,
                { assignTeachers, assignRooms, respectWishes, avoidConflicts }
            );

            stats.total += subjectStats.total;
            stats.created += subjectStats.created;
            stats.failed += subjectStats.failed;
            stats.skipped += subjectStats.skipped;
        }

        LogService.success(`✅ Génération terminée : ${stats.created}/${stats.total} séances créées`);

        return { success: true, stats };
    }

    /**
     * Génère les séances pour une matière spécifique
     * @param {Subject} subject - La matière
     * @param {Object} options - Options
     * @returns {Object} Stats de génération
     */
    async autoGenerateSubjectSessions(subject, options = {}) {
        const stats = {
            total: 0,
            created: 0,
            failed: 0,
            skipped: 0
        };

        const existingSeances = StateManager.getSeances().filter(s => s.matiere === subject.nom);

        // Générer les séances de Cours
        const coursStats = await this.generateCoursSessions(subject, existingSeances, options);
        this.mergeStats(stats, coursStats);

        // Générer les séances de TD
        const tdStats = await this.generateTDSessions(subject, existingSeances, options);
        this.mergeStats(stats, tdStats);

        // Générer les séances de TP
        const tpStats = await this.generateTPSessions(subject, existingSeances, options);
        this.mergeStats(stats, tpStats);

        return stats;
    }

    /**
     * Génère les séances de Cours
     * @param {Subject} subject - La matière
     * @param {Array<Session>} existingSeances - Séances existantes
     * @param {Object} options - Options
     * @returns {Object} Stats
     */
    async generateCoursSessions(subject, existingSeances, options) {
        const stats = { total: 0, created: 0, failed: 0, skipped: 0 };

        const nbSections = subject.sections_cours;

        for (let i = 0; i < nbSections; i++) {
            const sectionName = `Section ${String.fromCharCode(65 + i)}`;
            stats.total++;

            // Vérifier si déjà existante
            const exists = existingSeances.some(s => 
                s.type === 'Cours' && s.section === sectionName
            );

            if (exists) {
                stats.skipped++;
                continue;
            }

            // Créer la séance
            const session = this.createSessionTemplate(subject, 'Cours', sectionName, '');

            // Trouver un créneau disponible
            const slot = this.findAvailableSlot(session, options);

            if (!slot) {
                stats.failed++;
                LogService.warning(`⚠️ Aucun créneau trouvé pour ${subject.nom} (Cours) - ${sectionName}`);
                continue;
            }

            session.jour = slot.jour;
            session.creneau = slot.creneau;

            // Attribuer enseignant(s)
            if (options.assignTeachers) {
                const teachers = this.assignTeachersToSession(session, options);
                session.setTeachers(teachers);
            }

            // Attribuer salle
            if (options.assignRooms) {
                const room = this.assignRoomToSession(session);
                session.setRoom(room);
            }

            // Ajouter la séance
            StateManager.addSeance(session);
            stats.created++;
        }

        return stats;
    }

    /**
     * Génère les séances de TD
     * @param {Subject} subject - La matière
     * @param {Array<Session>} existingSeances - Séances existantes
     * @param {Object} options - Options
     * @returns {Object} Stats
     */
    async generateTDSessions(subject, existingSeances, options) {
        const stats = { total: 0, created: 0, failed: 0, skipped: 0 };

        const nbSections = subject.sections_cours;
        const nbGroupes = subject.td_groups;

        for (let i = 0; i < nbSections; i++) {
            const sectionName = `Section ${String.fromCharCode(65 + i)}`;

            for (let g = 1; g <= nbGroupes; g++) {
                const groupeName = `G${g}`;
                stats.total++;

                // Vérifier si déjà existante
                const uniqueEntity = Session.generateUniqueStudentEntity(
                    subject.filiere,
                    sectionName,
                    'TD',
                    groupeName
                );

                const exists = existingSeances.some(s => 
                    s.type === 'TD' && s.uniqueStudentEntity === uniqueEntity
                );

                if (exists) {
                    stats.skipped++;
                    continue;
                }

                // Créer la séance
                const session = this.createSessionTemplate(subject, 'TD', sectionName, groupeName);

                // Trouver un créneau disponible
                const slot = this.findAvailableSlot(session, options);

                if (!slot) {
                    stats.failed++;
                    LogService.warning(`⚠️ Aucun créneau trouvé pour ${subject.nom} (TD) - ${sectionName} ${groupeName}`);
                    continue;
                }

                session.jour = slot.jour;
                session.creneau = slot.creneau;

                // Attribuer enseignant
                if (options.assignTeachers) {
                    const teachers = this.assignTeachersToSession(session, options);
                    session.setTeachers(teachers);
                }

                // Attribuer salle
                if (options.assignRooms) {
                    const room = this.assignRoomToSession(session);
                    session.setRoom(room);
                }

                // Ajouter la séance
                StateManager.addSeance(session);
                stats.created++;
            }
        }

        return stats;
    }

    /**
     * Génère les séances de TP
     * @param {Subject} subject - La matière
     * @param {Array<Session>} existingSeances - Séances existantes
     * @param {Object} options - Options
     * @returns {Object} Stats
     */
    async generateTPSessions(subject, existingSeances, options) {
        const stats = { total: 0, created: 0, failed: 0, skipped: 0 };

        const nbSections = subject.sections_cours;
        const nbGroupes = subject.tp_groups;

        for (let i = 0; i < nbSections; i++) {
            const sectionName = `Section ${String.fromCharCode(65 + i)}`;

            for (let g = 1; g <= nbGroupes; g++) {
                const groupeName = `G${g}`;
                stats.total++;

                // Vérifier si déjà existante
                const uniqueEntity = Session.generateUniqueStudentEntity(
                    subject.filiere,
                    sectionName,
                    'TP',
                    groupeName
                );

                const exists = existingSeances.some(s => 
                    s.type === 'TP' && s.uniqueStudentEntity === uniqueEntity && s.hTP_Affecte > 0
                );

                if (exists) {
                    stats.skipped++;
                    continue;
                }

                // Créer la séance (première partie)
                const session = this.createSessionTemplate(subject, 'TP', sectionName, groupeName);

                // Trouver un créneau couplé disponible
                const slot = this.findAvailableCoupledSlot(session, options);

                if (!slot) {
                    stats.failed++;
                    LogService.warning(`⚠️ Aucun créneau couplé trouvé pour ${subject.nom} (TP) - ${sectionName} ${groupeName}`);
                    continue;
                }

                session.jour = slot.jour;
                session.creneau = slot.creneau;

                // Attribuer enseignant(s) selon nbEnseignantsTP
                if (options.assignTeachers) {
                    const teachers = this.assignTeachersToSession(session, options, subject.nbEnseignantsTP);
                    session.setTeachers(teachers);
                }

                // Attribuer salle (STP)
                if (options.assignRooms) {
                    const room = this.assignRoomToSession(session);
                    session.setRoom(room);
                }

                // Ajouter la première partie
                StateManager.addSeance(session);

                // Créer la deuxième partie
                const secondPart = session.clone();
                secondPart.id = StateManager.state.nextSessionId;
                secondPart.creneau = slot.creneauCoupled;
                secondPart.hTP_Affecte = 0;

                StateManager.addSeance(secondPart);

                stats.created++;
            }
        }

        return stats;
    }

    /**
     * Crée un template de séance
     * @param {Subject} subject - La matière
     * @param {string} type - Le type
     * @param {string} section - La section
     * @param {string} groupe - Le groupe TD/TP
     * @returns {Session} La séance template
     */
    createSessionTemplate(subject, type, section, groupe) {
        const uniqueEntity = Session.generateUniqueStudentEntity(
            subject.filiere,
            section,
            type,
            groupe
        );

        const groupeDisplay = Session.generateGroupe(section, type, groupe);

        return new Session({
            jour: '',
            creneau: '',
            filiere: subject.filiere,
            matiere: subject.nom,
            type,
            section,
            groupe: groupeDisplay,
            uniqueStudentEntity: uniqueEntity,
            enseignant: '',
            enseignantsArray: [],
            salle: '',
            dureeAffichee: 1.5,
            hTP_Affecte: subject.getVolumeHTP(type)
        });
    }

    /**
     * Trouve un créneau disponible pour une séance
     * @param {Session} session - La séance
     * @param {Object} options - Options
     * @returns {Object|null} { jour, creneau } ou null
     */
    findAvailableSlot(session, options) {
        const sortedCreneaux = getSortedCreneauxKeys();
        const allSeances = StateManager.getSeances();
        const sallesInfo = StateManager.state.sallesInfo;

        let iterations = 0;
        const maxIterations = MAX_AUTO_PLANNING_ITERATIONS;

        for (const jour of LISTE_JOURS) {
            for (const creneau of sortedCreneaux) {
                iterations++;
                if (iterations > maxIterations) {
                    return null;
                }

                // Créer une copie temporaire
                const tempSession = session.clone();
                tempSession.jour = jour;
                tempSession.creneau = creneau;

                // Vérifier les conflits
                const conflicts = ConflictService.checkAllConflicts(
                    tempSession,
                    allSeances,
                    [],
                    sallesInfo
                );

                if (conflicts.length === 0 || !options.avoidConflicts) {
                    return { jour, creneau };
                }
            }
        }

        return null;
    }

    /**
     * Trouve un créneau couplé disponible pour un TP
     * @param {Session} session - La séance TP
     * @param {Object} options - Options
     * @returns {Object|null} { jour, creneau, creneauCoupled } ou null
     */
    findAvailableCoupledSlot(session, options) {
        const sortedCreneaux = getSortedCreneauxKeys();
        const allSeances = StateManager.getSeances();
        const sallesInfo = StateManager.state.sallesInfo;
        const { CRENEAUX_COUPLES_SUIVANT } = await import('../config/constants.js');

        for (const jour of LISTE_JOURS) {
            for (const creneau of sortedCreneaux) {
                const creneauCoupled = CRENEAUX_COUPLES_SUIVANT[creneau];

                if (!creneauCoupled) continue;

                // Vérifier le premier créneau
                const tempSession1 = session.clone();
                tempSession1.jour = jour;
                tempSession1.creneau = creneau;

                const conflicts1 = ConflictService.checkAllConflicts(
                    tempSession1,
                    allSeances,
                    [],
                    sallesInfo
                );

                if (conflicts1.length > 0 && options.avoidConflicts) continue;

                // Vérifier le deuxième créneau
                const tempSession2 = session.clone();
                tempSession2.jour = jour;
                tempSession2.creneau = creneauCoupled;
                tempSession2.hTP_Affecte = 0;

                const conflicts2 = ConflictService.checkAllConflicts(
                    tempSession2,
                    allSeances,
                    [],
                    sallesInfo
                );

                if (conflicts2.length === 0 || !options.avoidConflicts) {
                    return { jour, creneau, creneauCoupled };
                }
            }
        }

        return null;
    }

    /**
     * Attribue des enseignants à une séance
     * @param {Session} session - La séance
     * @param {Object} options - Options
     * @param {number} nbTeachers - Nombre d'enseignants requis
     * @returns {Array<string>} Les noms des enseignants
     */
    assignTeachersToSession(session, options, nbTeachers = 1) {
        if (!options.respectWishes) {
            return [];
        }

        const teachers = StateManager.getTeachers();
        const allSeances = StateManager.getSeances();
        const sortedCreneaux = getSortedCreneauxKeys();

        // Calculer les volumes actuels
        const allVolumes = VolumeService.calculateAllVolumes(
            StateManager.state.enseignants,
            allSeances,
            StateManager.state.enseignantVolumesSupplementaires,
            StateManager.state.header.session,
            StateManager.state.volumesAutomne
        );

        const globalMetrics = VolumeService.calculateGlobalVolumeMetrics(
            StateManager.getCurrentSessionSubjects(),
            allSeances,
            StateManager.state.enseignants.length,
            StateManager.state.enseignantVolumesSupplementaires
        );

        const maxWorkload = globalMetrics.globalVHM * 1.5; // Tolérance 150%
        const assignedCounts = {}; // TODO: Calculer les compteurs réels

        const candidates = TeacherAvailabilityService.findBestCandidates(
            teachers,
            session,
            nbTeachers,
            allVolumes,
            maxWorkload,
            assignedCounts,
            allSeances,
            sortedCreneaux
        );

        return candidates;
    }

    /**
     * Attribue une salle à une séance
     * @param {Session} session - La séance
     * @returns {string} Le nom de la salle
     */
    assignRoomToSession(session) {
        const freeRooms = ConflictService.getFreeRooms(
            session.jour,
            session.creneau,
            session.type,
            StateManager.state.sallesInfo,
            StateManager.getSeances()
        );

        if (freeRooms.length === 0) {
            return '';
        }

        // Priorité : salles spécifiques par filière si configurées
        const autoSalles = StateManager.state.autoSallesParFiliere[session.filiere];
        if (autoSalles && autoSalles[session.type]) {
            const preferredRoom = autoSalles[session.type];
            if (freeRooms.includes(preferredRoom)) {
                return preferredRoom;
            }
        }

        // Sinon, prendre la première salle libre
        return freeRooms[0];
    }

    /**
     * Fusionne les statistiques
     * @param {Object} target - Stats cibles
     * @param {Object} source - Stats sources
     */
    mergeStats(target, source) {
        target.total += source.total;
        target.created += source.created;
        target.failed += source.failed;
        target.skipped += source.skipped;
    }
}

// Export d'une instance singleton
export default new SchedulingService();