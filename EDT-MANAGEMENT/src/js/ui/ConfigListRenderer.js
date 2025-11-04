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
     * Rend toutes les listes
     */
    renderAll() {
        this.renderEnseignantsList();
        this.renderMatieresList();
        this.renderSallesList();
        this.renderFilieresList();
    }

    /**
     * Échappe les guillemets
     * @param {string} str - La chaîne
     * @returns {string} La chaîne échappée
     */
    escapeQuotes(str) {
        return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
    }
}

export default new ConfigListRenderer();