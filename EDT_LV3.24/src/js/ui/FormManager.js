/**
 * Gestionnaire de formulaires
 * @author Ibrahim Mrani - UCD
 */

import StateManager from '../controllers/StateManager.js';
import ValidationService from '../services/ValidationService.js';
import { LISTE_JOURS, LISTE_TYPES_SEANCE } from '../config/constants.js';
import { getSortedCreneauxKeys } from '../utils/helpers.js';
import { escapeHTML } from '../utils/sanitizers.js';

class FormManager {
    constructor() {
        this.forms = {
            seance: null,
            matiere: null,
            enseignant: null,
            salle: null,
            filiere: null
        };

        this.currentMode = 'create'; // 'create' ou 'edit'
        this.editingSessionId = null;
    }

    /**
     * Initialise tous les formulaires
     */
    init() {
        this.forms.seance = document.getElementById('formAjouterSeance');
        this.forms.matiere = document.getElementById('formAjouterMatiere');
        this.forms.enseignant = document.getElementById('formAjouterEnseignant');
        this.forms.salle = document.getElementById('formAjouterSalle');
        this.forms.filiere = document.getElementById('formAjouterFiliere');

        this.initializeSeanceForm();
        this.initializeMatiereForm();
        this.initializeEnseignantForm();
        this.initializeSalleForm();
        this.initializeFiliereForm();
    }

    /**
     * Initialise le formulaire de séance
     */
    initializeSeanceForm() {
        if (!this.forms.seance) return;

        // Peupler les listes déroulantes statiques
        this.populateJourSelect();
        this.populateCreneauSelect();
        this.populateTypeSeanceSelect();

        // Event listener pour le changement de matière
        const selectMatiere = document.getElementById('selectMatiere');
        if (selectMatiere) {
            selectMatiere.addEventListener('change', () => {
                this.handleMatiereChange();
            });
        }

        // Event listener pour le changement de filière
        const selectFiliere = document.getElementById('selectFiliere');
        if (selectFiliere) {
            selectFiliere.addEventListener('change', () => {
                this.handleFiliereChange();
            });
        }

        // Event listener pour le changement de type
        const selectType = document.getElementById('selectType');
        if (selectType) {
            selectType.addEventListener('change', () => {
                this.handleTypeChange();
            });
        }

        // Event listener pour section
        const selectSection = document.getElementById('selectSection');
        if (selectSection) {
            selectSection.addEventListener('change', () => {
                this.handleSectionChange();
            });
        }
    }

    /**
     * Peuple la liste déroulante des jours
     */
    populateJourSelect() {
        const select = document.getElementById('selectJour');
        if (!select) return;

        select.innerHTML = '<option value="">-- Sélectionner --</option>';
        LISTE_JOURS.forEach(jour => {
            select.innerHTML += `<option value="${jour}">${jour}</option>`;
        });
    }

    /**
     * Peuple la liste déroulante des créneaux
     */
    populateCreneauSelect() {
        const select = document.getElementById('selectCreneau');
        if (!select) return;

        const sortedCreneaux = getSortedCreneauxKeys();
        const creneauxData = StateManager.state.creneaux;

        select.innerHTML = '<option value="">-- Sélectionner --</option>';
        sortedCreneaux.forEach(creneau => {
            const fin = creneauxData[creneau]?.fin || '';
            select.innerHTML += `<option value="${creneau}">${creneau} - ${fin}</option>`;
        });
    }

    /**
     * Peuple la liste déroulante des types de séance
     */
    populateTypeSeanceSelect() {
        const select = document.getElementById('selectType');
        if (!select) return;

        select.innerHTML = '<option value="">-- Sélectionner --</option>';
        LISTE_TYPES_SEANCE.forEach(type => {
            select.innerHTML += `<option value="${type}">${type}</option>`;
        });
    }

    /**
 * Gère le changement de matière
 */
    handleMatiereChange() {
        const selectMatiere = document.getElementById('selectMatiere');
        const matiere = selectMatiere?.value;

        if (!matiere) {
            this.resetSectionAndGroupSelects();
            return;
        }

        const matiereInfo = StateManager.state.matiereGroupes[matiere];
        if (!matiereInfo) return;

        // Pré-remplir la filière si définie
        const selectFiliere = document.getElementById('selectFiliere');
        if (selectFiliere && matiereInfo.filiere) {
            selectFiliere.value = matiereInfo.filiere;
            this.handleFiliereChange();
        }

        // Afficher les infos de la matière
        this.displayMatiereInfo(matiereInfo);

        // NOUVEAU : Recalculer l'affichage de l'enseignant 2 si le type est déjà sélectionné
        const selectType = document.getElementById('selectType');
        if (selectType?.value) {
            this.handleTypeChange();
        }
    }

    /**
   * Affiche les informations de la matière
   * @param {Object} matiereInfo - Les informations de la matière
   */
    displayMatiereInfo(matiereInfo) {
        const infoDiv = document.getElementById('matiereInfoDisplay');
        if (!infoDiv) return;

        const nbEnsTP = matiereInfo.nbEnseignantsTP || 1;
        const ensTPText = nbEnsTP > 1 ? `${nbEnsTP} enseignants` : `${nbEnsTP} enseignant`;

        const html = `
        <div class="matiere-info-box">
            <strong>Configuration de la matière :</strong><br>
            Sections: ${matiereInfo.sections_cours || 0} | 
            Groupes TD: ${matiereInfo.td_groups || 0} | 
            Groupes TP: ${matiereInfo.tp_groups || 0}<br>
            Volume hTP - Cours: ${matiereInfo.volumeHTP?.Cours || 0}h | 
            TD: ${matiereInfo.volumeHTP?.TD || 0}h | 
            TP: ${matiereInfo.volumeHTP?.TP || 0}h<br>
            <strong>TP: ${ensTPText} par séance</strong>
        </div>
    `;

        infoDiv.innerHTML = html;
    }

    /**
     * Gère le changement de filière
     */
    handleFiliereChange() {
        const selectFiliere = document.getElementById('selectFiliere');
        const selectMatiere = document.getElementById('selectMatiere');

        const filiere = selectFiliere?.value;
        const matiere = selectMatiere?.value;

        if (!matiere) return;

        const matiereInfo = StateManager.state.matiereGroupes[matiere];
        if (!matiereInfo) return;

        // Générer les sections
        this.populateSectionSelect(matiereInfo.sections_cours || 0);
    }

    /**
     * Peuple la liste des sections
     * @param {number} nbSections - Nombre de sections
     */
    populateSectionSelect(nbSections) {
        const select = document.getElementById('selectSection');
        if (!select) return;

        select.innerHTML = '<option value="">-- Sélectionner --</option>';

        for (let i = 0; i < nbSections; i++) {
            const sectionName = `Section ${String.fromCharCode(65 + i)}`;
            select.innerHTML += `<option value="${sectionName}">${sectionName}</option>`;
        }
    }

    /**
        * Gère le changement de type de séance
    */
    handleTypeChange() {
        const selectType = document.getElementById('selectType');
        const selectMatiere = document.getElementById('selectMatiere');
        const type = selectType?.value;

        const groupeTDTPContainer = document.getElementById('groupeTDTPContainer');
        const enseignant2Container = document.getElementById('enseignant2Container');

        if (!groupeTDTPContainer) return;

        // Afficher/masquer le champ groupe TD/TP
        if (type === 'TD' || type === 'TP') {
            groupeTDTPContainer.style.display = 'block';
            this.handleSectionChange(); // Régénérer les groupes
        } else {
            groupeTDTPContainer.style.display = 'none';
            const selectGroupe = document.getElementById('selectGroupeTDTP');
            if (selectGroupe) selectGroupe.value = '';
        }

        // Gérer l'affichage de l'enseignant 2
        if (enseignant2Container) {
            // Afficher pour les Cours OU pour les TP avec plusieurs enseignants
            let showEnseignant2 = false;

            if (type === 'Cours') {
                showEnseignant2 = true;
            } else if (type === 'TP') {
                // Vérifier le nombre d'enseignants TP pour la matière
                const matiere = selectMatiere?.value;
                if (matiere) {
                    const matiereInfo = StateManager.state.matiereGroupes[matiere];
                    if (matiereInfo && matiereInfo.nbEnseignantsTP >= 2) {
                        showEnseignant2 = true;
                    }
                }
            }

            enseignant2Container.style.display = showEnseignant2 ? 'block' : 'none';

            // Réinitialiser le champ si on le masque
            if (!showEnseignant2) {
                const inputEns2 = document.getElementById('inputEnseignant2');
                if (inputEns2) inputEns2.value = '';
            }
        }

        // Filtrer les salles compatibles
        this.filterCompatibleRooms(type);
    }
    /**
     * Gère le changement de section
     */
    handleSectionChange() {
        const selectType = document.getElementById('selectType');
        const selectMatiere = document.getElementById('selectMatiere');

        const type = selectType?.value;
        const matiere = selectMatiere?.value;

        if (!type || !matiere) return;
        if (type !== 'TD' && type !== 'TP') return;

        const matiereInfo = StateManager.state.matiereGroupes[matiere];
        if (!matiereInfo) return;

        const nbGroupes = type === 'TD' ? matiereInfo.td_groups : matiereInfo.tp_groups;
        this.populateGroupeTDTPSelect(nbGroupes);
    }

    /**
     * Peuple la liste des groupes TD/TP
     * @param {number} nbGroupes - Nombre de groupes
     */
    populateGroupeTDTPSelect(nbGroupes) {
        const select = document.getElementById('selectGroupeTDTP');
        if (!select) return;

        select.innerHTML = '<option value="">-- Sélectionner --</option>';

        for (let i = 1; i <= nbGroupes; i++) {
            select.innerHTML += `<option value="G${i}">G${i}</option>`;
        }
    }

    /**
     * Filtre les salles compatibles avec le type de séance
     * @param {string} type - Le type de séance
     */
    filterCompatibleRooms(type) {
        const selectSalle = document.getElementById('selectSalle');
        if (!selectSalle) return;

        const sallesInfo = StateManager.state.sallesInfo;
        const currentValue = selectSalle.value;

        selectSalle.innerHTML = '<option value="">-- Sélectionner --</option>';
        selectSalle.innerHTML += '<option value="">Sans salle</option>';

        Object.keys(sallesInfo).sort().forEach(salle => {
            const compatible = ValidationService.validateSalleCompatibility(type, salle, sallesInfo);

            if (compatible) {
                const typeSalle = sallesInfo[salle];
                selectSalle.innerHTML += `<option value="${salle}">${salle} (${typeSalle})</option>`;
            }
        });

        // Restaurer la valeur si elle est toujours compatible
        if (currentValue && ValidationService.validateSalleCompatibility(type, currentValue, sallesInfo)) {
            selectSalle.value = currentValue;
        }
    }

    /**
     * Réinitialise les selects de section et groupe
     */
    resetSectionAndGroupSelects() {
        const selectSection = document.getElementById('selectSection');
        const selectGroupe = document.getElementById('selectGroupeTDTP');

        if (selectSection) selectSection.innerHTML = '<option value="">-- Sélectionner --</option>';
        if (selectGroupe) selectGroupe.innerHTML = '<option value="">-- Sélectionner --</option>';
    }

    /**
     * Récupère les données du formulaire de séance
     * @returns {Object} Les données du formulaire
     */
    getSeanceFormData() {
        return {
            jour: document.getElementById('selectJour')?.value || '',
            creneau: document.getElementById('selectCreneau')?.value || '',
            filiere: document.getElementById('selectFiliere')?.value || '',
            matiere: document.getElementById('selectMatiere')?.value || '',
            type: document.getElementById('selectType')?.value || '',
            section: document.getElementById('selectSection')?.value || '',
            groupeTDTP: document.getElementById('selectGroupeTDTP')?.value || '',
            enseignant1: document.getElementById('inputEnseignant1')?.value || '',
            enseignant2: document.getElementById('inputEnseignant2')?.value || '',
            salle: document.getElementById('selectSalle')?.value || ''
        };
    }

    /**
     * Remplit le formulaire avec les données d'une séance (pour édition)
     * @param {Session} seance - La séance à éditer
     */
    fillSeanceForm(seance) {
        this.currentMode = 'edit';
        this.editingSessionId = seance.id;

        // Remplir les champs
        const setSelectValue = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.value = value || '';
        };

        setSelectValue('selectJour', seance.jour);
        setSelectValue('selectCreneau', seance.creneau);
        setSelectValue('selectFiliere', seance.filiere);
        setSelectValue('selectMatiere', seance.matiere);

        // Déclencher le changement de matière pour peupler les sections
        this.handleMatiereChange();

        setSelectValue('selectType', seance.type);
        this.handleTypeChange();

        setSelectValue('selectSection', seance.section);
        this.handleSectionChange();

        // Extraire le groupe TD/TP du groupe complet
        if (seance.type === 'TD' || seance.type === 'TP') {
            const groupeParts = seance.groupe.split(' - ');
            const groupeTDTP = groupeParts.length > 1 ? groupeParts[1] : '';
            setSelectValue('selectGroupeTDTP', groupeTDTP);
        }

        // Enseignants
        const enseignants = seance.enseignantsArray || [];
        setSelectValue('inputEnseignant1', enseignants[0] || '');
        setSelectValue('inputEnseignant2', enseignants[1] || '');

        // Salle
        setSelectValue('selectSalle', seance.salle);

        // Changer le texte du bouton
        const submitBtn = document.getElementById('btnAjouterSeance');
        if (submitBtn) {
            submitBtn.textContent = '✏️ Modifier la Séance';
        }

        // Scroll vers le formulaire
        this.forms.seance?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /**
     * Réinitialise le formulaire de séance
     */
    resetSeanceForm() {
        if (this.forms.seance) {
            this.forms.seance.reset();
        }

        this.currentMode = 'create';
        this.editingSessionId = null;

        // Réinitialiser le texte du bouton
        const submitBtn = document.getElementById('btnAjouterSeance');
        if (submitBtn) {
            submitBtn.textContent = '➕ Ajouter la Séance';
        }

        // Masquer le conteneur groupe TD/TP
        const groupeTDTPContainer = document.getElementById('groupeTDTPContainer');
        if (groupeTDTPContainer) {
            groupeTDTPContainer.style.display = 'none';
        }

        // Masquer le conteneur enseignant 2
        const enseignant2Container = document.getElementById('enseignant2Container');
        if (enseignant2Container) {
            enseignant2Container.style.display = 'none';
        }

        // Effacer les erreurs
        ValidationService.clearFormErrors();

        // Effacer l'affichage des infos de matière
        const infoDiv = document.getElementById('matiereInfoDisplay');
        if (infoDiv) {
            infoDiv.innerHTML = '';
        }
    }

    /**
     * Initialise le formulaire de matière
     */
    initializeMatiereForm() {
        if (!this.forms.matiere) return;

        // Event listener pour le changement de filière
        const selectFiliereMatiere = document.getElementById('selectFiliereMatiere');
        if (selectFiliereMatiere) {
            selectFiliereMatiere.addEventListener('change', () => {
                // Optionnel: actions lors du changement
            });
        }

        // Event listener pour le changement de département (s'il existe)
        const selectDepartementMatiere = document.getElementById('selectDepartementMatiere');
        if (selectDepartementMatiere) {
            selectDepartementMatiere.addEventListener('change', () => {
                // actuellement pas d'action spécifique, mais permet d'écouter les changements si besoin
            });
        }

        // Event listeners pour les volumes hTP
        ['inputVolumeCoursHTP', 'inputVolumeTDHTP', 'inputVolumeTPHTP'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => {
                    this.updateMatiereVHTPreview();
                });
            }
        });

        // Event listeners pour les sections et groupes
        ['inputSectionsCours', 'inputTDGroups', 'inputTPGroups'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => {
                    this.updateMatiereVHTPreview();
                });
            }
        });
    }

    /**
     * Met à jour la prévisualisation du VHT de la matière
     */
    updateMatiereVHTPreview() {
        const sections = parseInt(document.getElementById('inputSectionsCours')?.value || 0);
        const tdGroups = parseInt(document.getElementById('inputTDGroups')?.value || 0);
        const tpGroups = parseInt(document.getElementById('inputTPGroups')?.value || 0);
        const nbEnsTP = parseInt(document.getElementById('inputNbEnseignantsTP')?.value || 1);

        const volCours = parseInt(document.getElementById('inputVolumeCoursHTP')?.value || 48);
        const volTD = parseInt(document.getElementById('inputVolumeTDHTP')?.value || 32);
        const volTP = parseInt(document.getElementById('inputVolumeTPHTP')?.value || 36);

        const vhtCours = sections * volCours;
        const vhtTD = sections * tdGroups * volTD;
        const vhtTP = sections * tpGroups * volTP * nbEnsTP;
        const vhtTotal = vhtCours + vhtTD + vhtTP;

        const previewDiv = document.getElementById('vhtPreview');
        if (previewDiv) {
            previewDiv.innerHTML = `
                <div class="vht-preview-box">
                    <strong>VHT Prévisionnel :</strong><br>
                    Cours: ${vhtCours}h | TD: ${vhtTD}h | TP: ${vhtTP}h<br>
                    <strong>Total: ${vhtTotal}h</strong>
                </div>
            `;
        }
    }

    /**
     * Récupère les données du formulaire de matière
     * @returns {Object} Les données du formulaire
     */
    getMatiereFormData() {
        return {
            nom: document.getElementById('inputNomMatiere')?.value || '',
            filiere: document.getElementById('selectFiliereMatiere')?.value || '',
            departement: document.getElementById('selectDepartementMatiere')?.value || '',
            sections_cours: parseInt(document.getElementById('inputSectionsCours')?.value || 0),
            td_groups: parseInt(document.getElementById('inputTDGroups')?.value || 0),
            tp_groups: parseInt(document.getElementById('inputTPGroups')?.value || 0),
            volumeHTP: {
                Cours: parseInt(document.getElementById('inputVolumeCoursHTP')?.value || 48),
                TD: parseInt(document.getElementById('inputVolumeTDHTP')?.value || 32),
                TP: parseInt(document.getElementById('inputVolumeTPHTP')?.value || 36)
            },
            nbEnseignantsTP: parseInt(document.getElementById('inputNbEnseignantsTP')?.value || 1)
        };
    }

    /**
     * Réinitialise le formulaire de matière
     */
    resetMatiereForm() {
        if (this.forms.matiere) {
            this.forms.matiere.reset();
        }

        // Réinitialiser les valeurs par défaut
        const defaults = {
            inputVolumeCoursHTP: 48,
            inputVolumeTDHTP: 32,
            inputVolumeTPHTP: 36,
            inputNbEnseignantsTP: 1
        };

        Object.entries(defaults).forEach(([id, value]) => {
            const input = document.getElementById(id);
            if (input) input.value = value;
        });

        // Réinitialiser le département (si présent)
        const selectDepartementMatiere = document.getElementById('selectDepartementMatiere');
        if (selectDepartementMatiere) selectDepartementMatiere.value = '';


        // Effacer la prévisualisation
        const previewDiv = document.getElementById('vhtPreview');
        if (previewDiv) {
            previewDiv.innerHTML = '';
        }
    }

    /**
     * Initialise le formulaire d'enseignant
     */
    initializeEnseignantForm() {
        if (!this.forms.enseignant) return;
        // Pas de logique spéciale pour l'instant
    }

    /**
     * Récupère les données du formulaire d'enseignant
     * @returns {Object} Les données du formulaire
     */
    getEnseignantFormData() {
        return {
            nom: document.getElementById('inputNomEnseignant')?.value || ''
        };
    }

    /**
     * Réinitialise le formulaire d'enseignant
     */
    resetEnseignantForm() {
        if (this.forms.enseignant) {
            this.forms.enseignant.reset();
        }
    }

    /**
     * Initialise le formulaire de salle
     */
    initializeSalleForm() {
        if (!this.forms.salle) return;
        // Pas de logique spéciale pour l'instant
    }

    /**
     * Récupère les données du formulaire de salle
     * @returns {Object} Les données du formulaire
     */
    getSalleFormData() {
        return {
            nom: document.getElementById('inputNomSalle')?.value || '',
            type: document.getElementById('selectTypeSalle')?.value || 'Standard'
        };
    }

    /**
     * Réinitialise le formulaire de salle
     */
    resetSalleForm() {
        if (this.forms.salle) {
            this.forms.salle.reset();
        }
    }

    /**
     * Initialise le formulaire de filière
     */
    initializeFiliereForm() {
        if (!this.forms.filiere) return;
        // Pas de logique spéciale pour l'instant
    }

    /**
     * Récupère les données du formulaire de filière
     * @returns {Object} Les données du formulaire
     */
    getFiliereFormData() {
        return {
            nom: document.getElementById('inputNomFiliere')?.value || '',
            session: document.getElementById('selectSessionFiliere')?.value || 'Automne'
        };
    }

    /**
     * Réinitialise le formulaire de filière
     */
    resetFiliereForm() {
        if (this.forms.filiere) {
            this.forms.filiere.reset();
        }
    }
}

// Export d'une instance singleton
export default new FormManager();