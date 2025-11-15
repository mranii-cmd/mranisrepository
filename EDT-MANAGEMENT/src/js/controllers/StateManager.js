/**
 * Gestionnaire de l'état global de l'application
 * @author Ibrahim Mrani - UCD
 */

import { DEFAULT_CRENEAUX } from '../config/constants.js';
import Session from '../models/Session.js';
import Teacher from '../models/Teacher.js';
import Subject from '../models/Subject.js';
import StorageService from '../services/StorageService.js';

class StateManager {
    constructor() {
        // État global de l'application
        this.state = {
            // Données principales
            seances: [],
            nextSessionId: 1,
            enseignants: [],
            sallesInfo: {},
            matiereGroupes: {},
            filieres: [],
            creneaux: {},
            forfaits: [],
            
            // Souhaits et volumes
            enseignantSouhaits: {},
            enseignantVolumesSupplementaires: {},
            volumesAutomne: {},
            autoSallesParFiliere: {},
            
            // En-tête
            header: {
                annee: '',
                session: '',
                departement: ''
            },
            
            // État UI
            currentlyEditingSessionId: null,
            currentlySelectedCell: null,
            currentlySelectedSeance: null,
            activeFiliereConstraint: null,
            draggedSessionId: null,
            
            // Changements temporaires
            tempFiliereSessionChanges: {}
        };

        this.listeners = new Map();
    }

    /**
     * Initialise l'état depuis le localStorage
     */
    loadState() {
        // Charger les données globales
        const globalData = StorageService.loadGlobalData();
        
        this.state.enseignants = globalData.enseignants;
        this.state.sallesInfo = globalData.sallesInfo;
        this.state.enseignantSouhaits = globalData.souhaits;
        this.state.matiereGroupes = globalData.matiereGroupes;
        this.state.filieres = globalData.filieres;
        this.state.forfaits = globalData.forfaits || [];
        this.state.enseignantVolumesSupplementaires = globalData.volumesSupplementaires;
        this.state.creneaux = globalData.creneaux || { ...DEFAULT_CRENEAUX };
        this.state.volumesAutomne = globalData.volumesAutomne;
        this.state.autoSallesParFiliere = globalData.autoSallesParFiliere;

        // Charger l'en-tête
        this.state.header = StorageService.loadHeader();

        // Charger les données de session
        const sessionData = StorageService.loadSessionData(this.state.header.session);
        this.state.seances = sessionData.seances.map(s => new Session(s));
        this.state.nextSessionId = sessionData.nextId;
    }

    /**
     * Sauvegarde l'état dans le localStorage
     * @param {boolean} silent - Mode silencieux (sans log)
     */
    saveState(silent = false) {
        // Sauvegarder les données de session
        StorageService.saveSessionData(
            this.state.header.session,
            this.state.seances.map(s => s.toJSON()),
            this.state.nextSessionId
        );

        // Sauvegarder les données globales
        StorageService.saveGlobalData({
            enseignants: this.state.enseignants,
            sallesInfo: this.state.sallesInfo,
            souhaits: this.state.enseignantSouhaits,
            matiereGroupes: this.state.matiereGroupes,
            filieres: this.state.filieres,
            forfaits: this.state.forfaits,
            volumesSupplementaires: this.state.enseignantVolumesSupplementaires,
            creneaux: this.state.creneaux,
            volumesAutomne: this.state.volumesAutomne,
            autoSallesParFiliere: this.state.autoSallesParFiliere
        });

        // Sauvegarder l'en-tête
        StorageService.saveHeader(this.state.header);

        // Notifier les listeners
        if (!silent) {
            this.notify('state:saved');
        }
    }

    /**
     * Change la session active
     * @param {string} newSession - La nouvelle session
     */
    changeSession(newSession) {
        // Sauvegarder l'état actuel
        this.saveState(true);

        // Charger la nouvelle session
        this.state.header.session = newSession;
        const sessionData = StorageService.loadSessionData(newSession);
        this.state.seances = sessionData.seances.map(s => new Session(s));
        this.state.nextSessionId = sessionData.nextId;

        // Notifier les listeners
        this.notify('session:changed', { session: newSession });
    }

    /**
     * Obtient toutes les séances
     * @returns {Array<Session>} Les séances
     */
    getSeances() {
        return this.state.seances;
    }

    /**
     * Ajoute une séance
     * @param {Session} session - La séance à ajouter
     * @returns {Session} La séance ajoutée
     */
    addSeance(session) {
        session.id = this.state.nextSessionId++;
        this.state.seances.push(session);
        this.notify('seance:added', { seance: session });
        return session;
    }

    /**
     * Supprime une séance
     * @param {number} id - L'ID de la séance
     * @returns {boolean} True si supprimée
     */
    removeSeance(id) {
        const index = this.state.seances.findIndex(s => s.id === id);
        if (index === -1) return false;

        const removed = this.state.seances.splice(index, 1)[0];
        this.notify('seance:removed', { seance: removed });
        return true;
    }

    /**
     * Met à jour une séance
     * @param {number} id - L'ID de la séance
     * @param {Object} updates - Les mises à jour
     * @returns {Session|null} La séance mise à jour
     */
    updateSeance(id, updates) {
        const seance = this.state.seances.find(s => s.id === id);
        if (!seance) return null;

        Object.assign(seance, updates);
        this.notify('seance:updated', { seance });
        return seance;
    }

    /**
     * Trouve une séance par ID
     * @param {number} id - L'ID
     * @returns {Session|null} La séance
     */
    findSeanceById(id) {
        return this.state.seances.find(s => s.id === id) || null;
    }

    /**
     * Obtient les enseignants sous forme d'objets Teacher
     * @returns {Array<Teacher>} Les enseignants
     */
    getTeachers() {
        return this.state.enseignants.map(nom => {
            return new Teacher(nom, {
                souhaits: this.state.enseignantSouhaits[nom],
                volumesSupplementaires: this.state.enseignantVolumesSupplementaires[nom] || []
            });
        });
    }

    /**
     * Obtient les matières sous forme d'objets Subject
     * @returns {Array<Subject>} Les matières
     */
    getSubjects() {
        return Object.keys(this.state.matiereGroupes).map(nom => {
            return new Subject(nom, this.state.matiereGroupes[nom]);
        });
    }

    /**
     * Obtient les matières de la session actuelle
     * @returns {Array<Subject>} Les matières
     */
    getCurrentSessionSubjects() {
        const currentSession = this.state.header.session;
        const sessionType = currentSession.toLowerCase().includes('automne') ? 'Automne' : 'Printemps';
        
        const filieresDeSession = new Set(
            this.state.filieres
                .filter(f => f.session === sessionType)
                .map(f => f.nom)
        );

        return this.getSubjects().filter(subject => {
            if (!subject.filiere) return true; // Inclure les matières non assignées
            return filieresDeSession.has(subject.filiere);
        });
    }

    /**
     * Obtient les filières de la session actuelle
     * @returns {Array<Object>} Les filières
     */
    getCurrentSessionFilieres() {
        const sessionType = this.state.header.session.toLowerCase().includes('automne') 
            ? 'Automne' 
            : 'Printemps';
        
        return this.state.filieres.filter(f => f.session === sessionType);
    }

    /**
     * Ajoute un enseignant
     * @param {string} nom - Le nom
     * @returns {boolean} True si ajouté
     */
    addTeacher(nom) {
        if (!nom || this.state.enseignants.includes(nom)) return false;
        
        this.state.enseignants.push(nom);
        this.state.enseignants.sort();
        this.notify('teacher:added', { nom });
        return true;
    }

    /**
     * Supprime un enseignant
     * @param {string} nom - Le nom
     * @returns {boolean} True si supprimé
     */
    removeTeacher(nom) {
        const index = this.state.enseignants.indexOf(nom);
        if (index === -1) return false;

        this.state.enseignants.splice(index, 1);
        delete this.state.enseignantSouhaits[nom];
        delete this.state.enseignantVolumesSupplementaires[nom];
        
        this.notify('teacher:removed', { nom });
        return true;
    }

    /**
     * Ajoute une matière
     * @param {string} nom - Le nom
     * @param {Object} config - La configuration
     * @returns {boolean} True si ajoutée
     */
    addSubject(nom, config = {}) {
        if (!nom || this.state.matiereGroupes[nom]) return false;

        this.state.matiereGroupes[nom] = {
            filiere: config.filiere || '',
            sections_cours: config.sections_cours || 0,
            td_groups: config.td_groups || 0,
            tp_groups: config.tp_groups || 0,
            volumeHTP: config.volumeHTP || { Cours: 48, TD: 32, TP: 36 },
            nbEnseignantsTP: config.nbEnseignantsTP || 1
        };

        this.notify('subject:added', { nom });
        return true;
    }

    /**
     * Supprime une matière
     * @param {string} nom - Le nom
     * @returns {boolean} True si supprimée
     */
    removeSubject(nom) {
        if (!this.state.matiereGroupes[nom]) return false;

        delete this.state.matiereGroupes[nom];
        this.notify('subject:removed', { nom });
        return true;
    }

    /**
     * Réinitialise l'EDT de la session actuelle
     */
    resetCurrentSessionEDT() {
        this.state.seances = [];
        this.state.nextSessionId = 1;
        this.notify('edt:reset');
    }

    /**
     * Réinitialise complètement le projet
     */
    resetProject() {
        StorageService.clear();
        this.loadState();
        this.notify('project:reset');
    }

    /**
     * S'abonne à un événement
     * @param {string} event - Le nom de l'événement
     * @param {Function} callback - La fonction de callback
     * @returns {Function} Fonction de désabonnement
     */
    subscribe(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        
        this.listeners.get(event).push(callback);

        // Retourner une fonction de désabonnement
        return () => {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        };
    }

    /**
     * Notifie les listeners d'un événement
     * @param {string} event - Le nom de l'événement
     * @param {*} data - Les données de l'événement
     */
    notify(event, data = null) {
        if (!this.listeners.has(event)) return;

        this.listeners.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in listener for ${event}:`, error);
            }
        });
    }

    /**
     * Obtient l'état complet (pour debug)
     * @returns {Object} L'état
     */
    getState() {
        return { ...this.state };
    }
}

// Export d'une instance singleton
export default new StateManager();