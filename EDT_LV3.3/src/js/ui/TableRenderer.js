/**
 * Gestionnaire de rendu du tableau EDT
 * @author Ibrahim Mrani - UCD
 */
import { LISTE_JOURS, BREAK_CRENEAU } from '../config/constants.js';
import { getSortedCreneauxKeys, getSeparatorColumnIndex } from '../utils/helpers.js';
import { safeText } from '../utils/sanitizers.js';
import StateManager from '../controllers/StateManager.js';

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

        // Mapping couleurs par type (modifiable)
        this.TYPE_COLORS = {
            cours: '#28a745', // vert
            td: '#007bff',    // bleu
            tp: '#fd7e14',    // orange
            default: '#6c757d' // gris
        };
    }

    init(tableId = 'edtTable') {
        this.tableElement = document.getElementById(tableId);
        if (!this.tableElement) {
            console.warn(`Table #${tableId} not found`);
        }
    }

    setFilter(filter) {
        this.currentFilter = filter;
    }

    setSearchFilters(filters) {
        this.searchFilters = { ...this.searchFilters, ...filters };
    }

    getFilteredSeances() {
        let seances = StateManager.getSeances();

        if (this.currentFilter === 'enseignant_selectionne') {
            const teacher = this.getSelectedTeacher();
            if (teacher) {
                seances = seances.filter(s => s.hasTeacherAssigned(teacher));
            } else {
                seances = [];
            }
        } else if (this.currentFilter !== 'global') {
            seances = seances.filter(s => s.filiere === this.currentFilter);
        }

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

    getSelectedTeacher() {
        const ens1 = document.getElementById('inputEnseignant1')?.value || '';
        const ens2 = document.getElementById('inputEnseignant2')?.value || '';
        return ens2 || ens1 || null;
    }

    hasActiveSearch() {
        const { matiere, enseignant, salle, sectionGroupe } = this.searchFilters;
        return !!(matiere || enseignant || salle || sectionGroupe);
    }

    hexToRgba(hex, alpha = 0.12) {
        if (!hex) return `rgba(108,117,125,${alpha})`;
        const h = hex.replace('#', '');
        const bigint = parseInt(h, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    render() {
        if (!this.tableElement) return;

        const seances = this.getFilteredSeances();
        const hasActiveSearch = this.hasActiveSearch();

        this.tableElement.innerHTML = this.generateTableHTML(seances, hasActiveSearch);
    }

    generateTableHTML(seances, hasActiveSearch = false) {
        const sortedCreneaux = getSortedCreneauxKeys();
        const creneauxData = StateManager.state.creneaux;

        let html = '<thead><tr><th>Jour/Heure</th>';

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

                // === CHANGEMENT APPLIQUÉ ===
                // Ne plus appliquer de fond coloré ou bordure colorée aux <td> des créneaux.
                // Seules les séances individuelles conservent leur badge coloré.
                const cellStyle = ''; // keep cell background white, no colored separation

                html += `<td data-jour="${jour}" data-creneau="${creneau}" ${cellStyle}
                    ondragover="EDTHandlers.handleDragOver(event)" 
                    ondragleave="EDTHandlers.handleDragLeave(event)" 
                    ondrop="EDTHandlers.handleDrop(event)">`;

                html += `<button class="add-seance-in-cell-btn" 
                    onclick="EDTHandlers.attribuerSeanceDirectement('${jour}', '${creneau}')" 
                    title="Attribuer la séance configurée ici">+</button>`;

                seancesCell.forEach(seance => {
                    html += this.generateSeanceHTML(seance, hasActiveSearch);
                });

                html += '</td>';

                if (creneau === BREAK_CRENEAU) {
                    html += '<td class="separator-column"></td>';
                }
            });

            html += '</tr>';
        });

        html += '</tbody>';

        return html;
    }

    generateSeanceHTML(seance, highlight = false) {
        const highlightClass = highlight ? 'highlight-search' : '';

        const departement = StateManager.state.header?.departement || '';
        const isAdministration = departement === 'Administration';

        const nonAttribueeClass = (!seance.hasTeacher() && !isAdministration) ? 'seance-non-attribuee' : '';

        const isSansSalle = !seance.hasRoom() && seance.type !== 'TP';
        const sansSalleClass = isSansSalle ? 'seance-sans-salle' : '';

        const filiereDisplay = seance.filiere
            ? `<span class="filiere-section">${safeText(seance.filiere)}</span>`
            : '';

        const groupeDisplay = (seance.groupe && seance.groupe !== 'N/A')
            ? `<span class="groupe-section">${safeText(seance.groupe)}</span><br>`
            : '';

        const typeNorm = (seance.type || '').toString().trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '');
        const typeKey = typeNorm.includes('cours') ? 'cours' : typeNorm.includes('td') ? 'td' : typeNorm.includes('tp') ? 'tp' : 'default';

        const color = this.TYPE_COLORS[typeKey] || this.TYPE_COLORS.default;
        const bg = this.hexToRgba(color, 0.10);

        let enseignantsDisplay = '';
        if (seance.enseignant) {
            enseignantsDisplay = `<span class="enseignants">${safeText(seance.enseignant)}</span><br>`;
        } else if (Array.isArray(seance.enseignantsArray) && seance.enseignantsArray.length > 0) {
            enseignantsDisplay = `<span class="enseignants">${safeText(seance.enseignantsArray.join(', '))}</span><br>`;
        }

        const salleDisplay = isSansSalle
            ? `<small class="salle-missing">Sans salle</small>`
            : `<small>${safeText(seance.salle || '')}</small>`;

        const typeBadge = `<span class="seance-type-badge" style="background:${color}; color:#fff; padding:2px 6px; border-radius:12px; font-size:.75em; margin-left:6px;">${safeText(seance.type || '')}</span>`;

        return `
        <div class="seance ${typeKey} ${highlightClass} ${nonAttribueeClass} ${sansSalleClass}" data-id="${seance.id}"
             style="background:${bg}; border-left:4px solid ${color}; padding:6px 8px; margin:6px 0; border-radius:4px;">
            <button class="delete-btn" onclick="EDTHandlers.supprimerSeance(${seance.id})">x</button>
            <div class="seance-data" draggable="true" 
                ondragstart="EDTHandlers.handleDragStart(event, ${seance.id})" 
                ondragend="EDTHandlers.handleDragEnd(event)" 
                onclick="EDTHandlers.ouvrirFormulairePourModifier(${seance.id})">
                <strong style="display:inline-block; margin-right:6px;">${safeText(seance.matiere)} (${safeText(seance.type)})</strong>${typeBadge}<br>
                ${filiereDisplay}
                ${groupeDisplay}
                ${enseignantsDisplay}
                ${salleDisplay}
            </div>
        </div>
    `;
    }

    generatePDFData(seances) {
        const sortedCreneaux = getSortedCreneauxKeys();
        const creneauxData = StateManager.state.creneaux;

        const headContent = [];
        sortedCreneaux.forEach(c => {
            headContent.push(`${c}\n${creneauxData[c].fin}`);
            if (c === BREAK_CRENEAU) {
                headContent.push('');
            }
        });
        const head = [['Jour/Heure', ...headContent]];

        const body = [];
        LISTE_JOURS.forEach(jour => {
            const rowContent = [];
            sortedCreneaux.forEach(creneau => {
                const seancesCell = seances.filter(s => s.jour === jour && s.creneau === creneau);
                rowContent.push(seancesCell);
                if (creneau === BREAK_CRENEAU) {
                    rowContent.push('');
                }
            });
            body.push([jour, ...rowContent]);
        });

        return { head, body };
    }

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

export default new TableRenderer();