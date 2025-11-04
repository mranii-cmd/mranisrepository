/**
 * Point d'entrée principal de l'application EDT
 * @author Ibrahim Mrani - UCD
 * @version 2.9-modular-final
 * @date 2025-11-04
 */

// === IMPORTS ===
import { initCreneaux } from './utils/helpers.js';
import StateManager from './controllers/StateManager.js';
import SessionController from './controllers/SessionController.js';
import TeacherController from './controllers/TeacherController.js';
import SubjectController from './controllers/SubjectController.js';
import RoomController from './controllers/RoomController.js';
import StorageService from './services/StorageService.js';
import LogService from './services/LogService.js';
import ConflictService from './services/ConflictService.js';
import VolumeService from './services/VolumeService.js';
import DialogManager from './ui/DialogManager.js';
import SpinnerManager from './ui/SpinnerManager.js';
import NotificationManager from './ui/NotificationManager.js';
import TableRenderer from './ui/TableRenderer.js';
import VolumeRenderer from './ui/VolumeRenderer.js';
import StatsRenderer from './ui/StatsRenderer.js';
import ListRenderer from './ui/ListRenderer.js';
import WishesRenderer from './ui/WishesRenderer.js';
import FormManager from './ui/FormManager.js';
import EventHandlers from './handlers/EventHandlers.js';
import FormHandlers from './handlers/FormHandlers.js';
import SchedulingHandlers from './handlers/SchedulingHandlers.js';
import ExportHandlers from './handlers/ExportHandlers.js';
import ImportHandlers from './handlers/ImportHandlers.js';

/**
 * Classe principale de l'application
 */
class EDTApplication {
    constructor() {
        this.initialized = false;
        this.version = '2.9-modular-final';
    }

    /**
     * Initialise l'application
     */
    async init() {
        console.log(`🚀 Initialisation de l'application EDT v${this.version}...`);

        try {
            // 1. Initialiser les gestionnaires UI
            this.initializeUIManagers();

            // 2. Charger l'état depuis le localStorage
            StateManager.loadState();

            // 3. Initialiser les créneaux dans les helpers
            initCreneaux(StateManager.state.creneaux);

            // 4. Initialiser l'interface
            this.initializeUI();

            // 5. Initialiser tous les renderers
            this.initializeRenderers();

            // 6. S'abonner aux événements d'état
            this.subscribeToStateEvents();

            // 7. Afficher l'état initial
            this.renderAll();

            this.initialized = true;

            LogService.success(`✅ Application EDT v${this.version} initialisée avec succès`);
            NotificationManager.success('Application chargée', 3000);

            console.log('✅ Application EDT prête');

        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
            LogService.error(`Erreur critique: ${error.message}`);
            NotificationManager.error('Erreur lors du chargement de l\'application');
        }
    }

    /**
     * Initialise les gestionnaires UI
     */
    initializeUIManagers() {
        LogService.init('messages');
        DialogManager.init('dialogModal');
        SpinnerManager.init('loading-overlay');
        NotificationManager.init('edt-notification-area');
    }

    /**
     * Initialise l'interface utilisateur
     */
    initializeUI() {
        // Charger les en-têtes
        this.loadHeaderValues();

        // Initialiser les formulaires
        this.initializeForms();

        // Initialiser les onglets
        this.initializeTabs();

        // Initialiser les event listeners
        this.attachEventListeners();

        // Initialiser les listeners des services avancés
        this.attachAdvancedServiceListeners();

        // Initialiser les listeners des souhaits
        this.attachWishesListeners();
    }

    /**
     * Initialise tous les renderers
     */
    initializeRenderers() {
        // Table EDT
        TableRenderer.init('edtTable');
        this.initializeTableRenderer();

        // Volumes
        VolumeRenderer.init('volumesContainer');

        // Statistiques
        StatsRenderer.init('statsContainer');

        // Listes
        ListRenderer.init({
            teachers: 'teachersListContainer',
            subjects: 'subjectsListContainer',
            rooms: 'roomsListContainer'
        });

        // Souhaits
        WishesRenderer.init('wishesListContainer');
    }

    /**
     * Charge les valeurs d'en-tête
     */
    loadHeaderValues() {
        const { annee, session, departement } = StateManager.state.header;

        const inputAnnee = document.getElementById('inputAnneeUniversitaire');
        const selectSession = document.getElementById('selectSession');
        const selectDept = document.getElementById('selectDepartement');

        if (inputAnnee) inputAnnee.value = annee;
        if (selectSession) selectSession.value = session;
        if (selectDept) selectDept.value = departement;
    }

    /**
     * Initialise les formulaires
     */
    initializeForms() {
        console.log('Initialisation des formulaires...');
        
        // Initialiser le FormManager
        FormManager.init();
        
        // Peupler les listes déroulantes
        this.populateFormSelects();

        // Attacher les event listeners des formulaires
        this.attachFormListeners();
    }

    /**
     * Attache les event listeners des formulaires
     */
    attachFormListeners() {
        // Formulaire de séance
        const formSeance = document.getElementById('formAjouterSeance');
        if (formSeance) {
            formSeance.addEventListener('submit', (e) => {
                FormHandlers.handleSeanceFormSubmit(e);
            });
        }

        // Bouton annuler édition
        const btnCancelEdit = document.getElementById('btnCancelSeanceEdit');
        if (btnCancelEdit) {
            btnCancelEdit.addEventListener('click', () => {
                FormHandlers.handleCancelSeanceEdit();
            });
        }

        // Bouton reset formulaire séance
        const btnResetSeanceForm = document.getElementById('btnResetSeanceForm');
        if (btnResetSeanceForm) {
            btnResetSeanceForm.addEventListener('click', () => {
                FormManager.resetSeanceForm();
                NotificationManager.info('Formulaire réinitialisé', 2000);
            });
        }

        // Formulaire de matière
        const formMatiere = document.getElementById('formAjouterMatiere');
        if (formMatiere) {
            formMatiere.addEventListener('submit', (e) => {
                FormHandlers.handleMatiereFormSubmit(e);
            });
        }

        // Formulaire d'enseignant
        const formEnseignant = document.getElementById('formAjouterEnseignant');
        if (formEnseignant) {
            formEnseignant.addEventListener('submit', (e) => {
                FormHandlers.handleEnseignantFormSubmit(e);
            });
        }

        // Formulaire de salle
        const formSalle = document.getElementById('formAjouterSalle');
        if (formSalle) {
            formSalle.addEventListener('submit', (e) => {
                FormHandlers.handleSalleFormSubmit(e);
            });
        }

        // Formulaire de filière
        const formFiliere = document.getElementById('formAjouterFiliere');
        if (formFiliere) {
            formFiliere.addEventListener('submit', (e) => {
                FormHandlers.handleFiliereFormSubmit(e);
            });
        }
    }

    /**
     * Peuple les listes déroulantes des formulaires
     */
    populateFormSelects() {
        // Filières (pour formulaire de séance et de matière)
        const selectFiliere = document.getElementById('selectFiliere');
        const selectFiliereMatiere = document.getElementById('selectFiliereMatiere');
        
        if (selectFiliere || selectFiliereMatiere) {
            const filieres = StateManager.getCurrentSessionFilieres();
            const options = '<option value="">-- Sélectionner --</option>' + 
                filieres.map(f => `<option value="${f.nom}">${f.nom}</option>`).join('');
            
            if (selectFiliere) selectFiliere.innerHTML = options;
            if (selectFiliereMatiere) selectFiliereMatiere.innerHTML = options;
        }

        // Matières
        const selectMatiere = document.getElementById('selectMatiere');
        if (selectMatiere) {
            const subjects = StateManager.getCurrentSessionSubjects();
            selectMatiere.innerHTML = '<option value="">-- Sélectionner --</option>' +
                subjects.map(s => `<option value="${s.nom}">${s.nom}</option>`).join('');
        }

        // Enseignants
        this.populateTeacherSelects();

        // Salles
        this.populateRoomSelects();

        // Type de salle (pour le formulaire d'ajout de salle)
        const selectTypeSalle = document.getElementById('selectTypeSalle');
        if (selectTypeSalle) {
            selectTypeSalle.innerHTML = `
                <option value="Standard">Standard</option>
                <option value="Amphi">Amphi</option>
                <option value="STP">STP</option>
            `;
        }

        // Session de filière
        const selectSessionFiliere = document.getElementById('selectSessionFiliere');
        if (selectSessionFiliere) {
            selectSessionFiliere.innerHTML = `
                <option value="Automne">Automne</option>
                <option value="Printemps">Printemps</option>
            `;
        }

        // Peupler le sélecteur de vue EDT
        this.populateEDTViewSelector();

        // Peupler les selects de souhaits
        this.populateWishesSelects();
    }

    /**
     * Peuple le sélecteur de vue EDT
     */
    populateEDTViewSelector() {
        const selectView = document.getElementById('selectEDTView');
        if (!selectView) return;

        const filieres = StateManager.getCurrentSessionFilieres();
        
        let options = `
            <option value="global">Vue Globale</option>
            <option value="enseignant_selectionne">Enseignant Sélectionné</option>
        `;

        filieres.forEach(f => {
            options += `<option value="${f.nom}">${f.nom}</option>`;
        });

        selectView.innerHTML = options;
    }

    /**
     * Peuple les listes déroulantes d'enseignants
     */
    populateTeacherSelects() {
        const selects = ['inputEnseignant1', 'inputEnseignant2'];
        const teachers = StateManager.state.enseignants;

        selects.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                const currentValue = select.value;
                select.innerHTML = '<option value="">-- Aucun --</option>' +
                    teachers.map(t => `<option value="${t}">${t}</option>`).join('');
                
                // Restaurer la valeur sélectionnée si elle existe toujours
                if (currentValue && teachers.includes(currentValue)) {
                    select.value = currentValue;
                }
            }
        });
    }

    /**
     * Peuple les listes déroulantes de salles
     */
    populateRoomSelects() {
        const selectSalle = document.getElementById('selectSalle');
        if (selectSalle) {
            const salles = Object.keys(StateManager.state.sallesInfo).sort();
            const currentValue = selectSalle.value;
            
            selectSalle.innerHTML = '<option value="">-- Sélectionner --</option>' +
                '<option value="">Sans salle</option>' +
                salles.map(s => {
                    const type = StateManager.state.sallesInfo[s];
                    return `<option value="${s}">${s} (${type})</option>`;
                }).join('');
            
            // Restaurer la valeur sélectionnée si elle existe toujours
            if (currentValue && salles.includes(currentValue)) {
                selectSalle.value = currentValue;
            }
        }
    }

    /**
     * Peuple les selects du formulaire de souhaits
     */
    populateWishesSelects() {
        const enseignants = StateManager.state.enseignants;
        const matieres = Object.keys(StateManager.state.matiereGroupes);

        // Select enseignant
        const selectEns = document.getElementById('selectEnseignantSouhaits');
        if (selectEns) {
            selectEns.innerHTML = '<option value="">-- Sélectionner un enseignant --</option>' +
                enseignants.map(e => `<option value="${e}">${e}</option>`).join('');
        }

        // Selects matières
        const matiereSelects = ['inputChoix1', 'inputChoix2', 'inputChoix3'];
        matiereSelects.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                select.innerHTML = '<option value="">-- Sélectionner --</option>' +
                    matieres.map(m => `<option value="${m}">${m}</option>`).join('');
            }
        });
    }

    /**
     * Initialise les onglets
     */
    initializeTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.dataset.tab;

                // Retirer la classe active de tous les boutons et panneaux
                document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

                // Activer le bouton et le panneau sélectionné
                button.classList.add('active');
                const targetPane = document.getElementById(`tab-${tabId}`);
                if (targetPane) {
                    targetPane.classList.add('active');
                }

                // Rafraîchir le contenu de l'onglet
                this.refreshTabContent(tabId);
            });
        });
    }

    /**
     * Rafraîchit le contenu d'un onglet
     * @param {string} tabId - L'ID de l'onglet
     */
    refreshTabContent(tabId) {
        switch (tabId) {
            case 'planning':
                TableRenderer.render();
                break;
            case 'volumes':
                VolumeRenderer.render();
                break;
            case 'stats':
                StatsRenderer.render();
                break;
            case 'gestion':
                ListRenderer.renderAll();
                break;
            case 'souhaits':
                WishesRenderer.render();
                this.populateWishesSelects();
                break;
        }
    }

    /**
     * Attache les event listeners principaux
     */
    attachEventListeners() {
        // Bouton de sauvegarde
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                StateManager.saveState();
                NotificationManager.success('Données sauvegardées');
            });
        }

        // Bouton clear log
        const clearLogBtn = document.getElementById('btnClearLog');
        if (clearLogBtn) {
            clearLogBtn.addEventListener('click', () => {
                LogService.clear();
            });
        }

        // Changement de session
        const selectSession = document.getElementById('selectSession');
        if (selectSession) {
            selectSession.addEventListener('change', (e) => {
                this.handleSessionChange(e.target.value);
            });
        }

        // Changement d'année universitaire
        const inputAnnee = document.getElementById('inputAnneeUniversitaire');
        if (inputAnnee) {
            inputAnnee.addEventListener('change', (e) => {
                StateManager.state.header.annee = e.target.value;
                StateManager.saveState();
                LogService.info(`Année universitaire mise à jour: ${e.target.value}`);
            });
        }

        // Changement de département
        const selectDept = document.getElementById('selectDepartement');
        if (selectDept) {
            selectDept.addEventListener('change', (e) => {
                StateManager.state.header.departement = e.target.value;
                StateManager.saveState();
                LogService.info(`Département mis à jour: ${e.target.value}`);
            });
        }

        // Bouton export projet
        const btnExportProject = document.getElementById('btnExportProject');
        if (btnExportProject) {
            btnExportProject.addEventListener('click', () => {
                this.exportProject();
            });
        }

        // Bouton import projet
        const btnImportProject = document.getElementById('btnImportProject');
        const fileImportProject = document.getElementById('fileImportProject');
        if (btnImportProject && fileImportProject) {
            btnImportProject.addEventListener('click', () => {
                fileImportProject.click();
            });

            fileImportProject.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.importProject(file);
                    e.target.value = '';
                }
            });
        }

        // Bouton reset EDT
        const btnResetEDT = document.getElementById('btnResetEDT');
        if (btnResetEDT) {
            btnResetEDT.addEventListener('click', () => {
                this.resetCurrentSessionEDT();
            });
        }

        // Bouton reset projet complet
        const btnResetProject = document.getElementById('btnResetProject');
        if (btnResetProject) {
            btnResetProject.addEventListener('click', () => {
                this.resetProject();
            });
        }
    }

    /**
     * Attache les event listeners des services avancés
     */
    attachAdvancedServiceListeners() {
        // === PLANIFICATION AUTOMATIQUE ===
        const btnAutoGenerate = document.getElementById('btnAutoGenerateAll');
        if (btnAutoGenerate) {
            btnAutoGenerate.addEventListener('click', () => {
                SchedulingHandlers.generateAllSessions();
            });
        }

        const btnOptimize = document.getElementById('btnOptimizeSchedule');
        if (btnOptimize) {
            btnOptimize.addEventListener('click', () => {
                SchedulingHandlers.optimizeSchedule();
            });
        }

        const btnResolveConflicts = document.getElementById('btnResolveConflicts');
        if (btnResolveConflicts) {
            btnResolveConflicts.addEventListener('click', () => {
                SchedulingHandlers.resolveConflicts();
            });
        }

        // === EXPORT ===
        const btnExportPDF = document.getElementById('btnExportPDF');
        if (btnExportPDF) {
            btnExportPDF.addEventListener('click', () => {
                ExportHandlers.showPDFExportDialog();
            });
        }

        const btnExportExcel = document.getElementById('btnExportExcel');
        if (btnExportExcel) {
            btnExportExcel.addEventListener('click', () => {
                ExportHandlers.showExcelExportDialog();
            });
        }

        const btnExportVolumes = document.getElementById('btnExportVolumes');
        if (btnExportVolumes) {
            btnExportVolumes.addEventListener('click', () => {
                ExportHandlers.exportVolumes();
            });
        }

        // === IMPORT (onglet rapports) ===
        const btnImportWishes = document.getElementById('btnImportWishes');
        const fileImportWishes = document.getElementById('fileImportWishes');
        
        if (btnImportWishes && fileImportWishes) {
            btnImportWishes.addEventListener('click', () => {
                ImportHandlers.triggerWishesImport();
            });

            fileImportWishes.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    ImportHandlers.importWishes(file);
                    e.target.value = '';
                }
            });
        }

        const btnImportSubjects = document.getElementById('btnImportSubjects');
        const fileImportSubjects = document.getElementById('fileImportSubjects');
        
        if (btnImportSubjects && fileImportSubjects) {
            btnImportSubjects.addEventListener('click', () => {
                ImportHandlers.triggerSubjectsImport();
            });

            fileImportSubjects.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    ImportHandlers.importSubjects(file);
                    e.target.value = '';
                }
            });
        }

        // Téléchargement des templates (onglet rapports)
        const btnDownloadWishesTemplate = document.getElementById('btnDownloadWishesTemplate');
        if (btnDownloadWishesTemplate) {
            btnDownloadWishesTemplate.addEventListener('click', () => {
                ImportHandlers.downloadWishesTemplate();
            });
        }

        const btnDownloadSubjectsTemplate = document.getElementById('btnDownloadSubjectsTemplate');
        if (btnDownloadSubjectsTemplate) {
            btnDownloadSubjectsTemplate.addEventListener('click', () => {
                ImportHandlers.downloadSubjectsTemplate();
            });
        }
    }

    /**
     * Attache les event listeners de l'onglet souhaits
     */
    attachWishesListeners() {
        // Import souhaits (onglet souhaits)
        const btnImportWishesMain = document.getElementById('btnImportWishesMain');
        const fileImportWishesMain = document.getElementById('fileImportWishesMain');

        if (btnImportWishesMain && fileImportWishesMain) {
            btnImportWishesMain.addEventListener('click', () => {
                fileImportWishesMain.click();
            });

            fileImportWishesMain.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    ImportHandlers.importWishes(file).then(() => {
                        WishesRenderer.render();
                    });
                    e.target.value = '';
                }
            });
        }

        const btnDownloadWishesTemplateMain = document.getElementById('btnDownloadWishesTemplateMain');
        if (btnDownloadWishesTemplateMain) {
            btnDownloadWishesTemplateMain.addEventListener('click', () => {
                ImportHandlers.downloadWishesTemplate();
            });
        }

        // Formulaire de souhaits manuel
        const formSouhaitsEnseignant = document.getElementById('formSouhaitsEnseignant');
        if (formSouhaitsEnseignant) {
            formSouhaitsEnseignant.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSaveWishes();
            });
        }

        const btnResetWishesForm = document.getElementById('btnResetWishesForm');
        if (btnResetWishesForm) {
            btnResetWishesForm.addEventListener('click', () => {
                this.resetWishesForm();
            });
        }

        const selectEnseignantSouhaits = document.getElementById('selectEnseignantSouhaits');
        if (selectEnseignantSouhaits) {
            selectEnseignantSouhaits.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.loadTeacherWishes(e.target.value);
                }
            });
        }
    }

    /**
     * Charge les souhaits d'un enseignant dans le formulaire
     * @param {string} nom - Le nom de l'enseignant
     */
    loadTeacherWishes(nom) {
        const souhaits = StateManager.state.enseignantSouhaits[nom] || {};

        document.getElementById('selectEnseignantSouhaits').value = nom;
        document.getElementById('inputChoix1').value = souhaits.choix1 || '';
        document.getElementById('inputC1').value = souhaits.c1 || '';
        document.getElementById('inputTD1').value = souhaits.td1 || '';
        document.getElementById('inputTP1').value = souhaits.tp1 || '';
        document.getElementById('inputChoix2').value = souhaits.choix2 || '';
        document.getElementById('inputC2').value = souhaits.c2 || '';
        document.getElementById('inputTD2').value = souhaits.td2 || '';
        document.getElementById('inputTP2').value = souhaits.tp2 || '';
        document.getElementById('inputChoix3').value = souhaits.choix3 || '';
        document.getElementById('inputC3').value = souhaits.c3 || '';
        document.getElementById('inputTD3').value = souhaits.td3 || '';
        document.getElementById('inputTP3').value = souhaits.tp3 || '';
        document.getElementById('inputContraintes').value = souhaits.contraintes || 'Aucune remarque.';

        // Scroll vers le formulaire
        document.getElementById('formSouhaitsEnseignant').scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Sauvegarde les souhaits saisis manuellement
     */
    handleSaveWishes() {
        const nom = document.getElementById('selectEnseignantSouhaits').value;

        if (!nom) {
            DialogManager.error('Veuillez sélectionner un enseignant.');
            return;
        }

        const souhaits = {
            choix1: document.getElementById('inputChoix1').value,
            c1: parseFloat(document.getElementById('inputC1').value) || 0,
            td1: parseFloat(document.getElementById('inputTD1').value) || 0,
            tp1: parseFloat(document.getElementById('inputTP1').value) || 0,
            choix2: document.getElementById('inputChoix2').value,
            c2: parseFloat(document.getElementById('inputC2').value) || 0,
            td2: parseFloat(document.getElementById('inputTD2').value) || 0,
            tp2: parseFloat(document.getElementById('inputTP2').value) || 0,
            choix3: document.getElementById('inputChoix3').value,
            c3: parseFloat(document.getElementById('inputC3').value) || 0,
            td3: parseFloat(document.getElementById('inputTD3').value) || 0,
            tp3: parseFloat(document.getElementById('inputTP3').value) || 0,
            contraintes: document.getElementById('inputContraintes').value || 'Aucune remarque.'
        };

        StateManager.state.enseignantSouhaits[nom] = souhaits;
        StateManager.saveState();

        LogService.success(`✅ Souhaits de ${nom} enregistrés`);
        NotificationManager.success('Souhaits enregistrés');
        WishesRenderer.render();
        this.resetWishesForm();
    }

    /**
     * Réinitialise le formulaire de souhaits
     */
    resetWishesForm() {
        document.getElementById('formSouhaitsEnseignant').reset();
    }

    /**
     * Initialise le renderer de tableau
     */
    initializeTableRenderer() {
        // Initialiser le sélecteur de vue
        const selectView = document.getElementById('selectEDTView');
        if (selectView) {
            selectView.addEventListener('change', (e) => {
                TableRenderer.setFilter(e.target.value);
                this.renderAll();
            });
        }

        // Initialiser les filtres de recherche
        const searchInputs = {
            searchMatiere: 'matiere',
            searchEnseignant: 'enseignant',
            searchSalle: 'salle',
            searchSectionGroupe: 'sectionGroupe'
        };

        Object.entries(searchInputs).forEach(([inputId, filterKey]) => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('input', () => {
                    const filters = {};
                    Object.entries(searchInputs).forEach(([id, key]) => {
                        filters[key] = document.getElementById(id)?.value || '';
                    });
                    TableRenderer.setSearchFilters(filters);
                    this.renderAll();
                });
            }
        });

        // Bouton clear filters
        const btnClearFilters = document.getElementById('btnClearFilters');
        if (btnClearFilters) {
            btnClearFilters.addEventListener('click', () => {
                Object.keys(searchInputs).forEach(id => {
                    const input = document.getElementById(id);
                    if (input) input.value = '';
                });
                TableRenderer.setSearchFilters({
                    matiere: '',
                    enseignant: '',
                    salle: '',
                    sectionGroupe: ''
                });
                this.renderAll();
                NotificationManager.info('Filtres réinitialisés', 2000);
            });
        }
    }

    /**
     * Gère le changement de session
     * @param {string} newSession - La nouvelle session
     */
    handleSessionChange(newSession) {
        const oldSession = StateManager.state.header.session;

        if (oldSession === newSession) return;

        DialogManager.confirm(
            'Changer de Session',
            `Voulez-vous vraiment passer à <strong>${newSession}</strong> ?<br><br>L'emploi du temps actuel sera sauvegardé.`,
            () => {
                SpinnerManager.show();

                setTimeout(() => {
                    StateManager.changeSession(newSession);
                    this.populateFormSelects();
                    this.renderAll();
                    SpinnerManager.hide();
                    NotificationManager.success(`Session changée : ${newSession}`);
                }, 300);
            },
            () => {
                document.getElementById('selectSession').value = oldSession;
            }
        );
    }

    /**
     * S'abonne aux événements d'état
     */
    subscribeToStateEvents() {
        StateManager.subscribe('seance:added', () => {
            this.renderAll();
        });

        StateManager.subscribe('seance:removed', () => {
            this.renderAll();
        });

        StateManager.subscribe('seance:updated', () => {
            this.renderAll();
        });

        StateManager.subscribe('seance:moved', () => {
            this.renderAll();
        });

        StateManager.subscribe('session:changed', () => {
            this.renderAll();
        });

        StateManager.subscribe('teacher:added', () => {
            this.populateTeacherSelects();
            this.populateWishesSelects();
            this.renderAll();
        });

        StateManager.subscribe('teacher:removed', () => {
            this.populateTeacherSelects();
            this.populateWishesSelects();
            this.renderAll();
        });

        StateManager.subscribe('subject:added', () => {
            this.populateFormSelects();
            this.renderAll();
        });

        StateManager.subscribe('subject:removed', () => {
            this.populateFormSelects();
            this.renderAll();
        });

        StateManager.subscribe('edt:reset', () => {
            this.renderAll();
        });

        StateManager.subscribe('project:reset', () => {
            this.populateFormSelects();
            this.renderAll();
        });
    }

    /**
     * Rafraîchit toute l'interface
     */
    renderAll() {
        console.log('🔄 Rafraîchissement de l\'interface...');
        
        // Rendre le tableau EDT
        TableRenderer.render();
        
        // Rendre les volumes
        VolumeRenderer.render();
        
        // Rendre les stats
        StatsRenderer.render();
        
        // Rendre les listes
        ListRenderer.renderAll();

        // Rendre les souhaits
        WishesRenderer.render();

        // Sauvegarder automatiquement
        StateManager.saveState(true);
    }

    /**
     * Exporte le projet complet
     */
    exportProject() {
        try {
            const data = StorageService.exportProject();
            const jsonString = JSON.stringify(data, null, 2);
            
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sauvegarde_edt_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            LogService.success('✅ Projet exporté avec succès');
            NotificationManager.success('Projet exporté');
        } catch (error) {
            LogService.error(`❌ Erreur lors de l'export: ${error.message}`);
            NotificationManager.error('Erreur lors de l\'export');
        }
    }

    /**
     * Importe un projet
     * @param {File} file - Le fichier à importer
     */
    async importProject(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    DialogManager.confirm(
                        'Confirmer l\'Importation',
                        'Êtes-vous sûr de vouloir importer ce projet ?<br><strong>Tout votre travail actuel sera écrasé.</strong>',
                        () => {
                            SpinnerManager.show();

                            setTimeout(() => {
                                const success = StorageService.importProject(data);
                                
                                if (success) {
                                    StateManager.loadState();
                                    initCreneaux(StateManager.state.creneaux);
                                    this.populateFormSelects();
                                    this.renderAll();
                                    SpinnerManager.hide();
                                    LogService.success('✅ Projet importé avec succès');
                                    NotificationManager.success('Projet importé');
                                    resolve(true);
                                } else {
                                    SpinnerManager.hide();
                                    LogService.error('❌ Erreur lors de l\'importation');
                                    NotificationManager.error('Erreur d\'importation');
                                    reject(new Error('Import failed'));
                                }
                            }, 500);
                        },
                        () => {
                            resolve(false);
                        }
                    );
                } catch (error) {
                    LogService.error(`❌ Erreur: ${error.message}`);
                    NotificationManager.error('Fichier invalide');
                    reject(error);
                }
            };

            reader.onerror = () => {
                LogService.error('❌ Erreur de lecture du fichier');
                NotificationManager.error('Erreur de lecture');
                reject(new Error('File read error'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * Réinitialise l'EDT de la session actuelle
     */
    resetCurrentSessionEDT() {
        DialogManager.confirm(
            'Réinitialiser l\'EDT',
            `Voulez-vous vraiment <strong>supprimer toutes les séances</strong> de la session actuelle ?<br><br>Cette action est <strong>irréversible</strong>.`,
            () => {
                StateManager.resetCurrentSessionEDT();
                this.renderAll();
                LogService.warning('⚠️ EDT de la session réinitialisé');
                NotificationManager.warning('EDT réinitialisé');
            }
        );
    }

    /**
     * Réinitialise complètement le projet
     */
    resetProject() {
        DialogManager.confirm(
            'Réinitialiser le Projet Complet',
            `<strong style="color: red;">ATTENTION !</strong><br><br>Voulez-vous vraiment <strong>supprimer TOUTES les données</strong> du projet ?<br><br>Cela inclut :<br>
            - Toutes les séances (automne et printemps)<br>
            - Tous les enseignants<br>
            - Toutes les matières<br>
            - Toutes les configurations<br><br>
            Cette action est <strong>IRRÉVERSIBLE</strong>.`,
            () => {
                StateManager.resetProject();
                initCreneaux(StateManager.state.creneaux);
                this.populateFormSelects();
                this.renderAll();
                LogService.warning('⚠️ Projet complètement réinitialisé');
                NotificationManager.warning('Projet réinitialisé');
            }
        );
    }
}

// === INITIALISATION ===
const app = new EDTApplication();

// Attendre que le DOM soit chargé
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

// === EXPORTS GLOBAUX ===
window.EDTApp = app;

// Controllers
window.EDTState = StateManager;
window.EDTSessionController = SessionController;
window.EDTTeacherController = TeacherController;
window.EDTSubjectController = SubjectController;
window.EDTRoomController = RoomController;

// Services
window.EDTLog = LogService;
window.EDTConflictService = ConflictService;
window.EDTVolumeService = VolumeService;
window.EDTStorage = StorageService;

// UI Managers
window.EDTDialog = DialogManager;
window.EDTNotification = NotificationManager;
window.EDTSpinner = SpinnerManager;

// Renderers
window.EDTTableRenderer = TableRenderer;
window.EDTVolumeRenderer = VolumeRenderer;
window.EDTStatsRenderer = StatsRenderer;
window.EDTListRenderer = ListRenderer;
window.EDTWishesRenderer = WishesRenderer;
window.EDTFormManager = FormManager;

// Handlers
window.EDTHandlers = EventHandlers;
window.EDTFormHandlers = FormHandlers;
window.EDTSchedulingHandlers = SchedulingHandlers;
window.EDTExportHandlers = ExportHandlers;
window.EDTImportHandlers = ImportHandlers;