/**
 * Contrôleur pour la gestion des salles
 * @author Ibrahim Mrani - UCD
 */

import StateManager from './StateManager.js';
import Room from '../models/Room.js';
import LogService from '../services/LogService.js';
import DialogManager from '../ui/DialogManager.js';
import NotificationManager from '../ui/NotificationManager.js';
import { LISTE_JOURS } from '../config/constants.js';
import { getSortedCreneauxKeys } from '../utils/helpers.js';

class RoomController {
    /**
     * Ajoute une salle
     * @param {string} nom - Le nom de la salle
     * @param {string} type - Le type (Standard, Amphi, STP)
     * @returns {boolean} Succès de l'ajout
     */
    addRoom(nom, type = 'Standard') {
        if (!nom || nom.trim() === '') {
            DialogManager.error('Veuillez saisir un nom de salle valide.');
            return false;
        }

        const trimmedNom = nom.trim();

        if (StateManager.state.sallesInfo[trimmedNom]) {
            DialogManager.error(`La salle "${trimmedNom}" existe déjà.`);
            return false;
        }

        StateManager.state.sallesInfo[trimmedNom] = type;

        LogService.success(`✅ Salle "${trimmedNom}" (${type}) ajoutée`);
        NotificationManager.success('Salle ajoutée');
        StateManager.saveState();

        return true;
    }

    /**
     * Supprime une salle
     * @param {string} nom - Le nom de la salle
     */
    removeRoom(nom) {
        // Vérifier si la salle est utilisée
        const seances = StateManager.getSeances();
        const hasSeances = seances.some(s => s.salle === nom);

        if (hasSeances) {
            DialogManager.warning(
                `La salle <strong>${nom}</strong> est utilisée dans l'emploi du temps.<br><br>
                Voulez-vous vraiment la supprimer ?<br>
                <em>Les séances seront conservées mais sans cette salle.</em>`,
                () => {
                    this.performRemoveRoom(nom);
                }
            );
        } else {
            DialogManager.confirm(
                'Supprimer la Salle',
                `Voulez-vous vraiment supprimer <strong>${nom}</strong> ?`,
                () => {
                    this.performRemoveRoom(nom);
                }
            );
        }
    }

    /**
     * Effectue la suppression de la salle
     * @param {string} nom - Le nom de la salle
     */
    performRemoveRoom(nom) {
        // Retirer la salle des séances
        const seances = StateManager.getSeances();
        seances.forEach(seance => {
            if (seance.salle === nom) {
                seance.salle = '';
            }
        });

        // Supprimer la salle
        delete StateManager.state.sallesInfo[nom];

        LogService.success(`✅ Salle "${nom}" supprimée`);
        NotificationManager.success('Salle supprimée');
        StateManager.saveState();
    }

    /**
     * Met à jour le type d'une salle
     * @param {string} nom - Le nom de la salle
     * @param {string} newType - Le nouveau type
     * @returns {boolean} Succès de la mise à jour
     */
    updateRoomType(nom, newType) {
        if (!StateManager.state.sallesInfo[nom]) {
            DialogManager.error(`Salle "${nom}" introuvable.`);
            return false;
        }

        StateManager.state.sallesInfo[nom] = newType;

        LogService.success(`✅ Type de salle "${nom}" mis à jour : ${newType}`);
        NotificationManager.success('Type de salle mis à jour');
        StateManager.saveState();

        return true;
    }

    /**
     * Calcule le taux d'occupation d'une salle
     * @param {string} nom - Le nom de la salle
     * @returns {Object} { occupiedSlots, totalSlots, rate }
     */
    getRoomOccupancyRate(nom) {
        const seances = StateManager.getSeances().filter(s => s.salle === nom);
        const sortedCreneaux = getSortedCreneauxKeys();
        const totalSlots = LISTE_JOURS.length * sortedCreneaux.length;
        const occupiedSlots = seances.length;

        return {
            occupiedSlots,
            totalSlots,
            rate: Math.round((occupiedSlots / totalSlots) * 100)
        };
    }

    /**
     * Obtient l'emploi du temps d'une salle
     * @param {string} nom - Le nom de la salle
     * @returns {Object} EDT de la salle organisé par jour et créneau
     */
    getRoomSchedule(nom) {
        const seances = StateManager.getSeances().filter(s => s.salle === nom);
        const schedule = {};

        LISTE_JOURS.forEach(jour => {
            schedule[jour] = {};
            getSortedCreneauxKeys().forEach(creneau => {
                const seance = seances.find(s => s.jour === jour && s.creneau === creneau);
                schedule[jour][creneau] = seance || null;
            });
        });

        return schedule;
    }

    /**
     * Obtient les statistiques d'une salle
     * @param {string} nom - Le nom de la salle
     * @returns {Object} Les statistiques
     */
    getRoomStats(nom) {
        const seances = StateManager.getSeances().filter(s => s.salle === nom);
        const occupancy = this.getRoomOccupancyRate(nom);

        const stats = {
            totalSeances: seances.length,
            cours: seances.filter(s => s.type === 'Cours').length,
            td: seances.filter(s => s.type === 'TD').length,
            tp: seances.filter(s => s.type === 'TP').length,
            occupancy,
            filieres: [...new Set(seances.map(s => s.filiere))],
            matieres: [...new Set(seances.map(s => s.matiere))]
        };

        return stats;
    }

    /**
     * Obtient toutes les salles avec leurs statistiques
     * @returns {Array<Object>} Les salles avec stats
     */
    getAllRoomsWithStats() {
        return Object.keys(StateManager.state.sallesInfo).map(nom => {
            const type = StateManager.state.sallesInfo[nom];
            const stats = this.getRoomStats(nom);

            return {
                nom,
                type,
                stats
            };
        }).sort((a, b) => a.nom.localeCompare(b.nom));
    }

    /**
     * Trouve les salles libres à un créneau donné
     * @param {string} jour - Le jour
     * @param {string} creneau - Le créneau
     * @param {string} typeSeance - Le type de séance (optionnel, pour filtrer)
     * @returns {Array<Object>} Les salles libres avec leur type
     */
    getFreeRoomsAt(jour, creneau, typeSeance = null) {
        const seances = StateManager.getSeances();
        const occupiedRooms = seances
            .filter(s => s.jour === jour && s.creneau === creneau && s.salle)
            .map(s => s.salle);

        const allRooms = Object.keys(StateManager.state.sallesInfo);

        return allRooms
            .filter(nom => !occupiedRooms.includes(nom))
            .filter(nom => {
                if (!typeSeance) return true;
                const room = new Room(nom, StateManager.state.sallesInfo[nom]);
                return room.isCompatibleWith(typeSeance);
            })
            .map(nom => ({
                nom,
                type: StateManager.state.sallesInfo[nom]
            }))
            .sort((a, b) => a.nom.localeCompare(b.nom));
    }

    /**
     * Exporte les données d'une salle
     * @param {string} nom - Le nom de la salle
     * @returns {Object} Les données exportées
     */
    exportRoomData(nom) {
        const type = StateManager.state.sallesInfo[nom];
        const stats = this.getRoomStats(nom);
        const schedule = this.getRoomSchedule(nom);

        return {
            nom,
            type,
            stats,
            schedule
        };
    }
}

// Export d'une instance singleton
export default new RoomController();