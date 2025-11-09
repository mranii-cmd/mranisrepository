/**
 * Renderer pour les listes de configuration
 * @author Ibrahim Mrani - UCD
 */

import StateManager from '../controllers/StateManager.js';
import { safeText } from '../utils/sanitizers.js';

class ConfigListRenderer {
    /**
     * Rend la liste des enseignants
     * @param {string} containerId - L'ID du conteneur
     */
    renderEnseignantsList(containerId = 'configEnseignantsListContainer') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const enseignants = StateManager.state.enseignants;

        if (enseignants.length === 0) {
            container.innerHTML = '<div class="config-list-empty">Aucun enseignant enregistré</div>';
            return;
        }

        let html = '<div class="config-list">';
        enseignants.forEach(nom => {
            const seances = StateManager.getSeances().filter(s => s.hasTeacherAssigned(nom));
            html += `
                <div class="config-list-item">
                    <div class="config-item-content">
                        <div class="config-item-title">${safeText(nom)}</div>
                        <div class="config-item-meta">${seances.length} séance(s) assignée(s)</div>
                    </div>
                    <div class="config-item-actions">
                        <button class="btn-delete-config" onclick="window.EDTApp?.deleteEnseignant('${this.escapeQuotes(nom)}')">
                            🗑️ Supprimer
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    /**
     * Rend la liste des matières
     * @param {string} containerId - L'ID du conteneur
     */
    renderMatieresList(containerId = 'configMatieresListContainer') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const matieres = Object.keys(StateManager.state.matiereGroupes);

        if (matieres.length === 0) {
            container.innerHTML = '<div class="config-list-empty">Aucune matière enregistrée</div>';
            return;
        }

        let html = '<div class="config-list">';
        matieres.forEach(nom => {
            const config = StateManager.state.matiereGroupes[nom];
            const seances = StateManager.getSeances().filter(s => s.matiere === nom);
            html += `
                <div class="config-list-item">
                    <div class="config-item-content">
                        <div class="config-item-title">${safeText(nom)}</div>
                        <div class="config-item-meta">
                            ${safeText(config.filiere)} • 
                            ${config.sections_cours} section(s) • 
                            ${seances.length} séance(s)
                        </div>
                    </div>
                    <div class="config-item-actions">
                        <button class="btn-delete-config" onclick="window.EDTApp?.deleteMatiere('${this.escapeQuotes(nom)}')">
                            🗑️ Supprimer
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    /**
     * Rend la liste des salles
     * @param {string} containerId - L'ID du conteneur
     */
    renderSallesList(containerId = 'configSallesListContainer') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const salles = Object.keys(StateManager.state.sallesInfo);

        if (salles.length === 0) {
            container.innerHTML = '<div class="config-list-empty">Aucune salle enregistrée</div>';
            return;
        }

        let html = '<div class="config-list">';
        salles.forEach(nom => {
            const type = StateManager.state.sallesInfo[nom];
            const seances = StateManager.getSeances().filter(s => s.salle === nom);
            html += `
                <div class="config-list-item">
                    <div class="config-item-content">
                        <div class="config-item-title">${safeText(nom)}</div>
                        <div class="config-item-meta">
                            Type: ${safeText(type)} • 
                            ${seances.length} séance(s)
                        </div>
                    </div>
                    <div class="config-item-actions">
                        <button class="btn-delete-config" onclick="window.EDTApp?.deleteSalle('${this.escapeQuotes(nom)}')">
                            🗑️ Supprimer
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    /**
     * Rend la liste des filières
     * @param {string} containerId - L'ID du conteneur
     */
    renderFilieresList(containerId = 'configFilieresListContainer') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const filieres = StateManager.state.filieres;

        if (filieres.length === 0) {
            container.innerHTML = '<div class="config-list-empty">Aucune filière enregistrée</div>';
            return;
        }

        let html = '<div class="config-list">';
        filieres.forEach(f => {
            const matieres = Object.keys(StateManager.state.matiereGroupes).filter(m =>
                StateManager.state.matiereGroupes[m].filiere === f.nom
            );
            html += `
                <div class="config-list-item">
                    <div class="config-item-content">
                        <div class="config-item-title">${safeText(f.nom)}</div>
                        <div class="config-item-meta">
                            Session: ${safeText(f.session)} • 
                            ${matieres.length} matière(s)
                        </div>
                    </div>
                    <div class="config-item-actions">
                        <button class="btn-delete-config" onclick="window.EDTApp?.deleteFiliere('${this.escapeQuotes(f.nom)}')">
                            🗑️ Supprimer
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    /**
     * Rend la liste des forfaits
     * @param {string} containerId - L'ID du conteneur
     */
    renderForfaitsList(containerId = 'forfaitsListContainer') {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Import ForfaitController dynamically
        import('../controllers/ForfaitController.js').then(module => {
            const ForfaitController = module.default;
            const forfaits = ForfaitController.getAllForfaits();

            if (forfaits.length === 0) {
                container.innerHTML = '<div class="config-list-empty">Aucun forfait enregistré</div>';
                return;
            }

            // Grouper par enseignant
            const byTeacher = {};
            forfaits.forEach(f => {
                if (!byTeacher[f.enseignant]) {
                    byTeacher[f.enseignant] = [];
                }
                byTeacher[f.enseignant].push(f);
            });

            let html = '<table class="forfaits-table"><thead><tr>';
            html += '<th>Enseignant</th>';
            html += '<th>Nature</th>';
            html += '<th>Volume (h)</th>';
            html += '<th>Description</th>';
            html += '<th>Actions</th>';
            html += '</tr></thead><tbody>';

            // Trier les enseignants
            const sortedTeachers = Object.keys(byTeacher).sort();

            sortedTeachers.forEach(teacher => {
                const teacherForfaits = byTeacher[teacher];
                const totalVolume = teacherForfaits.reduce((sum, f) => sum + f.volumeHoraire, 0);

                teacherForfaits.forEach((forfait, index) => {
                    const badgeClass = ForfaitController.getBadgeClass(forfait.nature);

                    html += '<tr>';

                    // Enseignant (avec rowspan pour le premier forfait)
                    if (index === 0) {
                        html += `<td rowspan="${teacherForfaits.length}"><strong>${safeText(teacher)}</strong></td>`;
                    }

                    // Nature avec badge
                    html += `<td><span class="forfait-badge ${badgeClass}">${safeText(forfait.nature)}</span></td>`;

                    // Volume
                    html += `<td>${forfait.volumeHoraire}h</td>`;

                    // Description
                    html += `<td>${safeText(forfait.description || '-')}</td>`;

                    // Actions
                    html += `<td><div class="forfait-actions">`;
                    html += `<button class="btn btn-sm btn-warning" onclick="window.EDTForfaitController?.editForfait('${forfait.id}')">✏️ Modifier</button>`;
                    html += `<button class="btn btn-sm btn-danger" onclick="window.EDTForfaitController?.deleteForfait('${forfait.id}')">🗑️</button>`;
                    html += `</div></td>`;

                    html += '</tr>';
                });

                // Ligne de total par enseignant
                html += `<tr class="forfait-summary">`;
                html += `<td colspan="2"><strong>Total ${safeText(teacher)}</strong></td>`;
                html += `<td><strong>${totalVolume}h</strong></td>`;
                html += `<td colspan="2"></td>`;
                html += `</tr>`;
            });

            html += '</tbody></table>';

            // Ajouter un résumé global
            const totalGlobal = forfaits.reduce((sum, f) => sum + f.volumeHoraire, 0);
            const volumesByNature = ForfaitController.getVolumesByNature();

            html += '<div class="forfait-summary" style="margin-top: 20px;">';
            html += '<h4>📊 Résumé Global</h4>';
            html += `<p><strong>Total des forfaits :</strong> ${totalGlobal}h</p>`;
            html += '<p><strong>Par nature :</strong></p><ul>';

            Object.entries(volumesByNature).forEach(([nature, volume]) => {
                const badgeClass = ForfaitController.getBadgeClass(nature);
                html += `<li><span class="forfait-badge ${badgeClass}">${safeText(nature)}</span> : ${volume}h</li>`;
            });

            html += '</ul></div>';

            container.innerHTML = html;
        });
    }

    /**
     * Rend toutes les listes
     */
    renderAll() {
        this.renderEnseignantsList();
        this.renderMatieresList();
        this.renderSallesList();
        this.renderFilieresList();
        this.renderForfaitsList();
    }

    /**
     * Échappe les guillemets
     * @param {string} str - La chaîne
     * @returns {string} La chaîne échappée
     */
    escapeQuotes(str) {
        return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
    }
    /**
     * Rend la liste des réglages de salles par filière
     * @param {string} containerId - L'ID du conteneur
     */
    renderSallesParFiliere(containerId = 'configSallesParFiliereContainer') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const filieres = StateManager.state.filieres.sort((a, b) => a.nom.localeCompare(b.nom));
        const salles = Object.keys(StateManager.state.sallesInfo).sort();
        const settings = StateManager.state.autoSallesParFiliere;

        if (filieres.length === 0) {
            container.innerHTML = '<div class="config-list-empty">Aucune filière configurée</div>';
            return;
        }

        // Options de salles (Amphi/Standard pour Cours/TD)
        const sallesOptions = salles.map(s =>
            `<option value="${safeText(s)}">${safeText(s)}</option>`
        ).join('');

        const defaultOption = '<option value="">-- Auto (Défaut) --</option>';

        let html = '';

        filieres.forEach(filiere => {
            const nomFiliere = filiere.nom;
            // Récupérer les réglages actuels
            // const currentSettingCours = settings[nomFiliere]?.Cours || '';
            // const currentSettingTD = settings[nomFiliere]?.TD || '';
            const currentSettingsCours = settings[nomFiliere]?.Cours || [];
            const currentSettingsTD = settings[nomFiliere]?.TD || [];

            // Générer les options avec la bonne sélection
            const sallesOptionsCours = salles.map(s =>
                `<option value="${safeText(s)}"${currentSettingsCours.includes(s) ? ' selected' : ''}>${safeText(s)}</option>`
            ).join('');

            const sallesOptionsTD = salles.map(s =>
                `<option value="${safeText(s)}"${currentSettingsTD.includes(s) ? ' selected' : ''}>${safeText(s)}</option>`
            ).join('');

            html += `
                <div class="config-list-item auto-salle-item">
                    <div class="config-item-title">${safeText(nomFiliere)}</div>
                    <div class="auto-salle-selects">
                        
                        <div class="form-group-inline">
                            <label for="auto-salle-cours-${nomFiliere}">Cours (Pool):</label>
                            <select id="auto-salle-cours-${nomFiliere}" 
                                    class="auto-salle-select" 
                                    multiple 
                                    size="5"
                                    onchange="window.EDTRoomController.updateSallesParFiliere('${this.escapeQuotes(nomFiliere)}', 'Cours', this)">
                                ${sallesOptionsCours}
                            </select>
                        </div>
                        
                        <div class="form-group-inline">
                            <label for="auto-salle-td-${nomFiliere}">TD (Pool):</label>
                            <select id="auto-salle-td-${nomFiliere}" 
                                    class="auto-salle-select"
                                    multiple 
                                    size="5"
                                    onchange="window.EDTRoomController.updateSallesParFiliere('${this.escapeQuotes(nomFiliere)}', 'TD', this)">
                                ${sallesOptionsTD}
                            </select>
                        </div>
                        
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * Rend toutes les listes
     */
    renderAll() {
        this.renderEnseignantsList();
        this.renderMatieresList();
        this.renderSallesList();
        this.renderFilieresList();
        this.renderForfaitsList();
        this.renderSallesParFiliere(); // <-- AJOUTEZ CET APPEL
    }

    /**
     * Échappe les guillemets
     * @param {string} str - La chaîne
     * @returns {string} La chaîne échappée
     */
    escapeQuotes(str) {
        // (Cette méthode existe peut-être déjà chez vous)
        if (typeof str !== 'string') return '';
        return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
    }
}

export default new ConfigListRenderer();