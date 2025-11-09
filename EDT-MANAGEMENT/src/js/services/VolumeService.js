/**
 * Service de calcul des volumes horaires
 * @author Ibrahim Mrani - UCD
 */

import { DEFAULT_VOLUME_HTP } from '../config/constants.js';
import StateManager from '../controllers/StateManager.js';

class VolumeService {
    /**
     * Calcule les détails de volume pour un enseignant
     * @param {string} enseignant - Le nom de l'enseignant
     * @param {Array<Session>} seances - Les séances
     * @param {Object} volumesSupplementaires - Les volumes supplémentaires par enseignant
     * @returns {Object} { enseignement, forfait, total }
     */
    calculateTeacherVolumeDetails(enseignant, seances, volumesSupplementaires) {
        let volumeEnseignement = 0;

        seances.forEach(seance => {
            if (seance.hTP_Affecte > 0 && seance.enseignantsArray.includes(enseignant)) {
                const teachers = seance.enseignantsArray || [seance.enseignant];
                const hTP_base = seance.hTP_Affecte;
                
                // Pour les TP, chaque enseignant compte le volume total
                // Pour Cours/TD, on divise par le nombre d'enseignants
                const hTP_credit = (seance.type === 'TP') 
                    ? hTP_base 
                    : (hTP_base / teachers.length);
                
                volumeEnseignement += hTP_credit;
            }
        });

        let volumeSupplementaire = 0;
        if (volumesSupplementaires[enseignant]) {
            volumesSupplementaires[enseignant].forEach(item => {
                volumeSupplementaire += item.volume;
            });
        }

        // Ajouter les forfaits
        let volumeForfaits = 0;
        if (StateManager.state.forfaits) {
            const forfaits = StateManager.state.forfaits.filter(f => f.enseignant === enseignant);
            volumeForfaits = forfaits.reduce((sum, f) => sum + f.volumeHoraire, 0);
        }

        const volumeTotalForfait = volumeSupplementaire + volumeForfaits;

        return {
            enseignement: parseFloat(volumeEnseignement.toFixed(0)),
            forfait: parseFloat(volumeTotalForfait.toFixed(0)),
            total: parseFloat((volumeEnseignement + volumeTotalForfait).toFixed(0))
        };
    }

    /**
     * Calcule les volumes horaires pour tous les enseignants
     * @param {Array<string>} enseignants - Liste des enseignants
     * @param {Array<Session>} seances - Les séances
     * @param {Object} volumesSupplementaires - Les volumes supplémentaires
     * @param {string} currentSession - La session en cours
     * @param {Object} volumesAutomne - Les volumes de la session d'automne
     * @returns {Object} Les volumes par enseignant
     */
    calculateAllVolumes(enseignants, seances, volumesSupplementaires, currentSession, volumesAutomne = {}) {
        const volumeHTP = {};

        enseignants.forEach(ens => {
            const details = this.calculateTeacherVolumeDetails(ens, seances, volumesSupplementaires);
            let volumeTotalPourSession = details.enseignement;

            // Le volume supplémentaire n'est ajouté QUE pour la session d'automne
            if (currentSession === "Session d'automne") {
                volumeTotalPourSession += details.forfait;
            }

            // Si on est au printemps, ajouter le volume total de l'automne
            if (currentSession === "Session de printemps") {
                if (volumesAutomne[ens]) {
                    volumeTotalPourSession += volumesAutomne[ens];
                }
            }

            volumeHTP[ens] = volumeTotalPourSession;
        });

        return volumeHTP;
    }

    /**
     * Calcule le nombre d'enseignants attribués pour une matière
     * @param {string} matiere - La matière
     * @param {Array<Session>} seances - Les séances
     * @returns {number} Le nombre d'enseignants
     */
    getTeachersCountForSubject(matiere, seances) {
        const teachers = new Set();
        seances.forEach(s => {
            if (s.matiere === matiere) {
                s.enseignantsArray.forEach(ens => teachers.add(ens));
            }
        });
        return teachers.size;
    }

    /**
     * Calcule les métriques de volume pour une matière
     * @param {Subject} subject - La matière
     * @param {Array<Session>} seances - Les séances
     * @param {number} totalTeachers - Nombre total d'enseignants
     * @returns {Object} { total, nombreEnseignants, nombreEnseignantsTotal, moyen }
     */
    calculateSubjectVolumeMetrics(subject, seances, totalTeachers) {
        const volumeHoraireTotal = subject.calculateVHT();
        const nombreEnseignantsAttribues = this.getTeachersCountForSubject(subject.nom, seances);
        
        let volumeHoraireMoyen = 0;
        if (totalTeachers > 0) {
            volumeHoraireMoyen = Math.round(volumeHoraireTotal / totalTeachers);
        }

        return {
            total: volumeHoraireTotal,
            nombreEnseignants: nombreEnseignantsAttribues,
            nombreEnseignantsTotal: totalTeachers,
            moyen: volumeHoraireMoyen
        };
    }

    /**
     * Calcule les métriques globales de volume
     * @param {Array<Subject>} subjects - Toutes les matières
     * @param {Array<Session>} seances - Les séances
     * @param {number} totalTeachers - Nombre total d'enseignants
     * @param {Object} volumesSupplementaires - Les volumes supplémentaires
     * @param {Array} forfaits - Les forfaits (optionnel)
     * @returns {Object} { globalVHT, totalUniqueTeachers, totalRegisteredTeachers, globalVHM }
     */
    calculateGlobalVolumeMetrics(subjects, seances, totalTeachers, volumesSupplementaires, forfaits = []) {
        let globalVHT = 0;

        // Calculer le VHT de toutes les matières
        subjects.forEach(subject => {
            globalVHT += subject.calculateVHT();
        });

        // Ajouter les volumes supplémentaires
        for (const enseignant in volumesSupplementaires) {
            volumesSupplementaires[enseignant].forEach(item => {
                globalVHT += item.volume;
            });
        }

        // Ajouter les forfaits au VHT Global
        if (forfaits && Array.isArray(forfaits)) {
            forfaits.forEach(forfait => {
                globalVHT += forfait.volumeHoraire;
            });
        }

        // Compter les enseignants uniques ayant des séances
        const allAttributedTeachers = new Set();
        seances.forEach(s => {
            s.enseignantsArray.forEach(ens => allAttributedTeachers.add(ens));
        });

        const totalUniqueTeachers = allAttributedTeachers.size;

        // Calculer le VHM global
        let globalVHM = 0;
        if (totalTeachers > 0) {
            globalVHM = Math.round(globalVHT / totalTeachers);
        }

        return {
            globalVHT,
            totalUniqueTeachers,
            totalRegisteredTeachers: totalTeachers,
            globalVHM
        };
    }

    /**
     * Calcule les groupes planifiés par matière
     * @param {Array<Session>} seances - Les séances
     * @returns {Object} Les groupes planifiés par matière et type
     */
    calculatePlannedGroups(seances) {
        const plannedGroups = {};

        seances.forEach(seance => {
            if (seance.type === 'Cours' || seance.type === 'TD' || seance.type === 'TP') {
                const matiere = seance.matiere;
                const type = seance.type;
                const uniqueGroup = seance.uniqueStudentEntity;

                if (!plannedGroups[matiere]) {
                    plannedGroups[matiere] = { 
                        Cours: new Set(), 
                        TD: new Set(), 
                        TP: new Set() 
                    };
                }

                if (plannedGroups[matiere][type]) {
                    plannedGroups[matiere][type].add(uniqueGroup);
                }
            }
        });

        return plannedGroups;
    }

    /**
     * Calcule les groupes attribués (avec enseignant) par matière
     * @param {Array<Session>} seances - Les séances
     * @returns {Object} Les groupes attribués par matière
     */
    calculateAssignedGroups(seances) {
        const attributedGroups = {};

        seances.forEach(seance => {
            if ((seance.enseignantsArray && seance.enseignantsArray.length > 0) && 
                (seance.type === 'Cours' || seance.type === 'TD' || seance.type === 'TP')) {
                
                const matiere = seance.matiere;
                const type = seance.type;
                const uniqueGroup = seance.uniqueStudentEntity;

                if (!attributedGroups[matiere]) {
                    attributedGroups[matiere] = { 
                        Cours: new Set(), 
                        TD: new Set(), 
                        TP: new Set(), 
                        TP_Enseignants: 0 
                    };
                }

                if (attributedGroups[matiere][type]) {
                    attributedGroups[matiere][type].add(uniqueGroup);
                    
                    if (type === 'TP' && seance.hTP_Affecte > 0 && seance.enseignantsArray) {
                        attributedGroups[matiere].TP_Enseignants += seance.enseignantsArray.length;
                    }
                }
            }
        });

        // Convertir les Sets en tailles
        const result = {};
        for (const matiere in attributedGroups) {
            result[matiere] = {
                Cours: attributedGroups[matiere].Cours.size,
                TD: attributedGroups[matiere].TD.size,
                TP: attributedGroups[matiere].TP.size,
                TP_Enseignants: attributedGroups[matiere].TP_Enseignants
            };
        }

        return result;
    }
}

// Export d'une instance singleton
export default new VolumeService();