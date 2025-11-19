/**
 * Affiche sous les sélecteurs "Enseignant 1" / "Enseignant 2" du formulaire Séances
 * le volume horaire annuel estimé pour l'enseignant et une barre de progression.
 *
 * Référence utilisée : VHM annuel calculé par VolumeService.calculateAnnualGlobalMetrics()
 * Règles de couleur (demandées) :
 *  - orange : volume < (reference - tolerance)
 *  - vert   : (reference - 16) < volume < (reference + tolerance)
 *  - rouge  : sinon
 *
 * Export : initTeacherVolumePreviews()
 *
 * Remarques :
 * - Le module est tolérant : il tente plusieurs sources (StateManager, StorageService) pour récupérer
 *   sujets / séances par session afin de calculer la référence annuelle.
 * - Si la référence annuelle n'est pas disponible, il retombe sur SchedulingService.computeMaxWorkloadForCurrentSession()
 *   ou sur un fallback à 0.
 */

import StateManager from '../controllers/StateManager.js';
import VolumeService from '../services/VolumeService.js';
import SchedulingService from '../services/SchedulingService.js';

// StorageService est optionnel dans certains builds ; on l'utilise si présent.
let StorageService = null;
try { StorageService = require('../services/StorageService.js').default; } catch (e) { try { StorageService = (await import('../services/StorageService.js')).default; } catch (e2) { StorageService = null; } }

/* -------------------------
   Helpers / DOM builders
   ------------------------- */

function normalizeName(n) {
    if (!n && n !== 0) return '';
    return String(n).trim();
}

function createPreviewElement(id) {
    const container = document.createElement('div');
    container.className = 'teacher-volume-preview';
    container.id = id;
    container.style.marginTop = '6px';
    container.style.fontSize = '0.9em';

    container.innerHTML = `
        <div class="tvp-row" style="display:flex; align-items:center; gap:10px;">
            <div class="tvp-value" style="min-width:70px; font-weight:600;">—</div>
            <div class="tvp-bar" style="flex:1; background:#e9ecef; height:12px; border-radius:6px; overflow:hidden;">
                <div class="tvp-bar-fill" style="height:100%; width:0%; background:#fd7e14;"></div>
            </div>
            <div class="tvp-percent" style="min-width:48px; text-align:right; font-weight:600;">—</div>
        </div>
        <div class="tvp-sub" style="margin-top:4px; color:#6c757d; font-size:0.85em;">Réf: — | Tol: —</div>
    `;
    return container;
}

/* -------------------------
   Data / reference calculation
   ------------------------- */

/**
 * Try to obtain subjects for autumn/spring from StateManager or fallback to empty arrays.
 * We attempt several calls that may exist in the project.
 */
function getSubjectsForSessionNames() {
    // This function will be used to attempt retrieving autumn/spring subjects.
    // Caller should handle empty arrays gracefully.
    let autumnSubjects = [];
    let springSubjects = [];

    try {
        if (typeof StateManager.getCurrentSessionSubjects === 'function') {
            // If the repo exposes helpers, get them (may return only current session)
            const current = StateManager.getCurrentSessionSubjects();
            if (Array.isArray(current)) {
                // unknown which session, leave caller to provide session seances separately
            }
        }
    } catch (e) {
        // ignore
    }

    // Try to use generic StateManager.getSubjects or state.subjects
    try {
        const allSubjects = (typeof StateManager.getSubjects === 'function') ? StateManager.getSubjects() : (StateManager.state && StateManager.state.subjects ? StateManager.state.subjects : []);
        const filieres = StateManager.state && StateManager.state.filieres ? StateManager.state.filieres : [];

        if (Array.isArray(allSubjects) && allSubjects.length > 0) {
            // If subjects have a 'session' or 'filiere' property we could split; but safe fallback:
            // Attempt to split by filiere's session mapping (if filieres defined)
            const autumnFilieres = filieres.filter(f => String(f.session || '').toLowerCase().includes('automne') || String(f.session || '').toLowerCase().includes('autumn')).map(f => String(f.nom || '').trim());
            const springFilieres = filieres.filter(f => String(f.session || '').toLowerCase().includes('printemps') || String(f.session || '').toLowerCase().includes('spring')).map(f => String(f.nom || '').trim());

            if (autumnFilieres.length > 0) {
                autumnSubjects = allSubjects.filter(s => !s.filiere || autumnFilieres.includes(String(s.filiere || '').trim()));
            }
            if (springFilieres.length > 0) {
                springSubjects = allSubjects.filter(s => String(s.filiere || '').trim() && springFilieres.includes(String(s.filiere || '').trim()));
            }

            // If still empty, try to use subject.session property
            if (autumnSubjects.length === 0) {
                autumnSubjects = allSubjects.filter(s => String(s.session || '').toLowerCase().includes('automne') || String(s.session || '').toLowerCase().includes('autumn'));
            }
            if (springSubjects.length === 0) {
                springSubjects = allSubjects.filter(s => String(s.session || '').toLowerCase().includes('printemps') || String(s.session || '').toLowerCase().includes('spring'));
            }
        }
    } catch (e) {
        // ignore
    }

    return { autumnSubjects, springSubjects };
}

/**
 * Try to obtain session seances arrays (autumn / spring).
 * Priority:
 *  - StorageService.loadSessionData("Session d'automne") if available
 *  - StateManager.getSeances() filtered by s.session
 */
function getSessionSeancesFallback() {
    let autumnSeances = [];
    let springSeances = [];
    try {
        if (StorageService && typeof StorageService.loadSessionData === 'function') {
            const a = StorageService.loadSessionData("Session d'automne") || {};
            const p = StorageService.loadSessionData("Session de printemps") || {};
            autumnSeances = a.seances || [];
            springSeances = p.seances || [];
        }
    } catch (e) {
        // ignore
    }

    // If not found, fallback to StateManager.getSeances and filter by session field
    try {
        const allSeances = (typeof StateManager.getSeances === 'function') ? StateManager.getSeances() : (StateManager.state && StateManager.state.seances ? StateManager.state.seances : []);
        if ((!autumnSeances || autumnSeances.length === 0) && Array.isArray(allSeances) && allSeances.length > 0) {
            autumnSeances = allSeances.filter(s => String(s.session || '').toLowerCase().includes('automne') || String(s.session || '').toLowerCase().includes('autumn'));
        }
        if ((!springSeances || springSeances.length === 0) && Array.isArray(allSeances) && allSeances.length > 0) {
            springSeances = allSeances.filter(s => String(s.session || '').toLowerCase().includes('printemps') || String(s.session || '').toLowerCase().includes('spring'));
        }
    } catch (e) {
        // ignore
    }

    return { autumnSeances, springSeances };
}

/**
 * Compute annual reference (VHM annuel) and tolerance value.
 * Returns { reference, tolerance }.
 * Tries to use VolumeService.calculateAnnualGlobalMetrics; falls back to SchedulingService.
 */
async function computeAnnualReferenceAndTolerance() {
    let reference = 0;
    let tolerance = 10;

    try {
        const enseignants = Array.isArray(StateManager.state && StateManager.state.enseignants) ? StateManager.state.enseignants : (typeof StateManager.getEnseignants === 'function' ? StateManager.getEnseignants() : []);

        const { autumnSubjects, springSubjects } = getSubjectsForSessionNames();
        const { autumnSeances, springSeances } = getSessionSeancesFallback();

        // Pull forfaits if present and separate by session if possible
        const allForfaits = Array.isArray(StateManager.state && StateManager.state.forfaits) ? StateManager.state.forfaits : [];
        const forfaitsAutumn = allForfaits.filter(f => !f.session || String(f.session).toLowerCase().includes('automne') || String(f.session).toLowerCase().includes('autumn'));
        const forfaitsSpring = allForfaits.filter(f => String(f.session).toLowerCase().includes('printemps') || String(f.session).toLowerCase().includes('spring'));

        // Use VolumeService.calculateAnnualGlobalMetrics if available
        if (VolumeService && typeof VolumeService.calculateAnnualGlobalMetrics === 'function') {
            const metrics = VolumeService.calculateAnnualGlobalMetrics(
                enseignants,
                autumnSubjects || [],
                autumnSeances || [],
                springSubjects || [],
                springSeances || [],
                // volumesSupplementaires ignored for VHT/VHM by design in service - pass empty
                {},
                forfaitsAutumn,
                forfaitsSpring
            );
            if (metrics && typeof metrics.annualVHM === 'number') {
                reference = Number(metrics.annualVHM || 0);
            }
        }
    } catch (e) {
        console.warn('TeacherVolumePreview.computeAnnualReferenceAndTolerance: VolumeService annual compute failed', e);
    }

    // fallback: scheduling service
    if ((!reference || reference === 0) && typeof SchedulingService !== 'undefined' && typeof SchedulingService.computeMaxWorkloadForCurrentSession === 'function') {
        try {
            const v = Number(SchedulingService.computeMaxWorkloadForCurrentSession() || 0);
            if (v && v > 0) reference = v;
        } catch (e) { /* ignore */ }
    }

    // tolerance from StateManager.state if available
    try {
        if (StateManager && StateManager.state) {
            if (typeof StateManager.state.toleranceMaxWorkload !== 'undefined') {
                tolerance = Number(StateManager.state.toleranceMaxWorkload || tolerance);
            } else if (typeof StateManager.state.tolerance !== 'undefined') {
                tolerance = Number(StateManager.state.tolerance || tolerance);
            }
        }
    } catch (e) {
        // ignore
    }

    // final sanitization
    reference = Number(reference || 0);
    tolerance = Number(tolerance || 0);

    return { reference, tolerance };
}

/**
 * Compute map nameLower -> annualVolume using VolumeService.calculateAllVolumes
 * Accepts an optional sessionOverride (string). If provided, it will be passed as the session param
 * to VolumeService.calculateAllVolumes so you can compute volumes for a specific session (e.g. "Session d'automne").
 */
async function computeAllVolumesMap(sessionOverride = null) {
    const out = {};
    try {
        if (typeof VolumeService !== 'undefined' && VolumeService && typeof VolumeService.calculateAllVolumes === 'function') {
            const enseignants = (StateManager.state && Array.isArray(StateManager.state.enseignants)) ? StateManager.state.enseignants : [];
            const allSeances = (typeof StateManager.getSeances === 'function') ? StateManager.getSeances() : (StateManager.state && StateManager.state.seances ? StateManager.state.seances : []);
            const volumesSupplementaires = (StateManager.state && StateManager.state.enseignantVolumesSupplementaires) ? StateManager.state.enseignantVolumesSupplementaires : {};
            const currentSession = sessionOverride || ((StateManager.state && StateManager.state.header && StateManager.state.header.session) ? StateManager.state.header.session : '');
            const volumesAutomne = (StateManager.state && StateManager.state.volumesAutomne) ? StateManager.state.volumesAutomne : {};

            const map = VolumeService.calculateAllVolumes(enseignants, allSeances, volumesSupplementaires, currentSession, volumesAutomne) || {};
            Object.keys(map).forEach(k => {
                out[normalizeName(k).toLowerCase()] = Number(map[k] || 0);
            });
        }
    } catch (e) {
        console.warn('TeacherVolumePreview.computeAllVolumesMap error', e);
    }
    return out;
}

/* -------------------------
   Update preview UI
   ------------------------- */

function updatePreviewForTeacher(name, previewEl, volumesMapCurrent, volumesMapAutumn, reference, tolerance, currentSessionName) {
    const displayValueEl = previewEl.querySelector('.tvp-value');
    const fillEl = previewEl.querySelector('.tvp-bar-fill');
    const percentEl = previewEl.querySelector('.tvp-percent');
    const subEl = previewEl.querySelector('.tvp-sub');

    const nameNorm = normalizeName(name);
    const key = nameNorm.toLowerCase();

    // volume for current session
    const volumeCurrent = Number(volumesMapCurrent[key] || 0);
    // volume from autumn session (if computed)
    const volumeAutumn = Number((volumesMapAutumn && volumesMapAutumn[key]) || 0);

    // If current session is spring, display sum (current spring + autumn)
    const isSpring = typeof currentSessionName === 'string' && (currentSessionName.toLowerCase().includes('printemps') || currentSessionName.toLowerCase().includes('spring'));
    const volumeToDisplay = isSpring ? (volumeCurrent + volumeAutumn) : volumeCurrent;

    // percent relative to reference (avoid div by zero)
    let percent = 0;
    if (reference > 0) {
        percent = Math.round((volumeToDisplay / reference) * 100);
    } else {
        percent = volumeToDisplay > 0 ? 100 : 0;
    }
    percent = Math.max(0, Math.min(100, percent));

    // colour rules:
    // orange : volume < (reference - tolerance)
    // green  : (reference - 16) < volume < (reference + tolerance)
    // red    : otherwise
    let color = '#dc3545';
    if (!isFinite(reference) || reference === 0) {
        color = volumeToDisplay === 0 ? '#fd7e14' : '#28a745';
    } else {
        if (volumeToDisplay < (reference - tolerance)) {
            color = '#fd7e14'; // orange
        } else if ((volumeToDisplay > (reference - 16)) && (volumeToDisplay < (reference + tolerance))) {
            color = '#28a745'; // green
        } else {
            color = '#dc3545'; // red
        }
    }

    if (displayValueEl) displayValueEl.textContent = `${volumeToDisplay} h`;
    if (fillEl) {
        fillEl.style.width = percent + '%';
        fillEl.style.background = color;
        fillEl.style.transition = 'width 300ms ease, background-color 300ms ease';
    }
    if (percentEl) percentEl.textContent = `${percent}%`;
    if (subEl) {
        if (isSpring && volumeAutumn > 0) {
            subEl.textContent = `Réf: ${reference} | Tol: ${tolerance} · (incl. ${volumeAutumn}h automne)`;
        } else {
            subEl.textContent = `Réf: ${reference} | Tol: ${tolerance}`;
        }
    }
}

/* -------------------------
   Public init function
   ------------------------- */

/**
 * Attache les préviews aux selects #inputEnseignant1 et #inputEnseignant2
 * Crée les conteneurs sous les selects s'ils n'existent pas.
 *
 * Retourne un objet { refreshAll } pour forcer une mise à jour si souhaité.
 */
export async function initTeacherVolumePreviews() {
    const sel1 = document.getElementById('inputEnseignant1');
    const sel2 = document.getElementById('inputEnseignant2');

    if (!sel1 && !sel2) return null;

    // compute initial data
    const currentSessionName = (StateManager.state && StateManager.state.header && StateManager.state.header.session) ? StateManager.state.header.session : '';
    // volumes for current session (will be spring or autumn depending on header)
    let volumesMapCurrent = await computeAllVolumesMap(null);
    // explicitly compute autumn volumes to be able to sum in spring
    let volumesMapAutumn = await computeAllVolumesMap("Session d'automne");

    const refTol = await computeAnnualReferenceAndTolerance();
    let reference = refTol.reference;
    let tolerance = refTol.tolerance;

    // ensure preview containers exist (append to parent .form-group if found)
    function ensurePreviewAfter(selectEl, previewId) {
        if (!selectEl) return null;
        let parent = selectEl.closest('.form-group') || selectEl.parentElement || selectEl;
        let existing = parent.querySelector('#' + previewId);
        if (existing) return existing;
        const preview = createPreviewElement(previewId);
        parent.appendChild(preview);
        return preview;
    }

    const preview1 = ensurePreviewAfter(sel1, 'teacherVolumePreview1');
    const preview2 = ensurePreviewAfter(sel2, 'teacherVolumePreview2');

    async function refreshAndUpdate(selectEl, previewEl) {
        volumesMapCurrent = await computeAllVolumesMap(null);
        volumesMapAutumn = await computeAllVolumesMap("Session d'automne");
        const rt = await computeAnnualReferenceAndTolerance();
        reference = rt.reference;
        tolerance = rt.tolerance;

        const selectedVal = (selectEl && selectEl.value) ? selectEl.value : '';
        const selectedName = selectedVal || ((selectEl && selectEl.selectedOptions && selectEl.selectedOptions[0]) ? selectEl.selectedOptions[0].textContent : '');
        updatePreviewForTeacher(selectedName, previewEl, volumesMapCurrent, volumesMapAutumn, reference, tolerance, currentSessionName);
    }

    // initial update
    if (sel1 && preview1) refreshAndUpdate(sel1, preview1);
    if (sel2 && preview2) refreshAndUpdate(sel2, preview2);

    // attach listeners
    if (sel1 && preview1) {
        sel1.addEventListener('change', () => refreshAndUpdate(sel1, preview1));
        const obs1 = new MutationObserver(() => refreshAndUpdate(sel1, preview1));
        obs1.observe(sel1, { childList: true, subtree: true });
    }
    if (sel2 && preview2) {
        sel2.addEventListener('change', () => refreshAndUpdate(sel2, preview2));
        const obs2 = new MutationObserver(() => refreshAndUpdate(sel2, preview2));
        obs2.observe(sel2, { childList: true, subtree: true });
    }

    return {
        refreshAll: async () => {
            volumesMapCurrent = await computeAllVolumesMap();
            volumesMapAutumn = await computeAllVolumesMap("Session d'automne");
            const rt = await computeAnnualReferenceAndTolerance();
            reference = rt.reference;
            tolerance = rt.tolerance;
            if (sel1 && preview1) await refreshAndUpdate(sel1, preview1);
            if (sel2 && preview2) await refreshAndUpdate(sel2, preview2);
        }
    };
}

export default {
    initTeacherVolumePreviews
};