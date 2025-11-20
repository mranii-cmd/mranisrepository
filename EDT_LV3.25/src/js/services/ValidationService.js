/**
 * Service de validation des formulaires et données
 * @author Ibrahim Mrani - UCD
 *
 * Robustification supplémentaire : si header manquant, on tente de reconstruire,
 * et en dernier recours on injecte un header par défaut (année académique courante, session 'Automne')
 * afin d'éviter le rejet systématique des imports historiques. On retourne toujours
 * un objet `normalized` utilisable par l'importeur.
 */

import { LISTE_TYPES_SEANCE } from '../config/constants.js';

class ValidationService {
    /* ---------- utilitaires internes ---------- */

    _computeCurrentAcademicYear() {
        // Si mois >= août (8), on considère l'année académique courante "YYYY/YYYY+1"
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // 1-12
        if (month >= 8) {
            return `${year}/${year + 1}`;
        } else {
            return `${year - 1}/${year}`;
        }
    }

    /* ---------- validations de base (inchangées) ---------- */

    validateSeanceData(data, allowNoRoom = false) {
        const errors = [];
        const missingFields = [];

        const requiredFields = {
            'Jour': data.jour,
            'Créneau': data.creneau,
            'Filière': data.filiere,
            'Matière': data.matiere,
            'Type': data.type,
            'Section': data.section
        };

        if (data.type !== 'TP' && !allowNoRoom) {
            requiredFields['Salle'] = data.salle;
        }

        if (data.type === 'TD' || data.type === 'TP') {
            requiredFields['Groupe (TD/TP)'] = data.groupeTDTP;
        }

        for (const [fieldName, value] of Object.entries(requiredFields)) {
            if (!value && value !== 0) {
                missingFields.push(fieldName);
            }
        }

        if (data.type && !LISTE_TYPES_SEANCE.includes(data.type)) {
            errors.push(`Type de séance invalide: ${data.type}`);
        }

        return {
            isValid: missingFields.length === 0 && errors.length === 0,
            errors,
            missingFields
        };
    }

    validateSalleCompatibility(typeSeance, salle, sallesInfo) {
        if (!salle || !sallesInfo || !sallesInfo[salle]) return false;

        const typeSalle = sallesInfo[salle];

        if (typeSeance === 'Cours') {
            return typeSalle === 'Amphi' || typeSalle === 'Standard';
        } else if (typeSeance === 'TP') {
            return salle.toUpperCase().startsWith('STP') || typeSalle === 'STP';
        } else if (typeSeance === 'TD') {
            return typeSalle === 'Standard';
        }

        return true;
    }

    /* ---------- validateProjectSchema amélioré ---------- */

    validateProjectSchema(data) {
        const errors = [];
        const warnings = [];

        if (typeof data !== 'object' || data === null) {
            errors.push('Le projet doit être un objet JSON.');
            return { ok: false, errors };
        }

        const requiredMap = {
            header: ['header', 'meta', 'projectHeader'],
            enseignants: ['enseignants', 'teachers'],
            matiereGroupes: ['matiereGroupes', 'matiere_groupes', 'subjects', 'matiere_groups'],
            sallesInfo: ['sallesInfo', 'salles', 'rooms', 'salles_info'],
            filieres: ['filieres', 'filieresList', 'filieres_list'],
            edt: ['edt', 'seances', 'schedule', 'planning', 'sessions']
        };

        // shallow copy to preserve original
        const normalized = Object.assign({}, data);

        // find/normalize canonical keys
        const missingCanonicals = [];
        for (const [canonical, alts] of Object.entries(requiredMap)) {
            let foundKey = null;
            for (const k of alts) {
                if (k in data) {
                    foundKey = k;
                    break;
                }
            }
            if (!foundKey) {
                missingCanonicals.push(canonical);
            } else {
                if (!(canonical in data)) {
                    normalized[canonical] = data[foundKey];
                }
            }
        }

        // heuristiques pour retrouver edt (séances) dans structures historiques
        const looksLikeSeancesArray = (arr) => {
            if (!Array.isArray(arr) || arr.length === 0) return false;
            const expected = ['jour','creneau','matiere','type','enseignant','salle','groupe'];
            let hits = 0;
            for (let i = 0; i < Math.min(arr.length, 5); i++) {
                const el = arr[i];
                if (el && typeof el === 'object') {
                    const keys = Object.keys(el).map(k => String(k).toLowerCase());
                    expected.forEach(k => { if (keys.includes(k)) hits++; });
                }
            }
            return hits >= 2;
        };

        const deepFindSeances = (obj, visited = new WeakSet()) => {
            if (!obj || typeof obj !== 'object') return null;
            if (visited.has(obj)) return null;
            visited.add(obj);
            if (Array.isArray(obj)) {
                if (looksLikeSeancesArray(obj)) return obj;
                for (const el of obj) {
                    const r = deepFindSeances(el, visited);
                    if (r) return r;
                }
            } else {
                for (const k of Object.keys(obj)) {
                    try {
                        const v = obj[k];
                        if (Array.isArray(v) && looksLikeSeancesArray(v)) return v;
                        if (v && typeof v === 'object') {
                            const r = deepFindSeances(v, visited);
                            if (r) return r;
                        }
                    } catch (e) { /* ignore */ }
                }
            }
            return null;
        };

        // attempt: reconstruct header if missing
        const tryBuildHeader = () => {
            if (normalized.header && typeof normalized.header === 'object') return;
            // common top-level hints
            const candidateYear = normalized.annee || normalized.annee_universitaire || normalized.year || normalized.academicYear;
            const candidateSession = normalized.session || normalized.season || normalized.sessionName;
            if (candidateYear || candidateSession) {
                normalized.header = normalized.header || {};
                if (candidateYear && typeof normalized.header.annee === 'undefined') normalized.header.annee = candidateYear;
                if (candidateSession && typeof normalized.header.session === 'undefined') normalized.header.session = candidateSession;
            } else if (normalized.meta && typeof normalized.meta === 'object') {
                normalized.header = normalized.header || {};
                if (typeof normalized.header.annee === 'undefined' && (normalized.meta.annee || normalized.meta.year)) {
                    normalized.header.annee = normalized.meta.annee || normalized.meta.year;
                }
                if (typeof normalized.header.session === 'undefined' && (normalized.meta.session || normalized.meta.season)) {
                    normalized.header.session = normalized.meta.session || normalized.meta.season;
                }
            }
        };

        const tryFindEdt = () => {
            if (normalized.edt && Array.isArray(normalized.edt) && normalized.edt.length > 0) return;
            const found = deepFindSeances(normalized);
            if (found) normalized.edt = found;
            else {
                const topCandidates = ['data','payload','project','body'];
                for (const c of topCandidates) {
                    if (c in normalized && typeof normalized[c] === 'object') {
                        const f = deepFindSeances(normalized[c]);
                        if (f) { normalized.edt = f; break; }
                    }
                }
            }
        };

        // If canonical keys missing, try reconstruction
        if (missingCanonicals.length > 0) {
            tryBuildHeader();
            tryFindEdt();

            // recompute missing
            const stillMissing = [];
            for (const canonical of Object.keys(requiredMap)) {
                if (!(canonical in normalized)) stillMissing.push(canonical);
            }

            // Special handling: if only header and/or edt missing, don't reject outright:
            // - create header defaults if absent
            // - set edt to empty array if absent (and warn)
            const criticalMissing = stillMissing.filter(k => k !== 'header' && k !== 'edt');
            if (criticalMissing.length > 0) {
                criticalMissing.forEach(k => errors.push(`Clé manquante: ${k}`));
                return { ok: false, errors };
            }

            // Handle header missing: create reasonable defaults rather than failing
            if (!('header' in normalized)) {
                normalized.header = {
                    annee: this._computeCurrentAcademicYear(),
                    session: 'Automne'
                };
                warnings.push('header absent dans le fichier importé : un header par défaut a été créé (annee/session).');
            } else {
                // ensure fields in header
                if (typeof normalized.header.annee === 'undefined' || normalized.header.annee === null) {
                    normalized.header.annee = this._computeCurrentAcademicYear();
                    warnings.push('header.annee absent : valeur par défaut ajoutée.');
                }
                if (typeof normalized.header.session === 'undefined' || normalized.header.session === null || String(normalized.header.session).trim() === '') {
                    normalized.header.session = 'Automne';
                    warnings.push('header.session absent : valeur par défaut "Automne" ajoutée.');
                }
            }

            // Handle edt missing: set to empty array (no sessions)
            if (!('edt' in normalized) || !Array.isArray(normalized.edt)) {
                normalized.edt = [];
                warnings.push('edt (séances) absent : initialisé à [].');
            }
        }

        // Basic type checks
        if (!Array.isArray(normalized.enseignants)) {
            errors.push('La propriété "enseignants" doit être un tableau.');
        }
        if (!Array.isArray(normalized.filieres)) {
            errors.push('La propriété "filieres" doit être un tableau.');
        }
        if (typeof normalized.matiereGroupes !== 'object' || normalized.matiereGroupes === null) {
            errors.push('La propriété "matiereGroupes" doit être un objet.');
        }
        if (typeof normalized.sallesInfo !== 'object' || normalized.sallesInfo === null) {
            errors.push('La propriété "sallesInfo" doit être un objet.');
        }
        if (typeof normalized.header !== 'object' || normalized.header === null) {
            errors.push('header doit être un objet.');
        } else {
            if (typeof normalized.header.annee === 'undefined') errors.push('header.annee manquant.');
            if (typeof normalized.header.session === 'undefined') errors.push('header.session manquant.');
        }
        if (!Array.isArray(normalized.edt)) {
            errors.push('La propriété "edt" (séances) doit être un tableau.');
        }

        const combinedErrors = errors;
        // If only warnings exist -> return ok true but include warnings in returned array
        const combinedMessages = combinedErrors.concat(warnings);

        return { ok: combinedErrors.length === 0, errors: combinedMessages, normalized: (combinedErrors.length === 0 ? normalized : undefined) };
    }

    /* ---------- feuilles (SheetJS) ---------- */

    checkSheetHeaders(sheet, expectedHeaders = []) {
        let firstRow = [];
        try {
            if (sheet && typeof sheet['!ref'] !== 'undefined' && typeof XLSX !== 'undefined') {
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, raw: false });
                firstRow = Array.isArray(rows[0]) ? rows[0] : [];
            } else if (Array.isArray(sheet) && Array.isArray(sheet[0])) {
                firstRow = sheet[0];
            } else {
                return { ok: false, missing: expectedHeaders, found: [] };
            }
        } catch (e) {
            return { ok: false, error: 'Erreur lors de la lecture de la feuille.' };
        }

        const normalizedFound = firstRow.map(h => (h || '').toString().trim().toLowerCase());
        const missing = expectedHeaders.filter(h => !normalizedFound.includes(h.toString().trim().toLowerCase()));
        return { ok: missing.length === 0, missing, found: firstRow };
    }
}

export default new ValidationService();