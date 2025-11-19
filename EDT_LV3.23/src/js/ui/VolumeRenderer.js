/**
 * Renderer pour l'affichage des volumes horaires
 * (Mis à jour : affichage simplifié — uniquement VHT annuel et VHM annuel)
 * + Ajustement : pour chaque enseignant, le volume d'automne est ajouté au volume de printemps
 *   (le forfait est compté une seule fois car inclus dans le calcul automne uniquement).
 * Modification : ajout d'une barre de progression dans la colonne "Total (hTP)"
 *                (même style / logique que TeacherVolumePreview).
 * @author Ibrahim Mrani - UCD
 */

import StateManager from '../controllers/StateManager.js';
import TeacherController from '../controllers/TeacherController.js';
import SubjectController from '../controllers/SubjectController.js';
import VolumeService from '../services/VolumeService.js';
import StorageService from '../services/StorageService.js';
import { safeText } from '../utils/sanitizers.js';
import SchedulingService from '../services/SchedulingService.js';

class VolumeRenderer {
    constructor() {
        this.container = null;
        this.annualMetrics = null; // cache des métriques annuelles
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

        // Calculer les métriques annuelles et mettre en cache (optimisation)
        this.annualMetrics = this.computeAnnualMetrics();

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
     * Calcule et retourne les métriques annuelles en s'appuyant sur StorageService et VolumeService
     * @returns {Object} annualMetrics
     */
    computeAnnualMetrics() {
        const enseignants = StateManager.state.enseignants || [];
        const allSubjects = StateManager.getSubjects(); // objets Subject
        const filieres = StateManager.state.filieres || [];

        // helper : récupérer matières pour une session (Automne / Printemps)
        const getSubjectsForSession = (sessionLabel) => {
            const sessionType = sessionLabel === 'autumn' ? 'Automne' : 'Printemps';
            const filieresNames = filieres
                .filter(f => f.session === sessionType)
                .map(f => f.nom);
            // Inclure matières sans filière également (compatibilité)
            return allSubjects.filter(s => !s.filiere || filieresNames.includes(s.filiere));
        };

        const autumnSubjects = getSubjectsForSession('autumn');
        const springSubjects = getSubjectsForSession('spring');

        // Charger les séances depuis le StorageService sans changer l'état courant
        const autumnSessionData = StorageService.loadSessionData("Session d'automne") || { seances: [], nextId: 1 };
        const springSessionData = StorageService.loadSessionData("Session de printemps") || { seances: [], nextId: 1 };

        // Forfaits : tentative de répartition par session si champ session présent
        const allForfaits = StateManager.state.forfaits || [];
        const forfaitsAutumn = allForfaits.filter(f => !f.session || String(f.session).toLowerCase().includes('automne') || String(f.session).toLowerCase().includes('autumn'));
        const forfaitsSpring = allForfaits.filter(f => String(f.session).toLowerCase().includes('printemps') || String(f.session).toLowerCase().includes('spring'));

        const volumesSupplementaires = StateManager.state.enseignantVolumesSupplementaires || {};

        // Calcul des métriques annuelles via VolumeService
        const annualMetrics = VolumeService.calculateAnnualGlobalMetrics(
            enseignants,
            autumnSubjects,
            autumnSessionData.seances || [],
            springSubjects,
            springSessionData.seances || [],
            volumesSupplementaires,
            forfaitsAutumn,
            forfaitsSpring
        );

        return annualMetrics || {
            autumn: {},
            spring: {},
            annualVHT: 0,
            annualVHM: 0,
            totalRegisteredTeachers: (enseignants || []).length
        };
    }

    /**
     * Rend les métriques globales (affichage simplifié : uniquement métriques annuelles)
     * @returns {string} HTML des métriques
     */
    renderGlobalMetrics() {
        const annualMetrics = this.annualMetrics || this.computeAnnualMetrics();

        const annualVHT = annualMetrics.annualVHT || 0;
        const annualVHM = annualMetrics.annualVHM || 0;
        const totalRegisteredTeachers = annualMetrics.totalRegisteredTeachers || (StateManager.state.enseignants || []).length;

        // Affichage simplifié : uniquement les métriques annuelles demandées (VHT annuel + VHM annuel)
        return `
            <div class="global-metrics">
                <h3>📊 Métriques Globales Annuelles</h3>
                <div class="metrics-grid">
                    <div class="metric-card highlight-annual">
                        <div class="metric-value">${safeText(String(annualVHT))}h</div>
                        <div class="metric-label">VHT Annuel (Automne + Printemps)</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${safeText(String(annualVHM))}h</div>
                        <div class="metric-label">VHM Annuel moyen par enseignant</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${safeText(String(totalRegisteredTeachers))}</div>
                        <div class="metric-label">Enseignants inscrits</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Calcule le pourcentage d'avancement pour un volume donné, selon la référence de charge
     * @param {number} volumeHours
     * @returns {number} pourcentage 0-100
     */
    computeProgressPercent(volumeHours) {
        let ref = 0;
        try {
            if (typeof SchedulingService !== 'undefined' && typeof SchedulingService.computeMaxWorkloadForCurrentSession === 'function') {
                ref = Number(SchedulingService.computeMaxWorkloadForCurrentSession() || 0);
            }
        } catch (e) {
            // ignore
        }
        if ((!ref || ref === 0) && StateManager && StateManager.state && StateManager.state.toleranceMaxWorkload) {
            ref = Number(StateManager.state.toleranceMaxWorkload || 0);
        }
        if (!ref || ref <= 0) {
            return Math.min(100, Math.round(volumeHours > 0 ? 100 : 0));
        }
        const pct = Math.round((Number(volumeHours || 0) / ref) * 100);
        return Math.max(0, Math.min(100, pct));
    }

    /**
     * Obtient la couleur selon le pourcentage (même logique que dans d'autres renderers)
     * @param {number} pct
     * @returns {string} couleur CSS
     */
    getProgressColor(pct) {
        if (pct >= 100) return '#28a745';
        if (pct >= 75) return '#ffc107';
        if (pct >= 50) return '#fd7e14';
        return '#dc3545';
    }

    /**
     * Rend le tableau des volumes par enseignant (session courante)
     * Remarque : pour la session de printemps, on ajoute au total du professeur
     * la part calculée pour l'automne (le forfait étant compté une fois via la logique automne).
     * Ajout : dans la colonne "Total (hTP)" on affiche la barre de progression suivie du total chiffré.
     * @returns {string} HTML du tableau
     */
    renderTeacherVolumes() {
        const teachers = TeacherController.getAllTeachersWithStats();
        const seances = StateManager.getSeances();
        const session = StateManager.state.header.session;

        const allVolumesCurrent = VolumeService.calculateAllVolumes(
            StateManager.state.enseignants,
            seances,
            StateManager.state.enseignantVolumesSupplementaires,
            session,
            StateManager.state.volumesAutomne
        );

        // Calculer les volumes d'automne par enseignant pour l'ajout si nécessaire
        const autumnSessionData = StorageService.loadSessionData("Session d'automne") || { seances: [] };
        const autumnPerTeacher = VolumeService.calculateAllVolumes(
            StateManager.state.enseignants,
            autumnSessionData.seances || [],
            StateManager.state.enseignantVolumesSupplementaires,
            "Session d'automne",
            {}
        );

        // Récupérer VHM annuel pour référentiel d'écart
        const VHM_annual = (this.annualMetrics && this.annualMetrics.annualVHM) ? this.annualMetrics.annualVHM : (this.computeAnnualMetrics().annualVHM || 0);

        // Trier par volume décroissant (en tenant compte de l'ajout d'automne si on est en printemps)
        teachers.sort((a, b) => {
            const volA = (allVolumesCurrent[a.nom] || 0) + ((session === "Session de printemps") ? (autumnPerTeacher[a.nom] || 0) : 0);
            const volB = (allVolumesCurrent[b.nom] || 0) + ((session === "Session de printemps") ? (autumnPerTeacher[b.nom] || 0) : 0);
            return volB - volA;
        });

        let html = `
            <div class="teacher-volumes">
                <h3>👨‍🏫 Volumes Horaires par Enseignant (session courante)</h3>
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
                            <th>Écart vs VHM annuel</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        teachers.forEach(teacher => {
            const volume = TeacherController.getTeacherVolume(teacher.nom);
            // Base : volume de la session courante
            let totalVolume = allVolumesCurrent[teacher.nom] || 0;

            // Si nous sommes en session de printemps, ajouter le volume d'automne (forfait inclus dans autumnPerTeacher)
            if (session === "Session de printemps") {
                totalVolume += autumnPerTeacher[teacher.nom] || 0;
            }

            const ecartVHM = totalVolume - VHM_annual;
            const ecartClass = ecartVHM > 0 ? 'positive' : ecartVHM < 0 ? 'negative' : 'neutral';

            // compute progress bar for the totalVolume
            const pct = this.computeProgressPercent(totalVolume);
            const color = this.getProgressColor(pct);

            // progress HTML (minimal classes; add CSS in your stylesheets to match TeacherVolumePreview)
            const progressHTML = `
                <span class="tvp-progress-wrapper" title="${totalVolume} h — ${pct}%">
                    <span class="tvp-progress-bar" style="display:inline-block; width:110px; height:10px; background:#e9ecef; border-radius:6px; overflow:hidden; vertical-align:middle;">
                        <span class="tvp-progress-fill" style="display:inline-block; height:100%; width:${pct}%; background:${color}; transition:width .35s;"></span>
                    </span>
                    <span class="tvp-progress-text" style="margin-left:8px; font-size:0.9rem; vertical-align:middle; min-width:36px; display:inline-block; text-align:right;">${pct}%</span>
                </span>
            `;

            html += `
                <tr>
                    <td><strong>${safeText(teacher.nom)}</strong></td>
                    <td>${safeText(String(teacher.stats.totalSeances || 0))}</td>
                    <td>${safeText(String(teacher.stats.cours || 0))}</td>
                    <td>${safeText(String(teacher.stats.td || 0))}</td>
                    <td>${safeText(String(teacher.stats.tp || 0))}</td>
                    <td>${safeText(String(volume.enseignement || 0))}</td>
                    <td>${safeText(String(volume.forfait || 0))}</td>
                    <td>${progressHTML} <strong style="margin-left:8px;">${safeText(String(totalVolume))}</strong></td>
                    <td class="ecart ${ecartClass}">${ecartVHM > 0 ? '+' : ''}${safeText(String(ecartVHM))}</td>
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
     * Rend le tableau des volumes par matière (session courante)
     * @returns {string} HTML du tableau
     */
    renderSubjectVolumes() {
        const subjects = SubjectController.getAllSubjectsWithStats();
        const seances = StateManager.getSeances();

        // Trier par VHT décroissant
        subjects.sort((a, b) => b.stats.vht - a.stats.vht);

        let html = `
            <div class="subject-volumes">
                <h3>📚 Volumes Horaires par Matière (session courante)</h3>
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
                    <td>${safeText(String(subject.config.sections_cours || 0))}</td>
                    <td><strong>${safeText(String(subject.stats.vht || 0))}</strong></td>
                    <td>${safeText(String(subject.stats.plannedCours || 0))}/${safeText(String(subject.stats.expectedCours || 0))}</td>
                    <td>${safeText(String(subject.stats.plannedTD || 0))}/${safeText(String(subject.stats.expectedTD || 0))}</td>
                    <td>${safeText(String(subject.stats.plannedTP || 0))}/${safeText(String(subject.stats.expectedTP || 0))}</td>
                    <td>${safeText(String((subject.stats.enseignants || []).length))}</td>
                    <td class="completion ${completionClass}">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${safeText(String(completion))}%"></div>
                        </div>
                        ${safeText(String(completion))}%
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
                    <p>Enseignement : <strong>${safeText(String(volume.enseignement || 0))} hTP</strong></p>
                    <p>Forfait : <strong>${safeText(String(volume.forfait || 0))} hTP</strong></p>
                    <p>Total : <strong>${safeText(String(volume.total || 0))} hTP</strong></p>
                </div>

                <div class="detail-section">
                    <h4>Séances</h4>
                    <p>Total : ${safeText(String(stats.totalSeances || 0))}</p>
                    <p>Cours : ${safeText(String(stats.cours || 0))} | TD : ${safeText(String(stats.td || 0))} | TP : ${safeText(String(stats.tp || 0))}</p>
                </div>

                <div class="detail-section">
                    <h4>Matières Enseignées</h4>
                    <ul>
                        ${ (stats.matieres || []).map(m => `<li>${safeText(m)}</li>`).join('') }
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

    /**
     * Retourne une map { "Nom Enseignant": volumeAnnuelNumber, ... }
     * Cherche d'abord dans les propriétés/méthodes internes, sinon calcule via VolumeService.
     */
    getAnnualTeacherVolumes() {
        // helper normalization
        const normalize = s => String(s || '').trim();

        // 1) tenter des chemins probables dans VolumeRenderer
        try {
            // méthodes explicites si elles existent
            if (typeof this.getAllTeacherVolumes === 'function') {
                const m = this.getAllTeacherVolumes();
                if (m && Object.keys(m).length) return m;
            }
            if (typeof this.getTeacherAnnualMap === 'function') {
                const m = this.getTeacherAnnualMap();
                if (m && Object.keys(m).length) return m;
            }

            // propriétés courantes
            const candidates = [
                this.annualTeacherVolumes,
                this.teacherAnnualVolumes,
                this.annualVolumes,
                this.data && this.data.teacherAnnualVolumes,
                this.metrics && this.metrics.teacherAnnualVolumes,
                this.state && this.state.teacherAnnualVolumes,
                this.annualMetrics && this.annualMetrics.perTeacher,
                this.annualmetrics && this.annualmetrics.perTeacher,
                this.annualMetrics && this.annualMetrics.teacherVolumes,
                this.annualmetrics && this.annualmetrics.teacherVolumes
            ];

            for (const cand of candidates) {
                if (cand && typeof cand === 'object' && Object.keys(cand).length) return cand;
            }

        } catch (e) {
            console.warn('VolumeRenderer.getAnnualTeacherVolumes: erreur lecture interne', e);
        }

        // 3) fallback robuste : tenter de calculer via VolumeService si disponible
        try {
            if (typeof VolumeService !== 'undefined' && VolumeService && typeof VolumeService.calculateAllVolumes === 'function') {
                const enseignants = (typeof StateManager !== 'undefined' && StateManager.state && Array.isArray(StateManager.state.enseignants))
                    ? StateManager.state.enseignants
                    : [];
                const allSeances = (typeof StateManager !== 'undefined' && typeof StateManager.getSeances === 'function')
                    ? StateManager.getSeances()
                    : [];

                const combined = VolumeService.calculateAllVolumes(enseignants, allSeances, (StateManager.state && StateManager.state.enseignantVolumesSupplementaires) || {}, (StateManager.state && StateManager.state.header && StateManager.state.header.session) || '', (StateManager.state && StateManager.state.volumesAutomne) || {}) || {};

                // renvoyer la map calculée (clés intactes)
                if (combined && Object.keys(combined).length) return combined;
            }
        } catch (e) {
            console.warn('VolumeRenderer.getAnnualTeacherVolumes: erreur fallback VolumeService', e);
        }

        // 4) dernier recours: tenter d'inférer les volumes depuis des structures internes (parcours deep)
        try {
            const tryExtractNumeric = obj => {
                const out = {};
                if (!obj || typeof obj !== 'object') return out;
                Object.keys(obj).forEach(k => {
                    const v = obj[k];
                    if (typeof v === 'number' && !isNaN(v)) out[k] = v;
                    else if (v && typeof v === 'object') {
                        // tenter clés internes communes
                        const candKeys = ['total','annual','volume','h','hTP','v','value','hours'];
                        for (const ck of candKeys) {
                            if (v[ck] !== undefined && !isNaN(Number(v[ck]))) {
                                out[k] = Number(v[ck]);
                                break;
                            }
                        }
                    }
                });
                return out;
            };

            // parcourir quelques propriétés connues pour tenter d'extraire
            const probe = this.annualMetrics || this.annualmetrics || this.data || this.metrics || this.state || this;
            if (probe && typeof probe === 'object') {
                const candidate = tryExtractNumeric(probe);
                if (Object.keys(candidate).length) return candidate;
            }

        } catch (e) {
            console.warn('VolumeRenderer.getAnnualTeacherVolumes: deep probe failed', e);
        }

        // Si rien trouvé, renvoyer {}
        return {};
    }
}

// Export d'une instance singleton
export default new VolumeRenderer();