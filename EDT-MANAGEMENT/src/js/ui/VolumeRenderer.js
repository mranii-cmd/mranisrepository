/**
 * Renderer pour l'affichage des volumes horaires
 * @author Ibrahim Mrani - UCD
 */

import StateManager from '../controllers/StateManager.js';
import TeacherController from '../controllers/TeacherController.js';
import SubjectController from '../controllers/SubjectController.js';
import VolumeService from '../services/VolumeService.js';
import { safeText } from '../utils/sanitizers.js';

class VolumeRenderer {
    constructor() {
        this.container = null;
    }

    /**
     * Initialise le renderer
     * @param {string} containerId - L'ID du conteneur
     */
    init(containerId = 'volumesContainer') {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.warn(`Container #${containerId} not found`);
        }
    }

    /**
     * Rend le tableau complet des volumes horaires
     */
    render() {
        if (!this.container) return;

        const html = `
            <div class="volumes-section">
                ${this.renderGlobalMetrics()}
                ${this.renderTeacherVolumes()}
                ${this.renderSubjectVolumes()}
            </div>
        `;

        this.container.innerHTML = html;
    }

    /**
     * Rend les métriques globales
     * @returns {string} HTML des métriques
     */
    renderGlobalMetrics() {
        const seances = StateManager.getSeances();
        const subjects = StateManager.getCurrentSessionSubjects();
        const enseignants = StateManager.state.enseignants;
        const forfaits = StateManager.state.forfaits || [];

        const globalMetrics = VolumeService.calculateGlobalVolumeMetrics(
            subjects,
            seances,
            enseignants.length,
            StateManager.state.enseignantVolumesSupplementaires,
            forfaits
        );

        return `
            <div class="global-metrics">
                <h3>📊 Métriques Globales</h3>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-value">${globalMetrics.globalVHT}h</div>
                        <div class="metric-label">VHT Global</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${globalMetrics.globalVHM}h</div>
                        <div class="metric-label">VHM Global</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${globalMetrics.totalUniqueTeachers}/${globalMetrics.totalRegisteredTeachers}</div>
                        <div class="metric-label">Enseignants Actifs</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${seances.length}</div>
                        <div class="metric-label">Séances Planifiées</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Rend le tableau des volumes par enseignant
     * @returns {string} HTML du tableau
     */
    renderTeacherVolumes() {
        const teachers = TeacherController.getAllTeachersWithStats();
        const seances = StateManager.getSeances();
        const session = StateManager.state.header.session;

        const allVolumes = VolumeService.calculateAllVolumes(
            StateManager.state.enseignants,
            seances,
            StateManager.state.enseignantVolumesSupplementaires,
            session,
            StateManager.state.volumesAutomne
        );

        const globalMetrics = VolumeService.calculateGlobalVolumeMetrics(
            StateManager.getCurrentSessionSubjects(),
            seances,
            StateManager.state.enseignants.length,
            StateManager.state.enseignantVolumesSupplementaires,
            StateManager.state.forfaits || []
        );

        const VHM = globalMetrics.globalVHM;

        // Trier par volume décroissant
        teachers.sort((a, b) => {
            const volA = allVolumes[a.nom] || 0;
            const volB = allVolumes[b.nom] || 0;
            return volB - volA;
        });

        let html = `
            <div class="teacher-volumes">
                <h3>👨‍🏫 Volumes Horaires par Enseignant</h3>
                <table class="volumes-table">
                    <thead>
                        <tr>
                            <th>Enseignant</th>
                            <th>Séances</th>
                            <th>Cours</th>
                            <th>TD</th>
                            <th>TP</th>
                            <th>Vol. Enseignement (hTP)</th>
                            <th>Vol. Forfait (hTP)</th>
                            <th>Total (hTP)</th>
                            <th>Écart VHM</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        teachers.forEach(teacher => {
            const volume = TeacherController.getTeacherVolume(teacher.nom);
            const totalVolume = allVolumes[teacher.nom] || 0;
            const ecartVHM = totalVolume - VHM;
            const ecartClass = ecartVHM > 0 ? 'positive' : ecartVHM < 0 ? 'negative' : 'neutral';

            html += `
                <tr>
                    <td><strong>${safeText(teacher.nom)}</strong></td>
                    <td>${teacher.stats.totalSeances}</td>
                    <td>${teacher.stats.cours}</td>
                    <td>${teacher.stats.td}</td>
                    <td>${teacher.stats.tp}</td>
                    <td>${volume.enseignement}</td>
                    <td>${volume.forfait}</td>
                    <td><strong>${totalVolume}</strong></td>
                    <td class="ecart ${ecartClass}">${ecartVHM > 0 ? '+' : ''}${ecartVHM}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        return html;
    }

    /**
     * Rend le tableau des volumes par matière
     * @returns {string} HTML du tableau
     */
    renderSubjectVolumes() {
        const subjects = SubjectController.getAllSubjectsWithStats();
        const seances = StateManager.getSeances();

        // Trier par VHT décroissant
        subjects.sort((a, b) => b.stats.vht - a.stats.vht);

        let html = `
            <div class="subject-volumes">
                <h3>📚 Volumes Horaires par Matière</h3>
                <table class="volumes-table">
                    <thead>
                        <tr>
                            <th>Matière</th>
                            <th>Filière</th>
                            <th>Sections</th>
                            <th>VHT (hTP)</th>
                            <th>Cours (Planifiés/Attendus)</th>
                            <th>TD (Planifiés/Attendus)</th>
                            <th>TP (Planifiés/Attendus)</th>
                            <th>Enseignants</th>
                            <th>Taux Complétion</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        subjects.forEach(subject => {
            const completion = subject.stats.completionRate;
            const completionClass = completion >= 100 ? 'complete' : completion >= 50 ? 'partial' : 'incomplete';

            html += `
                <tr>
                    <td><strong>${safeText(subject.nom)}</strong></td>
                    <td>${safeText(subject.config.filiere)}</td>
                    <td>${subject.config.sections_cours}</td>
                    <td><strong>${subject.stats.vht}</strong></td>
                    <td>${subject.stats.plannedCours}/${subject.stats.expectedCours}</td>
                    <td>${subject.stats.plannedTD}/${subject.stats.expectedTD}</td>
                    <td>${subject.stats.plannedTP}/${subject.stats.expectedTP}</td>
                    <td>${subject.stats.enseignants.length}</td>
                    <td class="completion ${completionClass}">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${completion}%"></div>
                        </div>
                        ${completion}%
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        return html;
    }

    /**
     * Rend les volumes pour un enseignant spécifique
     * @param {string} enseignant - Le nom de l'enseignant
     * @returns {string} HTML détaillé
     */
    renderTeacherDetail(enseignant) {
        const stats = TeacherController.getTeacherStats(enseignant);
        const volume = TeacherController.getTeacherVolume(enseignant);
        const souhaits = StateManager.state.enseignantSouhaits[enseignant] || {};

        return `
            <div class="teacher-detail">
                <h3>👤 ${safeText(enseignant)}</h3>
                
                <div class="detail-section">
                    <h4>Volumes Horaires</h4>
                    <p>Enseignement : <strong>${volume.enseignement} hTP</strong></p>
                    <p>Forfait : <strong>${volume.forfait} hTP</strong></p>
                    <p>Total : <strong>${volume.total} hTP</strong></p>
                </div>

                <div class="detail-section">
                    <h4>Séances</h4>
                    <p>Total : ${stats.totalSeances}</p>
                    <p>Cours : ${stats.cours} | TD : ${stats.td} | TP : ${stats.tp}</p>
                </div>

                <div class="detail-section">
                    <h4>Matières Enseignées</h4>
                    <ul>
                        ${stats.matieres.map(m => `<li>${safeText(m)}</li>`).join('')}
                    </ul>
                </div>

                <div class="detail-section">
                    <h4>Souhaits</h4>
                    <p>1er choix : ${safeText(souhaits.choix1 || 'N/A')}</p>
                    <p>2ème choix : ${safeText(souhaits.choix2 || 'N/A')}</p>
                    <p>3ème choix : ${safeText(souhaits.choix3 || 'N/A')}</p>
                </div>
            </div>
        `;
    }
}

// Export d'une instance singleton
export default new VolumeRenderer();