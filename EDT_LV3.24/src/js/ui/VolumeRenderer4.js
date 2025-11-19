/**
 * Renderer pour l'affichage des volumes horaires
 * (Mis à jour : affichage simplifié — uniquement VHT annuel et VHM annuel)
 * + Ajustement : pour chaque enseignant, le volume d'automne est ajouté au volume de printemps
 *   (le forfait est compté une seule fois car inclus dans le calcul automne uniquement).
 * Modification : changement de la logique de couleur des barres de progression :
 *   - rouge  : volume > reference + tolerance
 *   - orange : volume < reference - 16
 *   - vert   : sinon
 *
 * Correction demandée : en session d'automne, la référence utilisée doit être VHM_annuel / 2
 * (appliqué avant le fallback).
 *
 * Épaisseur de la barre de progression augmentée et garantie que la "couleur" remplisse la zone grise.
 * La longueur de la barre de progression du taux de complétion (matières) a aussi été augmentée.
 *
 * @author Ibrahim Mrani - UCD
 */

import StateManager from '../controllers/StateManager.js';
import TeacherController from '../controllers/TeacherController.js';
import SubjectController from '../controllers/SubjectController.js';
import VolumeService from '../services/VolumeService.js';
import StorageService from '../services/StorageService.js';
import { safeText } from '../utils/sanitizers.js';
import SchedulingService from '../services/SchedulingService.js';
import { normalizeSessionLabel, getStorageSessionKey } from '../utils/session.js';

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
        const autumnSessionKey = getStorageSessionKey('autumn');
        const springSessionKey = getStorageSessionKey('spring');

        const autumnSessionData = (typeof StorageService !== 'undefined' && StorageService && typeof StorageService.loadSessionData === 'function')
            ? StorageService.loadSessionData(autumnSessionKey) || { seances: [], nextId: 1 }
            : { seances: [], nextId: 1 };

        const springSessionData = (typeof StorageService !== 'undefined' && StorageService && typeof StorageService.loadSessionData === 'function')
            ? StorageService.loadSessionData(springSessionKey) || { seances: [], nextId: 1 }
            : { seances: [], nextId: 1 };
            
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
     * Calcule le pourcentage d'avancement pour un volume donné en utilisant une référence passée.
     * Si reference vaut 0 ou indéterminée, retombe sur computeMaxWorkloadForCurrentSession ou tolerance.
     * @param {number} volumeHours
     * @param {number} reference
     * @returns {number} pourcentage 0-100
     */
    computeProgressPercent(volumeHours, reference) {
        let ref = Number(reference || 0);
        try {
            if ((!ref || ref === 0) && typeof SchedulingService !== 'undefined' && typeof SchedulingService.computeMaxWorkloadForCurrentSession === 'function') {
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
     * Détermine la couleur selon la règle demandée :
     * - rouge si volume > reference + tolerance
     * - orange si volume < reference - 16
     * - vert sinon
     *
     * Si reference n'est pas disponible (0), on retombe sur une couleur par défaut :
     * - orange si volume === 0
     * - vert sinon
     *
     * @param {number} volumeHours
     * @param {number} reference
     * @param {number} tolerance
     * @returns {string} couleur CSS
     */
    getProgressColorByReference(volumeHours, reference, tolerance = 16) {
        const vol = Number(volumeHours || 0);
        const ref = Number(reference || 0);
        const tol = Number(tolerance || 0);

        if (!isFinite(ref) || ref === 0) {
            // pas de référence significative
            return vol === 0 ? '#fd7e14' : '#28a745';
        }

        if (vol > (ref + tol)) return '#dc3545'; // rouge
        if (vol < (ref - 16)) return '#fd7e14'; // orange
        return '#28a745'; // vert
    }

    /**
     * Rend le tableau des volumes par enseignant (session courante)
     * Remarque : pour la session de printemps, on ajoute au total du professeur
     * la part calculée pour l'automne (le forfait étant compté une fois via la logique automne).
     * Ajout : dans la colonne "Total (hTP)" on affiche la barre de progression suivie du total chiffré.
     * En session d'automne, la référence utilisée pour la couleur est VHM_annuel / 2 (si disponible).
     * @returns {string} HTML du tableau
     */
    renderTeacherVolumes() {
        const teachers = TeacherController.getAllTeachersWithStats();
        const seances = StateManager.getSeances();
        const sessionRaw = StateManager.state.header && StateManager.state.header.session ? StateManager.state.header.session : '';
        const sessionNorm = normalizeSessionLabel(sessionRaw);

        const allVolumesCurrent = VolumeService.calculateAllVolumes(
            StateManager.state.enseignants,
            seances,
            StateManager.state.enseignantVolumesSupplementaires,
            sessionRaw,
            StateManager.state.volumesAutomne
        );

        // Calculer les volumes d'automne par enseignant pour l'ajout si nécessaire
        const autumnKey = getStorageSessionKey('autumn');
        const autumnSessionData = (typeof StorageService !== 'undefined' && StorageService && typeof StorageService.loadSessionData === 'function')
            ? StorageService.loadSessionData(autumnKey) || { seances: [] }
            : { seances: [] };

        const autumnPerTeacher = VolumeService.calculateAllVolumes(
            StateManager.state.enseignants,
            autumnSessionData.seances || [],
            StateManager.state.enseignantVolumesSupplementaires,
            autumnKey,
            {}
        );

        // Récupérer VHM annuel pour référentiel d'écart
        const VHM_annual = (this.annualMetrics && this.annualMetrics.annualVHM) ? this.annualMetrics.annualVHM : (this.computeAnnualMetrics().annualVHM || 0);

        // Determine reference for color/percentage calculation:
        // prefer VHM_annual; if in autumn session and VHM_annual present -> use half of it
        let referenceForColors = Number(VHM_annual || 0);
        if (sessionNorm === 'autumn' && referenceForColors > 0) {
            referenceForColors = Math.round(referenceForColors / 2);
        }

        try {
            // If no annual VHM determined, fallback to SchedulingService (which itself is robust)
            if (!referenceForColors || referenceForColors === 0) {
                referenceForColors = Number(SchedulingService.computeMaxWorkloadForCurrentSession() || 0);
                // Note: SchedulingService.computeMaxWorkloadForCurrentSession already uses session context,
                // but we applied the explicit half-of-annual rule above when VHM_annual exists.
            }
        } catch (e) {
            // ignore
        }

        const tolerance = Number(StateManager.state.toleranceMaxWorkload || 16);

        // Trier par volume décroissant (en tenant compte de l'ajout d'automne si on est en printemps)
        teachers.sort((a, b) => {
            const volA = (allVolumesCurrent[a.nom] || 0) + ((sessionNorm === 'spring') ? (autumnPerTeacher[a.nom] || 0) : 0);
            const volB = (allVolumesCurrent[b.nom] || 0) + ((sessionNorm === 'spring') ? (autumnPerTeacher[b.nom] || 0) : 0);
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
            if (sessionNorm === 'spring') {
                totalVolume += autumnPerTeacher[teacher.nom] || 0;
            }

            const ecartVHM = totalVolume - VHM_annual;
            const ecartClass = ecartVHM > 0 ? 'positive' : ecartVHM < 0 ? 'negative' : 'neutral';

            // compute progress percent & color based on reference
            const pct = this.computeProgressPercent(totalVolume, referenceForColors);
            const color = this.getProgressColorByReference(totalVolume, referenceForColors, tolerance);

            // progress HTML (minimal classes; add CSS in your stylesheets to match TeacherVolumePreview)
            // <-- Height doubled: now 48px -> 96px
            const progressHTML = `
                <span class="tvp-progress-wrapper" title="${totalVolume} h — ${pct}%">
                    <span class="tvp-progress-bar" style="display:inline-block; width:220px; height:96px; background:#e9ecef; border-radius:48px; overflow:hidden; vertical-align:middle; position:relative;">
                        <span class="tvp-progress-fill" style="position:absolute; left:0; top:0; bottom:0; width:${pct}%; background:${color}; transition:width .35s;"></span>
                    </span>
                    <span class="tvp-progress-text" style="margin-left:12px; font-size:1rem; vertical-align:middle; min-width:48px; display:inline-block; text-align:right;">${pct}%</span>
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
                    <td>${progressHTML} <strong style="margin-left:12px;">${safeText(String(totalVolume))}</strong></td>
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

            // enlarged completion bar: increased width so it's more visible
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
                        <div class="progress-bar" style="display:inline-block; width:220px; height:14px; background:#e9ecef; border-radius:7px; overflow:hidden; vertical-align:middle;">
                            <div class="progress-fill" style="height:100%; width: ${safeText(String(completion))}%; background:#28a745; transition:width .35s;"></div>
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
                        ${(stats.matieres || []).map(m => `<li>${safeText(m)}</li>`).join('')}
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