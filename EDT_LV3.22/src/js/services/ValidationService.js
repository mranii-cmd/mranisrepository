/**
 * Service de validation des formulaires et données
 * @author Ibrahim Mrani - UCD
 */

import { LISTE_TYPES_SEANCE } from '../config/constants.js';

class ValidationService {
    /**
     * Valide les données d'une séance
     * @param {Object} data - Les données de la séance
     * @param {boolean} allowNoRoom - Permet les séances sans salle
     * @returns {Object} { isValid: boolean, errors: Array<string>, missingFields: Array<string> }
     */
    validateSeanceData(data, allowNoRoom = false) {
        const errors = [];
        const missingFields = [];

        // Champs requis de base
        const requiredFields = {
            'Jour': data.jour,
            'Créneau': data.creneau,
            'Filière': data.filiere,
            'Matière': data.matiere,
            'Type': data.type,
            'Section': data.section
        };

        // Salle requise uniquement si type != TP ET non sans salle
        if (data.type !== 'TP' && !allowNoRoom) {
            requiredFields['Salle'] = data.salle;
        }

        // Groupe requis pour TD et TP
        if (data.type === 'TD' || data.type === 'TP') {
            requiredFields['Groupe (TD/TP)'] = data.groupeTDTP;
        }

        // Vérifier les champs manquants
        for (const [fieldName, value] of Object.entries(requiredFields)) {
            if (!value || value === '') {
                missingFields.push(fieldName);
            }
        }

        // Validation du type
        if (data.type && !LISTE_TYPES_SEANCE.includes(data.type)) {
            errors.push(`Type de séance invalide: ${data.type}`);
        }

        return {
            isValid: missingFields.length === 0 && errors.length === 0,
            errors,
            missingFields
        };
    }

    /**
     * Valide la compatibilité d'une salle avec un type de séance
     * @param {string} typeSeance - Le type de séance
     * @param {string} salle - Le nom de la salle
     * @param {Object} sallesInfo - Les informations sur les salles
     * @returns {boolean} True si compatible
     */
    validateSalleCompatibility(typeSeance, salle, sallesInfo) {
        if (!salle || !sallesInfo[salle]) return false;

        const typeSalle = sallesInfo[salle];

        if (typeSeance === 'Cours') {
            return typeSalle === 'Amphi' || typeSalle === 'Standard';
        } else if (typeSeance === 'TP') {
            return salle.toUpperCase().startsWith('STP');
        } else if (typeSeance === 'TD') {
            return typeSalle === 'Standard';
        }

        return true;
    }

    /**
     * Valide un email
     * @param {string} email - L'email à valider
     * @returns {boolean} True si valide
     */
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Valide un format d'heure (HH:MM)
     * @param {string} time - L'heure à valider
     * @returns {boolean} True si valide
     */
    validateTime(time) {
        const re = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return re.test(time);
    }

    /**
     * Valide un format de créneau (HHhMM)
     * @param {string} creneau - Le créneau à valider
     * @returns {boolean} True si valide
     */
    validateCreneauFormat(creneau) {
        const re = /^([0-1]?[0-9]|2[0-3])h[0-5][0-9]$/;
        return re.test(creneau);
    }

    /**
     * Valide une année universitaire (YYYY/YYYY)
     * @param {string} year - L'année à valider
     * @returns {boolean} True si valide
     */
    validateAcademicYear(year) {
        const re = /^\d{4}\/\d{4}$/;
        if (!re.test(year)) return false;

        const [y1, y2] = year.split('/').map(Number);
        return y2 === y1 + 1;
    }

    /**
     * Valide un nombre positif
     * @param {*} value - La valeur à valider
     * @returns {boolean} True si valide
     */
    validatePositiveNumber(value) {
        const num = Number(value);
        return !isNaN(num) && num >= 0;
    }

    /**
     * Valide un nombre entier positif
     * @param {*} value - La valeur à valider
     * @returns {boolean} True si valide
     */
    validatePositiveInteger(value) {
        const num = Number(value);
        return Number.isInteger(num) && num >= 0;
    }

    /**
     * Met en évidence les champs avec erreurs dans un formulaire
     * @param {Array<string>} fieldIds - Les IDs des champs en erreur
     */
    highlightFormErrors(fieldIds) {
        // Effacer les erreurs précédentes
        this.clearFormErrors();

        // Ajouter la classe d'erreur aux champs spécifiés
        fieldIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.add('input-error');
            }
        });
    }

    /**
     * Efface les erreurs visuelles du formulaire
     */
    clearFormErrors() {
        document.querySelectorAll('.input-error').forEach(el => {
            el.classList.remove('input-error');
        });
    }
    // ValidationService.js
// Ajoutez ces fonctions/exports dans le fichier de service de validation.

validateProjectSchema(data) {
    const errors = [];

    if (typeof data !== 'object' || data === null) {
        errors.push('Le projet doit être un objet JSON.');
        return { ok: false, errors };
    }

    // Clés attendues de haut niveau (adapter selon la structure réelle)
    const requiredTopLevel = ['header', 'enseignants', 'matiereGroupes', 'sallesInfo', 'filieres', 'edt'];
    requiredTopLevel.forEach(k => {
        if (!(k in data)) errors.push(`Clé manquante: ${k}`);
    });

    // Vérifications simples supplémentaires
    if ('enseignants' in data && !Array.isArray(data.enseignants)) {
        errors.push('La propriété "enseignants" doit être un tableau.');
    }
    if ('filieres' in data && !Array.isArray(data.filieres)) {
        errors.push('La propriété "filieres" doit être un tableau.');
    }
    if ('matiereGroupes' in data && (typeof data.matiereGroupes !== 'object' || data.matiereGroupes === null)) {
        errors.push('La propriété "matiereGroupes" doit être un objet.');
    }
    if ('sallesInfo' in data && (typeof data.sallesInfo !== 'object' || data.sallesInfo === null)) {
        errors.push('La propriété "sallesInfo" doit être un objet.');
    }

    // Exemple de check fin : header doit contenir annee et session
    if ('header' in data && (typeof data.header !== 'object' || data.header === null)) {
        errors.push('header doit être un objet.');
    } else if ('header' in data) {
        if (typeof data.header.annee === 'undefined') errors.push('header.annee manquant.');
        if (typeof data.header.session === 'undefined') errors.push('header.session manquant.');
    }

    return { ok: errors.length === 0, errors };
}

/**
 * Vérifie que la première ligne d'une feuille (SheetJS worksheet) contient les en-têtes attendus.
 * sheet -> SheetJS worksheet (XLSX.utils.sheet_to_json / sheet)
 * expectedHeaders -> array de strings attendues (ex: ['nom','filiere','volume'])
 */
checkSheetHeaders(sheet, expectedHeaders = []) {
    // Utilise SheetJS utils si disponible ; on accepte un tableau 2D en alternative
    let firstRow = [];
    try {
        // si sheet est une worksheet SheetJS
        if (sheet && typeof sheet['!ref'] !== 'undefined' && typeof XLSX !== 'undefined') {
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, raw: false });
            firstRow = Array.isArray(rows[0]) ? rows[0] : [];
        } else if (Array.isArray(sheet) && Array.isArray(sheet[0])) {
            firstRow = sheet[0];
        } else {
            // format inconnu ; retourner non ok
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

// Export d'une instance singleton
export default new ValidationService();