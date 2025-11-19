/**
 * Affiche sous les sélecteurs "Enseignant 1" / "Enseignant 2" du formulaire Séances
 * le volume horaire annuel estimé pour l'enseignant et une barre de progression.
 *
 * Règles de couleur (selon demande) :
 *  - orange : volume < (reference - tolerance)
 *  - vert   : (reference - 16) < volume < (reference + tolerance)
 *  - rouge  : sinon
 *
 * Exposition : exporte une fonction initTeacherVolumePreviews() à appeler au démarrage
 * (depuis src/js/main.js par exemple) après que le DOM et les formulaires soient rendus.
 */

import StateManager from '../controllers/StateManager.js';
import VolumeService from '../services/VolumeService.js';
import SchedulingService from '../services/SchedulingService.js';

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

function getReferenceAndTolerance() {
    let reference = 0;
    let tolerance = 10; // fallback
    try {
        if (SchedulingService && typeof SchedulingService.computeMaxWorkloadForCurrentSession === 'function') {
            reference = Number(SchedulingService.computeMaxWorkloadForCurrentSession() || 0);
        }
    } catch (e) { console.warn('TeacherVolumePreview: computeMaxWorkload error', e); }

    try {
        if (StateManager && StateManager.state) {
            // le champ tolerance utilisé ailleurs est toleranceMaxWorkload (fallback)
            if (typeof StateManager.state.toleranceMaxWorkload !== 'undefined') {
                tolerance = Number(StateManager.state.toleranceMaxWorkload || tolerance);
            } else if (typeof StateManager.state.tolerance !== 'undefined') {
                tolerance = Number(StateManager.state.tolerance || tolerance);
            }
        }
    } catch (e) { /* ignore */ }

    // sanitize
    reference = Number(reference || 0);
    tolerance = Number(tolerance || 0);

    return { reference, tolerance };
}

async function computeAllVolumesMap() {
    try {
        if (typeof VolumeService !== 'undefined' && VolumeService && typeof VolumeService.calculateAllVolumes === 'function') {
            const enseignants = (StateManager.state && Array.isArray(StateManager.state.enseignants)) ? StateManager.state.enseignants : [];
            const allSeances = (typeof StateManager.getSeances === 'function') ? StateManager.getSeances() : [];
            const volumesMap = VolumeService.calculateAllVolumes(
                enseignants,
                allSeances,
                (StateManager.state && StateManager.state.enseignantVolumesSupplementaires) || {},
                (StateManager.state && StateManager.state.header && StateManager.state.header.session) || '',
                (StateManager.state && StateManager.state.volumesAutomne) || {}
            ) || {};
            // normalize keys
            const out = {};
            Object.keys(volumesMap).forEach(k => {
                out[normalizeName(k).toLowerCase()] = Number(volumesMap[k] || 0);
            });
            return out;
        }
    } catch (e) {
        console.warn('TeacherVolumePreview: erreur computeAllVolumesMap', e);
    }
    return {};
}

/**
 * Met à jour le preview pour un enseignant donné (nom)
 * @param {string} name
 * @param {HTMLElement} previewEl
 * @param {Object} volumesMap - map normalisée nameLower->value
 * @param {number} reference
 * @param {number} tolerance
 */
function updatePreviewForTeacher(name, previewEl, volumesMap, reference, tolerance) {
    const displayValueEl = previewEl.querySelector('.tvp-value');
    const fillEl = previewEl.querySelector('.tvp-bar-fill');
    const percentEl = previewEl.querySelector('.tvp-percent');
    const subEl = previewEl.querySelector('.tvp-sub');

    const nameNorm = normalizeName(name);
    const key = nameNorm.toLowerCase();

    const volume = Number(volumesMap[key] || 0);

    // compute percentage relative to reference (avoid division by zero)
    let percent = 0;
    if (reference > 0) {
        percent = Math.round((volume / reference) * 100);
    } else {
        // if no reference, fallback to 0..100 by assuming reference==volume (display 100%)
        percent = volume > 0 ? 100 : 0;
    }
    percent = Math.max(0, Math.min(100, percent)); // clamp

    // determine color per rules given
    // user rules interpreted as:
    //  - orange : volume < (reference - tolerance)
    //  - green  : (reference - 16) < volume < (reference + tolerance)
    //  - otherwise red
    let color = '#dc3545'; // red default
    if (!isFinite(reference) || reference === 0) {
        // if no reference, use neutral orange if volume==0 else green
        color = volume === 0 ? '#fd7e14' : '#28a745';
    } else {
        if (volume < (reference - tolerance)) {
            color = '#fd7e14'; // orange
        } else if ((volume > (reference - 16)) && (volume < (reference + tolerance))) {
            color = '#28a745'; // green
        } else {
            color = '#dc3545'; // red
        }
    }

    // update DOM
    if (displayValueEl) displayValueEl.textContent = `${volume} h`;
    if (fillEl) {
        fillEl.style.width = percent + '%';
        fillEl.style.background = color;
        // smooth transition
        fillEl.style.transition = 'width 300ms ease, background-color 300ms ease';
    }
    if (percentEl) percentEl.textContent = `${percent}%`;
    if (subEl) subEl.textContent = `Réf: ${reference} | Tol: ${tolerance}`;
}

/**
 * Attache les préviews aux selects #inputEnseignant1 et #inputEnseignant2
 * Crée les conteneurs sous les selects s'ils n'existent pas.
 */
export async function initTeacherVolumePreviews() {
    // find selects
    const sel1 = document.getElementById('inputEnseignant1');
    const sel2 = document.getElementById('inputEnseignant2');

    if (!sel1 && !sel2) return; // rien à faire

    // ensure volumes map is computed once and refreshed on demand
    let volumesMap = await computeAllVolumesMap();

    // compute reference/tolerance
    const refTol = getReferenceAndTolerance();
    let reference = refTol.reference;
    let tolerance = refTol.tolerance;

    // create preview elements if missing and insert in DOM right after select's parent .form-group
    function ensurePreviewAfter(selectEl, previewId) {
        if (!selectEl) return null;
        // place preview after the parent .form-group or after selectEl itself
        let parent = selectEl.closest('.form-group') || selectEl.parentElement;
        if (!parent) parent = selectEl;
        // check existing
        let existing = parent.querySelector('#' + previewId);
        if (existing) return existing;
        const preview = createPreviewElement(previewId);
        // append after parent
        parent.appendChild(preview);
        return preview;
    }

    const preview1 = ensurePreviewAfter(sel1, 'teacherVolumePreview1');
    const preview2 = ensurePreviewAfter(sel2, 'teacherVolumePreview2');

    // update function that recomputes volumesMap and reference/tolerance then updates preview
    async function refreshAndUpdate(selectEl, previewEl) {
        // recompute volumes map (in case data changed)
        volumesMap = await computeAllVolumesMap();
        const rt = getReferenceAndTolerance();
        reference = rt.reference;
        tolerance = rt.tolerance;

        const selectedVal = (selectEl && selectEl.value) ? selectEl.value : '';
        // if option values are objects (not typical for select), try to read selected option text
        const selectedName = selectedVal || ((selectEl && selectEl.selectedOptions && selectEl.selectedOptions[0]) ? selectEl.selectedOptions[0].textContent : '');
        updatePreviewForTeacher(selectedName, previewEl, volumesMap, reference, tolerance);
    }

    // initial fill
    if (sel1 && preview1) refreshAndUpdate(sel1, preview1);
    if (sel2 && preview2) refreshAndUpdate(sel2, preview2);

    // attach listeners: on change, update
    if (sel1 && preview1) {
        sel1.addEventListener('change', () => refreshAndUpdate(sel1, preview1));
        // also update when options list changes (in case select is populated later)
        const obs1 = new MutationObserver(() => refreshAndUpdate(sel1, preview1));
        obs1.observe(sel1, { childList: true, subtree: true });
    }
    if (sel2 && preview2) {
        sel2.addEventListener('change', () => refreshAndUpdate(sel2, preview2));
        const obs2 = new MutationObserver(() => refreshAndUpdate(sel2, preview2));
        obs2.observe(sel2, { childList: true, subtree: true });
    }

    // expose a small API to force refresh externally if needed
    return {
        refreshAll: async () => {
            volumesMap = await computeAllVolumesMap();
            const rt = getReferenceAndTolerance();
            reference = rt.reference;
            tolerance = rt.tolerance;
            if (sel1 && preview1) refreshAndUpdate(sel1, preview1);
            if (sel2 && preview2) refreshAndUpdate(sel2, preview2);
        }
    };
}

export default {
    initTeacherVolumePreviews
};