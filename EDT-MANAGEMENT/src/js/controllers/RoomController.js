/**
 * Contrôleur pour la gestion des salles
 * @author Ibrahim Mrani - UCD
 * @date 2025-11-06
 */

import StateManager from './StateManager.js';
import ConflictService from '../services/ConflictService.js';
import LogService from '../services/LogService.js';
import DialogManager from '../ui/DialogManager.js';
import NotificationManager from '../ui/NotificationManager.js';
import { getSortedCreneauxKeys } from '../utils/helpers.js';

class RoomController {
    /**
     * Obtient toutes les salles avec statistiques
     * @returns {Array} Liste des salles avec stats
     */
    static getAllRoomsWithStats() {
        const salles = Object.keys(StateManager.state.sallesInfo);
        const seances = StateManager.getSeances();
        const creneaux = Object.keys(StateManager.state.creneaux);
        const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

        return salles.map(nom => {
            const type = StateManager.state.sallesInfo[nom];
            const salleSeances = seances.filter(s => s.salle === nom);

            // Créneaux occupés (uniques)
            const usedSlots = new Set(salleSeances.map(s => `${s.jour}-${s.creneau}`)).size;
            const totalSlots = jours.length * creneaux.length;
            const occupancyRate = Math.round((usedSlots / totalSlots) * 100);

            return {
                nom,
                type,
                stats: {
                    totalSeances: salleSeances.length,
                    usedSlots,
                    totalSlots,
                    occupancy: {
                        rate: occupancyRate,
                        label: this.getOccupancyLabel(occupancyRate)
                    }
                }
            };
        }).sort((a, b) => a.nom.localeCompare(b.nom));
    }

    /**
     * Obtient le label d'occupation selon le taux
     * @param {number} rate - Le taux d'occupation (%)
     * @returns {string} Le label
     */
    static getOccupancyLabel(rate) {
        if (rate >= 80) return 'Très occupée';
        if (rate >= 60) return 'Bien occupée';
        if (rate >= 40) return 'Moyennement occupée';
        if (rate >= 20) return 'Peu occupée';
        return 'Sous-utilisée';
    }

    /**
     * Obtient le statut des salles pour un créneau spécifique
     * @param {string} jour - Le jour
     * @param {string} creneau - Le créneau
     * @returns {Object} { libres: Array, occupees: Array }
     */
    static getRoomsStatusForSlot(jour, creneau) {
        const salles = Object.keys(StateManager.state.sallesInfo);
        const seances = StateManager.getSeances();

        const libres = [];
        const occupees = [];

        salles.forEach(salle => {
            const isOccupied = ConflictService.isRoomOccupied(
                salle,
                jour,
                creneau,
                seances
            );

            const type = StateManager.state.sallesInfo[salle];

            const roomInfo = {
                nom: salle,
                type
            };

            if (isOccupied) {
                // Trouver la séance qui occupe la salle
                const seance = seances.find(s =>
                    s.salle === salle &&
                    s.jour === jour &&
                    s.creneau === creneau
                );

                occupees.push({
                    ...roomInfo,
                    seance: seance ? {
                        matiere: seance.matiere,
                        type: seance.type,
                        groupe: seance.groupe,
                        enseignant: seance.enseignantsArray.join(', ') || 'Non attribué'
                    } : null
                });
            } else {
                libres.push(roomInfo);
            }
        });

        return {
            libres: libres.sort((a, b) => a.nom.localeCompare(b.nom)),
            occupees: occupees.sort((a, b) => a.nom.localeCompare(b.nom))
        };
    }

    /**
     * Obtient la grille complète d'occupation d'une salle
     * @param {string} salle - Le nom de la salle
     * @returns {Object} Grille d'occupation
     */
    static getRoomOccupancyGrid(salle) {
        const seances = StateManager.getSeances();
        const creneaux = getSortedCreneauxKeys();
        // const creneaux = Object.keys(StateManager.state.creneaux).sort();
        const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

        const grid = {};

        jours.forEach(jour => {
            grid[jour] = {};
            creneaux.forEach(creneau => {
                const seance = seances.find(s =>
                    s.salle === salle &&
                    s.jour === jour &&
                    s.creneau === creneau
                );

                grid[jour][creneau] = seance ? {
                    occupied: true,
                    matiere: seance.matiere,
                    type: seance.type,
                    groupe: seance.groupe,
                    enseignant: seance.enseignantsArray.join(', ') || 'Non attribué',
                    seanceId: seance.id
                } : {
                    occupied: false
                };
            });
        });

        return {
            salle,
            type: StateManager.state.sallesInfo[salle],
            grid,
            jours,
            creneaux
        };
    }

    /**
     * Obtient les salles libres pour un type de séance et un créneau
     * @param {string} jour - Le jour
     * @param {string} creneau - Le créneau
     * @param {string} typeSeance - Le type de séance (Cours, TD, TP)
     * @returns {Array} Les salles libres compatibles
     */
    static getAvailableRooms(jour, creneau, typeSeance) {
        return ConflictService.getFreeRooms(
            jour,
            creneau,
            typeSeance,
            StateManager.state.sallesInfo,
            StateManager.getSeances()
        );
    }

    /**
     * Supprime une salle
     * @param {string} nom - Le nom de la salle
     */
    static removeRoom(nom) {
        const seances = StateManager.getSeances();
        const salleSeances = seances.filter(s => s.salle === nom);

        if (salleSeances.length > 0) {
            DialogManager.error(
                `Impossible de supprimer la salle <strong>${nom}</strong>.<br><br>` +
                `Elle est utilisée dans ${salleSeances.length} séance(s).<br><br>` +
                `Veuillez d'abord réattribuer ces séances à d'autres salles.`
            );
            return;
        }

        DialogManager.confirm(
            'Supprimer la Salle',
            `Voulez-vous vraiment supprimer la salle <strong>${nom}</strong> ?`,
            () => {
                delete StateManager.state.sallesInfo[nom];
                StateManager.saveState();

                LogService.success(`✅ Salle "${nom}" supprimée`);
                NotificationManager.success('Salle supprimée');

                // Notifier le changement
                StateManager.notify('room:deleted', { nom });
            }
        );
    }

    /**
     * Obtient les statistiques globales des salles
     * @returns {Object} Statistiques
     */
    static getGlobalStats() {
        const salles = this.getAllRoomsWithStats();
        const totalSalles = salles.length;

        const parType = {};
        salles.forEach(s => {
            if (!parType[s.type]) {
                parType[s.type] = 0;
            }
            parType[s.type]++;
        });

        const totalSeances = salles.reduce((sum, s) => sum + s.stats.totalSeances, 0);
        const avgOccupancy = totalSalles > 0
            ? Math.round(salles.reduce((sum, s) => sum + s.stats.occupancy.rate, 0) / totalSalles)
            : 0;

        const sousUtilisees = salles.filter(s => s.stats.occupancy.rate < 20).length;
        const surUtilisees = salles.filter(s => s.stats.occupancy.rate > 80).length;

        return {
            totalSalles,
            parType,
            totalSeances,
            avgOccupancy,
            sousUtilisees,
            surUtilisees
        };
    }

    // Dans /src/js/controllers/RoomController.js
    // Remplacez votre ancienne méthode "updateSallesParFiliere" par celle-ci :

    /**
     * Met à jour le POOL de salles auto pour une filière et un type
     * @param {string} filiere - La filière (ex: "S3 PC")
     * @param {string} typeSeance - Le type (ex: "Cours", "TD")
     * @param {HTMLSelectElement} selectElement - L'élément select (multiple)
     */
    static updateSallesParFiliere(filiere, typeSeance, selectElement) {

        // Récupérer toutes les valeurs sélectionnées
        const selectedSalles = Array.from(selectElement.options)
            .filter(option => option.selected)
            .map(option => option.value);

        if (!StateManager.state.autoSallesParFiliere[filiere]) {
            StateManager.state.autoSallesParFiliere[filiere] = {};
        }

        // Si la liste est vide, on retire la clé
        if (selectedSalles.length === 0) {
            delete StateManager.state.autoSallesParFiliere[filiere][typeSeance];
        } else {
            // Sauvegarder le tableau des salles
            StateManager.state.autoSallesParFiliere[filiere][typeSeance] = selectedSalles;
        }

        StateManager.saveState();

        const message = selectedSalles.length > 0
            ? `Pool de salles auto pour ${filiere} (${typeSeance}) réglé sur : [${selectedSalles.join(', ')}]`
            : `Pool de salles auto pour ${filiere} (${typeSeance}) réinitialisé`;

        LogService.info(`🔧 ${message}`);
        NotificationManager.success('Réglages du pool enregistrés');
    }
}

export default RoomController;