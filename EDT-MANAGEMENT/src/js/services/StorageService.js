/**
 * Service de gestion du localStorage
 * @author Ibrahim Mrani - UCD
 */

import { STORAGE_KEYS } from '../config/constants.js';
import { 
    DEFAULT_FILIERES, 
    DEFAULT_ENSEIGNANTS, 
    DEFAULT_SALLES_INFO,
    DEFAULT_MATIERE_GROUPES_INFO,
    getDefaultSession,
    getDefaultAcademicYear,
    DEPARTEMENTS
} from '../config/defaults.js';
import { getSessionSpecificKey } from '../utils/helpers.js';

class StorageService {
    constructor() {
        this.storage = window.localStorage;
    }

    /**
     * Sauvegarde une valeur dans le localStorage
     * @param {string} key - La clé de stockage
     * @param {*} value - La valeur à stocker
     */
    save(key, value) {
        try {
            const serialized = JSON.stringify(value);
            this.storage.setItem(key, serialized);
            return true;
        } catch (error) {
            console.error(`Erreur lors de la sauvegarde de ${key}:`, error);
            return false;
        }
    }

    /**
     * Récupère une valeur du localStorage
     * @param {string} key - La clé de stockage
     * @param {*} defaultValue - Valeur par défaut si non trouvée
     * @returns {*} La valeur récupérée ou la valeur par défaut
     */
    load(key, defaultValue = null) {
        try {
            const item = this.storage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error(`Erreur lors du chargement de ${key}:`, error);
            return defaultValue;
        }
    }

    /**
     * Supprime une clé du localStorage
     * @param {string} key - La clé à supprimer
     */
    remove(key) {
        this.storage.removeItem(key);
    }

    /**
     * Vide complètement le localStorage
     */
    clear() {
        this.storage.clear();
    }

    /**
     * Sauvegarde les données spécifiques à une session
     * @param {string} session - La session (ex: "Session d'automne")
     * @param {Array} seances - Les séances
     * @param {number} nextId - Le prochain ID
     */
    saveSessionData(session, seances, nextId) {
        const seancesKey = getSessionSpecificKey(STORAGE_KEYS.SEANCES, session);
        const nextIdKey = getSessionSpecificKey(STORAGE_KEYS.NEXT_ID, session);
        
        this.save(seancesKey, seances);
        this.save(nextIdKey, nextId);
    }

    /**
     * Charge les données spécifiques à une session
     * @param {string} session - La session
     * @returns {Object} { seances, nextId }
     */
    loadSessionData(session) {
        const seancesKey = getSessionSpecificKey(STORAGE_KEYS.SEANCES, session);
        const nextIdKey = getSessionSpecificKey(STORAGE_KEYS.NEXT_ID, session);
        
        const seances = this.load(seancesKey, []);
        const nextId = this.load(nextIdKey, 1);
        
        return { seances, nextId };
    }

    /**
     * Sauvegarde les données globales (non spécifiques à une session)
     * @param {Object} data - Les données à sauvegarder
     */
    saveGlobalData(data) {
        const {
            enseignants,
            sallesInfo,
            souhaits,
            matiereGroupes,
            filieres,
            volumesSupplementaires,
            creneaux,
            volumesAutomne,
            autoSallesParFiliere
        } = data;

        if (enseignants !== undefined) this.save(STORAGE_KEYS.ENSEIGNANTS, enseignants);
        if (sallesInfo !== undefined) this.save(STORAGE_KEYS.SALLES_INFO, sallesInfo);
        if (souhaits !== undefined) this.save(STORAGE_KEYS.SOUHAITS, souhaits);
        if (matiereGroupes !== undefined) this.save(STORAGE_KEYS.MATIERE_GROUPES, matiereGroupes);
        if (filieres !== undefined) this.save(STORAGE_KEYS.FILIERES, filieres);
        if (volumesSupplementaires !== undefined) this.save(STORAGE_KEYS.VOLUMES_SUP, volumesSupplementaires);
        if (creneaux !== undefined) this.save(STORAGE_KEYS.CRENEAUX, creneaux);
        if (volumesAutomne !== undefined) this.save(STORAGE_KEYS.VOLUMES_AUTOMNE, volumesAutomne);
        if (autoSallesParFiliere !== undefined) this.save(STORAGE_KEYS.AUTO_SALLES, autoSallesParFiliere);
    }

    /**
     * Charge les données globales
     * @returns {Object} Toutes les données globales
     */
    loadGlobalData() {
        return {
            enseignants: this.load(STORAGE_KEYS.ENSEIGNANTS, [...DEFAULT_ENSEIGNANTS].sort()),
            sallesInfo: this.load(STORAGE_KEYS.SALLES_INFO, { ...DEFAULT_SALLES_INFO }),
            souhaits: this.load(STORAGE_KEYS.SOUHAITS, {}),
            matiereGroupes: this.migrateMatiereGroupes(
                this.load(STORAGE_KEYS.MATIERE_GROUPES, { ...DEFAULT_MATIERE_GROUPES_INFO })
            ),
            filieres: this.migrateFilieres(
                this.load(STORAGE_KEYS.FILIERES, [...DEFAULT_FILIERES])
            ),
            volumesSupplementaires: this.load(STORAGE_KEYS.VOLUMES_SUP, {}),
            creneaux: this.load(STORAGE_KEYS.CRENEAUX, null),
            volumesAutomne: this.load(STORAGE_KEYS.VOLUMES_AUTOMNE, {}),
            autoSallesParFiliere: this.load(STORAGE_KEYS.AUTO_SALLES, {})
        };
    }

    /**
     * Sauvegarde les informations d'en-tête
     * @param {Object} header - { annee, session, departement }
     */
    saveHeader(header) {
        if (header.annee !== undefined) this.save(STORAGE_KEYS.HEADER_ANNEE, header.annee);
        if (header.session !== undefined) this.save(STORAGE_KEYS.HEADER_SESSION, header.session);
        if (header.departement !== undefined) this.save(STORAGE_KEYS.HEADER_DEPT, header.departement);
    }

    /**
     * Charge les informations d'en-tête
     * @returns {Object} { annee, session, departement }
     */
    loadHeader() {
        return {
            annee: this.load(STORAGE_KEYS.HEADER_ANNEE, getDefaultAcademicYear()),
            session: this.load(STORAGE_KEYS.HEADER_SESSION, getDefaultSession()),
            departement: this.load(STORAGE_KEYS.HEADER_DEPT, DEPARTEMENTS[0])
        };
    }

    /**
     * Migration des filières de l'ancien format (array de strings) au nouveau (array d'objets)
     * @param {Array} filieres - Les filières à migrer
     * @returns {Array} Les filières migrées
     */
    migrateFilieres(filieres) {
        if (!filieres || filieres.length === 0) return [...DEFAULT_FILIERES];
        
        // Vérifie si c'est l'ancien format (array de strings)
        if (typeof filieres[0] === 'string') {
            console.log('Migration des filières vers le nouveau format...');
            return filieres.map(f => ({ nom: f, session: 'Automne' }));
        }
        
        return filieres;
    }

    /**
     * Migration des matières pour ajouter les champs manquants
     * @param {Object} matiereGroupes - Les matières à migrer
     * @returns {Object} Les matières migrées
     */
    migrateMatiereGroupes(matiereGroupes) {
        const migrated = {};
        
        for (const matiere in matiereGroupes) {
            const info = matiereGroupes[matiere];
            
            migrated[matiere] = {
                filiere: info.filiere || '',
                sections_cours: info.sections_cours || 0,
                td_groups: info.td_groups || 0,
                tp_groups: info.tp_groups || 0,
                volumeHTP: info.volumeHTP || { Cours: 48, TD: 32, TP: 36 },
                nbEnseignantsTP: info.nbEnseignantsTP || 1
            };
        }
        
        return migrated;
    }

    /**
     * Exporte toutes les données du projet
     * @returns {Object} Toutes les données
     */
    exportProject() {
        const globalData = this.loadGlobalData();
        const header = this.loadHeader();
        
        // Charger les données des deux sessions
        const automneData = this.loadSessionData("Session d'automne");
        const printempsData = this.loadSessionData("Session de printemps");
        
        return {
            version: "2.9-modular",
            exportDate: new Date().toISOString(),
            headerInfo: header,
            ...globalData,
            sessionData: {
                "Session_d'automne": automneData,
                "Session_de_printemps": printempsData
            }
        };
    }

    /**
     * Importe les données d'un projet
     * @param {Object} data - Les données à importer
     * @returns {boolean} Succès de l'import
     */
    importProject(data) {
        try {
            // Sauvegarder les données globales
            this.saveGlobalData({
                enseignants: data.LISTE_ENSEIGNANTS || data.enseignants,
                sallesInfo: data.SALLES_INFO || data.sallesInfo,
                souhaits: data.ENSEIGNANT_SOUHAITS || data.souhaits,
                matiereGroupes: data.MATIERE_GROUPES_INFO || data.matiereGroupes,
                filieres: data.LISTE_FILIERES || data.filieres,
                volumesSupplementaires: data.ENSEIGNANT_VOLUMES_SUPPLEMENTAIRES || data.volumesSupplementaires,
                creneaux: data.LISTE_CRENEAUX || data.creneaux,
                volumesAutomne: data.VOLUMES_AUTOMNE || data.volumesAutomne,
                autoSallesParFiliere: data.AUTO_SALLE_CHOICES_PAR_FILIERE || data.autoSallesParFiliere
            });

            // Sauvegarder les données de session
            if (data.sessionData) {
                const automne = data.sessionData["Session_d'automne"];
                const printemps = data.sessionData["Session_de_printemps"];
                
                if (automne) {
                    this.saveSessionData("Session d'automne", automne.seances, automne.nextSessionId || automne.nextId);
                }
                if (printemps) {
                    this.saveSessionData("Session de printemps", printemps.seances, printemps.nextSessionId || printemps.nextId);
                }
            }

            // Sauvegarder l'en-tête
            if (data.headerInfo) {
                this.saveHeader(data.headerInfo);
            }

            return true;
        } catch (error) {
            console.error('Erreur lors de l\'import:', error);
            return false;
        }
    }
}

// Export d'une instance singleton
export default new StorageService();