/**
 * Service de planification automatique des séances
 * @author Ibrahim Mrani - UCD
 * @modified 2025-11-06 - Répartition équitable par filière sur toute la semaine
 */

import { LISTE_JOURS, MAX_AUTO_PLANNING_ITERATIONS, CRENEAUX_COUPLES_SUIVANT } from '../config/constants.js';
import { getSortedCreneauxKeys, getPrioritizedCreneauxKeys, getRotatedJours, isAfternoonCreneau } from '../utils/helpers.js';
import Session from '../models/Session.js';
import StateManager from '../controllers/StateManager.js';
import ConflictService from './ConflictService.js';
import TeacherAvailabilityService from './TeacherAvailabilityService.js';
import VolumeService from './VolumeService.js';
import LogService from './LogService.js';

class SchedulingService {
    constructor() {
        // Compteurs de rotation par filière pour distribution équitable
        this.filiereRotationCounters = {};
        this.globalDayRotationCounter = 0;
    }

    /**
     * Obtient le compteur de rotation pour une filière
     * @param {string} filiere - La filière
     * @returns {number} Le compteur
     */
    getFiliereRotationCounter(filiere) {
        if (!this.filiereRotationCounters[filiere]) {
            this.filiereRotationCounters[filiere] = 0;
        }
        return this.filiereRotationCounters[filiere];
    }

    /**
     * Incrémente le compteur de rotation pour une filière
     * @param {string} filiere - La filière
     */
    incrementFiliereRotationCounter(filiere) {
        if (!this.filiereRotationCounters[filiere]) {
            this.filiereRotationCounters[filiere] = 0;
        }
        this.filiereRotationCounters[filiere]++;
    }

    /**
     * Obtient les jours avec rotation spécifique à la filière
     * @param {string} filiere - La filière
     * @returns {Array<string>} Les jours avec rotation
     */
    getRotatedJoursForFiliere(filiere) {
        const counter = this.getFiliereRotationCounter(filiere);
        const rotatedJours = getRotatedJours(counter);

        // Inclure le samedi matin (jusqu'à 10h15 maximum)
        // On garde tous les jours y compris Samedi
        return rotatedJours;
    }

    /**
     * Vérifie si un créneau est autorisé le samedi (matin uniquement)
     * @param {string} creneau - Le créneau
     * @returns {boolean} True si autorisé
     */
    isSaturdayMorningSlot(creneau) {
        const creneaux = getSortedCreneauxKeys();
        const creneauIndex = creneaux.indexOf(creneau);

        // Seulement les 2 premiers créneaux du samedi (8h30 et 10h15 généralement)
        return creneauIndex <= 1;
    }

    /**
     * Génère automatiquement toutes les séances manquantes
     * @param {Object} options - Options de génération
     * @returns {Object} { success: boolean, stats: Object }
     */
    /**
 * Génère automatiquement toutes les séances manquantes
 * ET attribue les enseignants/salles aux séances existantes
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

        // Réinitialiser les compteurs de rotation
        this.filiereRotationCounters = {};
        this.globalDayRotationCounter = 0;

        const stats = {
            total: 0,
            created: 0,
            failed: 0,
            skipped: 0,
            teachersAssigned: 0,
            roomsAssigned: 0
        };

        // ===== ÉTAPE 1 : Attribuer les enseignants aux séances EXISTANTES =====
        if (assignTeachers) {
            LogService.info('👨‍🏫 ÉTAPE 1 : Attribution des enseignants aux séances existantes...');

            const allSeances = StateManager.getSeances();
            const seancesSansEnseignant = allSeances.filter(s => !s.hasTeacher());

            LogService.info(`📋 Trouvé ${seancesSansEnseignant.length} séance(s) sans enseignant`);

            for (const seance of seancesSansEnseignant) {
                try {
                    const matiereInfo = StateManager.state.matiereGroupes[seance.matiere];
                    const nbEnseignantsTP = (seance.type === 'TP' && matiereInfo)
                        ? (matiereInfo.nbEnseignantsTP || 1)
                        : 1;

                    const teachers = this.assignTeachersToSession(seance, options, nbEnseignantsTP);

                    if (teachers && teachers.length > 0) {
                        seance.setTeachers(teachers);
                        stats.teachersAssigned++;
                        LogService.success(`✅ ${teachers.join(', ')} → ${seance.matiere} (${seance.type}) [${seance.jour} ${seance.creneau}]`);
                    } else {
                        LogService.warning(`⚠️ Aucun enseignant trouvé pour ${seance.matiere} (${seance.type}) [${seance.jour} ${seance.creneau}]`);
                    }
                } catch (error) {
                    LogService.error(`❌ Erreur attribution enseignant: ${error.message}`);
                }
            }

            if (stats.teachersAssigned > 0) {
                StateManager.saveState();
                LogService.success(`✅ ${stats.teachersAssigned} enseignant(s) attribué(s) aux séances existantes`);
            }
        }

        // ===== ÉTAPE 2 : Attribuer les salles aux séances EXISTANTES =====
        if (assignRooms) {
            LogService.info('🏛️ ÉTAPE 2 : Attribution des salles aux séances existantes...');

            const allSeances = StateManager.getSeances();
            const seancesSansSalle = allSeances.filter(s => !s.hasRoom() && s.type !== 'TP');

            LogService.info(`📋 Trouvé ${seancesSansSalle.length} séance(s) sans salle`);

            for (const seance of seancesSansSalle) {
                try {
                    const room = this.assignRoomToSession(seance);

                    if (room) {
                        seance.setRoom(room);
                        stats.roomsAssigned++;
                        LogService.success(`✅ ${room} → ${seance.matiere} (${seance.type}) [${seance.jour} ${seance.creneau}]`);
                    } else {
                        LogService.warning(`⚠️ Aucune salle disponible pour ${seance.matiere} (${seance.type}) [${seance.jour} ${seance.creneau}]`);
                    }
                } catch (error) {
                    LogService.error(`❌ Erreur attribution salle: ${error.message}`);
                }
            }

            if (stats.roomsAssigned > 0) {
                StateManager.saveState();
                LogService.success(`✅ ${stats.roomsAssigned} salle(s) attribuée(s) aux séances existantes`);
            }
        }

        // ===== ÉTAPE 3 : Créer les nouvelles séances manquantes =====
        LogService.info('📅 ÉTAPE 3 : Création des séances manquantes...');

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

        // ===== RÉSUMÉ FINAL =====
        LogService.success(`
╔════════════════════════════════════════════╗
║  ✅ GÉNÉRATION TERMINÉE                    ║
╠════════════════════════════════════════════╣
║  📊 Nouvelles séances créées : ${stats.created.toString().padStart(3)}       ║
║  ⏭️  Séances déjà existantes : ${stats.skipped.toString().padStart(3)}       ║
║  ❌ Séances échouées         : ${stats.failed.toString().padStart(3)}       ║
║  📋 Total théorique          : ${stats.total.toString().padStart(3)}       ║
╠════════════════════════════════════════════╣
║  👨‍🏫 Enseignants attribués    : ${stats.teachersAssigned.toString().padStart(3)}       ║
║  🏛️  Salles attribuées        : ${stats.roomsAssigned.toString().padStart(3)}       ║
╚════════════════════════════════════════════╝
    `);

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

        LogService.info(`📚 Génération pour ${subject.nom} (Filière: ${subject.filiere})`);

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
     * Génère les séances de Cours avec répartition hebdomadaire
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

            // Trouver un créneau disponible avec rotation par filière
            const slot = this.findAvailableSlotWithRotation(session, subject.filiere, options);

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

            // Incrémenter le compteur de rotation pour cette filière
            this.incrementFiliereRotationCounter(subject.filiere);

            LogService.success(`✅ Cours créé: ${subject.nom} - ${sectionName} [${slot.jour} ${slot.creneau}]`);
        }

        return stats;
    }

    /**
     * Génère les séances de TD avec répartition hebdomadaire
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

                // Trouver un créneau avec rotation par filière
                const slot = this.findAvailableSlotWithRotation(session, subject.filiere, options);

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

                // Incrémenter le compteur de rotation
                this.incrementFiliereRotationCounter(subject.filiere);

                LogService.success(`✅ TD créé: ${subject.nom} - ${sectionName} ${groupeName} [${slot.jour} ${slot.creneau}]`);
            }
        }

        return stats;
    }

    /**
     * Génère les séances de TP avec répartition hebdomadaire
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

                // Trouver un créneau couplé disponible avec rotation
                const slot = this.findAvailableCoupledSlotWithRotation(session, subject.filiere, options);

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

                // Incrémenter le compteur de rotation
                this.incrementFiliereRotationCounter(subject.filiere);

                LogService.success(`✅ TP créé: ${subject.nom} - ${sectionName} ${groupeName} [${slot.jour} ${slot.creneau}-${slot.creneauCoupled}]`);
            }
        }

        return stats;
    }

    /**
     * Trouve un créneau disponible avec rotation par filière
     * @param {Session} session - La séance
     * @param {string} filiere - La filière
     * @param {Object} options - Options
     * @returns {Object|null} { jour, creneau } ou null
     */
    findAvailableSlotWithRotation(session, filiere, options) {
        const sortedCreneaux = getPrioritizedCreneauxKeys();
        const allSeances = StateManager.getSeances();
        const sallesInfo = StateManager.state.sallesInfo;

        // Obtenir les jours avec rotation pour cette filière
        const rotatedJours = this.getRotatedJoursForFiliere(filiere);

        let iterations = 0;
        const maxIterations = MAX_AUTO_PLANNING_ITERATIONS;

        for (const jour of rotatedJours) {
            // Filtrage spécial pour le samedi (matin uniquement)
            const creneauxToCheck = jour === 'Samedi'
                ? sortedCreneaux.filter(c => this.isSaturdayMorningSlot(c))
                : sortedCreneaux;

            for (const creneau of creneauxToCheck) {
                iterations++;
                if (iterations > maxIterations) {
                    return null;
                }

                // CONTRAINTE: Ne pas planifier des Cours de la même matière en parallèle
                if (session.type === 'Cours') {
                    const parallelCoursExists = allSeances.some(s =>
                        s.type === 'Cours' &&
                        s.matiere === session.matiere &&
                        s.jour === jour &&
                        s.creneau === creneau
                    );

                    if (parallelCoursExists) continue;
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
     * Trouve un créneau couplé disponible pour un TP avec rotation
     * @param {Session} session - La séance TP
     * @param {string} filiere - La filière
     * @param {Object} options - Options
     * @returns {Object|null} { jour, creneau, creneauCoupled } ou null
     */
    findAvailableCoupledSlotWithRotation(session, filiere, options) {
        const sortedCreneaux = getPrioritizedCreneauxKeys();
        const allSeances = StateManager.getSeances();
        const sallesInfo = StateManager.state.sallesInfo;

        // Obtenir les jours avec rotation pour cette filière
        const rotatedJours = this.getRotatedJoursForFiliere(filiere);

        for (const jour of rotatedJours) {
            // Filtrage spécial pour le samedi (pas de TP couplé possible le samedi)
            if (jour === 'Samedi') {
                continue; // Les TP nécessitent 2 créneaux consécutifs, pas possible le samedi matin
            }

            const creneauxToCheck = sortedCreneaux;

            for (const creneau of creneauxToCheck) {
                const creneauCoupled = CRENEAUX_COUPLES_SUIVANT[creneau];

                if (!creneauCoupled) continue;

                // CONTRAINTE: Ne pas planifier des TP de la même matière en parallèle
                const parallelTPExists = allSeances.some(s =>
                    s.type === 'TP' &&
                    s.matiere === session.matiere &&
                    s.jour === jour &&
                    (s.creneau === creneau || s.creneau === creneauCoupled)
                );

                if (parallelTPExists) continue;

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

    // ... reste des méthodes existantes (createSessionTemplate, assignTeachersToSession, etc.) ...

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
        const sortedCreneaux = getPrioritizedCreneauxKeys();

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
            StateManager.state.enseignantVolumesSupplementaires,
            StateManager.state.forfaits || []
        );

        const maxWorkload = globalMetrics.globalVHM * 1.5;
        const assignedCounts = {};

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

        // --- DÉBUT DE LA LOGIQUE MISE À JOUR ---

        // Priorité : pool de salles spécifiques par filière si configuré
        const autoSalles = StateManager.state.autoSallesParFiliere[session.filiere];

        if (autoSalles && autoSalles[session.type]) {

            // S'assurer que c'est un tableau (pour compatibilité ascendante)
            const preferredRooms = Array.isArray(autoSalles[session.type])
                ? autoSalles[session.type]
                : [autoSalles[session.type]]; // Gère aussi l'ancienne structure (string)

            // Trouver la première salle libre QUI EST DANS LE POOL
            const preferredAndFreeRoom = freeRooms.find(room => preferredRooms.includes(room));

            if (preferredAndFreeRoom) {
                // Salle préférée trouvée et libre !
                return preferredAndFreeRoom;
            }

            // Si aucune salle préférée n'est libre, on continue au fallback
            LogService.info(`[AutoSalle] Pool ${session.filiere} (${session.type}) défini, mais aucune salle du pool n'est libre.`);
        }

        // --- FIN DE LA LOGIQUE MISE À JOUR ---

        // Fallback (logique existante) : prendre la première salle libre
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