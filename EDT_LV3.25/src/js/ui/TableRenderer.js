/**
 * Gestionnaire de rendu du tableau EDT
 * @author Ibrahim Mrani - UCD
 */

import { LISTE_JOURS, SEANCE_COLORS, BREAK_CRENEAU } from '../config/constants.js';
import { getSortedCreneauxKeys, getSeparatorColumnIndex } from '../utils/helpers.js';
import { safeText } from '../utils/sanitizers.js';
import StateManager from '../controllers/StateManager.js';
// import { escapeHTML } from '../utils/sanitizers.js';

class TableRenderer {
    constructor() {
        this.tableElement = null;
        this.currentFilter = 'global';
        this.searchFilters = {
            matiere: '',
            enseignant: '',
            salle: '',
            sectionGroupe: ''
        };
    }

    /**
     * Initialise le renderer
     * @param {string} tableId - L'ID du tableau
     */
    init(tableId = 'edtTable') {
        this.tableElement = document.getElementById(tableId);
        if (!this.tableElement) {
            console.warn(`Table #${tableId} not found`);
        }
    }

    /**
     * Définit le filtre de vue
     * @param {string} filter - Le filtre (global, enseignant_selectionne, ou nom de filière)
     */
    setFilter(filter) {
        this.currentFilter = filter;
    }

    /**
     * Définit les filtres de recherche
     * @param {Object} filters - Les filtres
     */
    setSearchFilters(filters) {
        this.searchFilters = { ...this.searchFilters, ...filters };
    }

    /**
     * Obtient les séances filtrées selon les critères actuels
     * @returns {Array<Session>} Les séances filtrées
     */
    getFilteredSeances() {
        let seances = StateManager.getSeances();

        // Filtre de vue (global, filière, enseignant)
        if (this.currentFilter === 'enseignant_selectionne') {
            const teacher = this.getSelectedTeacher();
            if (teacher) {
                seances = seances.filter(s => s.hasTeacherAssigned(teacher));
            } else {
                seances = [];
            }
        } else if (this.currentFilter !== 'global') {
            // Filtre par filière
            seances = seances.filter(s => s.filiere === this.currentFilter);
        }

        // Filtres de recherche
        const { matiere, enseignant, salle, sectionGroupe } = this.searchFilters;

        if (matiere || enseignant || salle || sectionGroupe) {
            seances = seances.filter(s => {
                const matchesMatiere = !matiere || (s.matiere || '').toLowerCase().includes(matiere.toLowerCase());
                const matchesEnseignant = !enseignant || (s.enseignant || '').toLowerCase().includes(enseignant.toLowerCase());
                const matchesSalle = !salle || (s.salle || '').toLowerCase().includes(salle.toLowerCase());
                const matchesSectionGroupe = !sectionGroupe || (s.groupe || '').toLowerCase().includes(sectionGroupe.toLowerCase());

                return matchesMatiere && matchesEnseignant && matchesSalle && matchesSectionGroupe;
            });
        }

        return seances;
    }

    /**
     * Obtient l'enseignant sélectionné dans le formulaire
     * @returns {string|null} Le nom de l'enseignant
     */
    getSelectedTeacher() {
        const ens1 = document.getElementById('inputEnseignant1')?.value || '';
        const ens2 = document.getElementById('inputEnseignant2')?.value || '';
        return ens2 || ens1 || null;
    }

    /**
     * Vérifie s'il y a des filtres de recherche actifs
     * @returns {boolean} True si des filtres sont actifs
     */
    hasActiveSearch() {
        const { matiere, enseignant, salle, sectionGroupe } = this.searchFilters;
        return !!(matiere || enseignant || salle || sectionGroupe);
    }

    /**
     * Rend le tableau EDT complet
     */
    render() {
        if (!this.tableElement) return;

        const seances = this.getFilteredSeances();
        const hasActiveSearch = this.hasActiveSearch();

        this.tableElement.innerHTML = this.generateTableHTML(seances, hasActiveSearch);
    }

    /**
     * Génère le HTML du tableau
     * @param {Array<Session>} seances - Les séances à afficher
     * @param {boolean} hasActiveSearch - Y a-t-il une recherche active
     * @returns {string} Le HTML du tableau
     */
    generateTableHTML(seances, hasActiveSearch = false) {
        const sortedCreneaux = getSortedCreneauxKeys();
        const creneauxData = StateManager.state.creneaux;

        // En-tête
        let html = '<thead><tr><th>Jour/Heure</th>';

        sortedCreneaux.forEach(c => {
            html += `<th>${c} - ${creneauxData[c].fin}</th>`;
            if (c === BREAK_CRENEAU) {
                html += '<th class="separator-column"></th>';
            }
        });

        html += '</tr></thead><tbody>';

        // Corps du tableau
        LISTE_JOURS.forEach(jour => {
            html += `<tr><td class="jour-header">${jour}</td>`;

            sortedCreneaux.forEach(creneau => {
                const seancesCell = seances.filter(s => s.jour === jour && s.creneau === creneau);

                html += `<td data-jour="${jour}" data-creneau="${creneau}" 
                    ondragover="EDTHandlers.handleDragOver(event)" 
                    ondragleave="EDTHandlers.handleDragLeave(event)" 
                    ondrop="EDTHandlers.handleDrop(event)">`;

                // Bouton d'ajout rapide
                html += `<button class="add-seance-in-cell-btn" 
                    onclick="EDTHandlers.attribuerSeanceDirectement('${jour}', '${creneau}')" 
                    title="Attribuer la séance configurée ici">+</button>`;

                // Séances dans la cellule
                seancesCell.forEach(seance => {
                    html += this.generateSeanceHTML(seance, hasActiveSearch);
                });

                html += '</td>';

                // Colonne séparatrice
                if (creneau === BREAK_CRENEAU) {
                    html += '<td class="separator-column"></td>';
                }
            });

            html += '</tr>';
        });

        html += '</tbody>';

        return html;
    }

    /**
  * Génère le HTML d'une séance
  * @param {Session} seance - La séance
  * @param {boolean} highlight - Mettre en surbrillance
  * @returns {string} Le HTML de la séance
  */
    generateSeanceHTML(seance, highlight = false) {
        const highlightClass = highlight ? 'highlight-search' : '';

        // Récupérer le département sélectionné
        const departement = StateManager.state.header.departement || '';
        const isAdministration = departement === 'Administration';

        // Pour Administration, ne pas appliquer le style "non-attribuée"
        const nonAttribueeClass = (!seance.hasTeacher() && !isAdministration) ? 'seance-non-attribuee' : '';

        const isSansSalle = !seance.hasRoom() && seance.type !== 'TP';
        const sansSalleClass = isSansSalle ? 'seance-sans-salle' : '';

        const filiereDisplay = seance.filiere
            ? `<span class="filiere-section">${safeText(seance.filiere)}</span>`
            : '';

        const groupeDisplay = (seance.groupe && seance.groupe !== 'N/A')
            ? `<span class="groupe-section">${safeText(seance.groupe)}</span><br>`
            : '';

        // Normaliser le type pour en faire une classe CSS sûre (ex: "Cours" -> "cours", "TP Special" -> "tp-special")
        const typeClass = (seance.type || '').toString().trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '');

        // Affichage de l'enseignant avec gestion Administration
        let enseignantsDisplay = '';
        if (seance.enseignant) {
            enseignantsDisplay = `<span class="enseignants">${safeText(seance.enseignant)}</span><br>`;
        }

        const salleDisplay = isSansSalle
            ? `<small class="salle-missing">Sans salle</small>`
            : `<small>${safeText(seance.salle || '')}</small>`;

        return `
        <div class="seance ${typeClass} ${highlightClass} ${nonAttribueeClass} ${sansSalleClass}" data-id="${seance.id}">
            <button class="delete-btn" onclick="EDTHandlers.supprimerSeance(${seance.id})">x</button>
            <div class="seance-data" draggable="true" 
                ondragstart="EDTHandlers.handleDragStart(event, ${seance.id})" 
                ondragend="EDTHandlers.handleDragEnd(event)" 
                onclick="EDTHandlers.ouvrirFormulairePourModifier(${seance.id})">
                <strong>${safeText(seance.matiere)} (${safeText(seance.type)})</strong><br>
                ${filiereDisplay}
                ${groupeDisplay}
                ${enseignantsDisplay}
                ${salleDisplay}
            </div>
        </div>
    `;
    }

    /**
     * Génère le HTML pour l'export PDF (avec couleurs)
     * @param {Array<Session>} seances - Les séances
     * @returns {Object} Structure de données pour jsPDF autoTable
     */
    generatePDFData(seances) {
        const sortedCreneaux = getSortedCreneauxKeys();
        const creneauxData = StateManager.state.creneaux;

        // En-tête
        const headContent = [];
        sortedCreneaux.forEach(c => {
            headContent.push(`${c}\n${creneauxData[c].fin}`);
            if (c === BREAK_CRENEAU) {
                headContent.push('');
            }
        });
        const head = [['Jour/Heure', ...headContent]];

        // Corps
        const body = [];
        LISTE_JOURS.forEach(jour => {
            const rowContent = [];
            sortedCreneaux.forEach(creneau => {
                const seancesCell = seances.filter(s => s.jour === jour && s.creneau === creneau);
                rowContent.push(seancesCell); // On passe les objets pour le rendu custom

                if (creneau === BREAK_CRENEAU) {
                    rowContent.push('');
                }
            });
            body.push([jour, ...rowContent]);
        });

        return { head, body };
    }

    /**
     * Génère le HTML du tableau pour impression/affichage simple
     * @param {Array<Session>} seances - Les séances
     * @returns {string} HTML du tableau
     */
    generateSimpleTableHTML(seances) {
        const sortedCreneaux = getSortedCreneauxKeys();
        const creneauxData = StateManager.state.creneaux;

        let html = '<table class="edt-print-table"><thead><tr><th>Jour/Heure</th>';

        sortedCreneaux.forEach(c => {
            html += `<th>${c} - ${creneauxData[c].fin}</th>`;
            if (c === BREAK_CRENEAU) {
                html += '<th class="separator-column"></th>';
            }
        });

        html += '</tr></thead><tbody>';

        LISTE_JOURS.forEach(jour => {
            html += `<tr><td class="jour-header">${jour}</td>`;

            sortedCreneaux.forEach(creneau => {
                const seancesCell = seances.filter(s => s.jour === jour && s.creneau === creneau);

                html += '<td>';

                seancesCell.forEach(seance => {
                    html += `<div class="seance-simple ${seance.type}">`;
                    html += `<strong>${safeText(seance.matiere)} (${safeText(seance.type)})</strong><br>`;
                    html += `${safeText(seance.filiere)} - ${safeText(seance.groupe)}<br>`;
                    html += `${safeText(seance.enseignant)}<br>`;
                    html += `<small>Salle: ${safeText(seance.salle)}</small>`;
                    html += '</div>';
                });

                html += '</td>';

                if (creneau === BREAK_CRENEAU) {
                    html += '<td class="separator-column"></td>';
                }
            });

            html += '</tr>';
        });

        html += '</tbody></table>';

        return html;
    }
}

// Export d'une instance singleton
export default new TableRenderer();