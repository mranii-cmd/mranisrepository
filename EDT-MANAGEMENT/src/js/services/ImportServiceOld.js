/**
 * Service d'import de fichiers Excel (souhaits, matières)
 * @author Ibrahim Mrani - UCD
 */

import StateManager from '../controllers/StateManager.js';
import LogService from './LogService.js';
import { normalize } from '../utils/helpers.js';

class ImportService {
    /**
     * Importe les souhaits des enseignants depuis Excel
     * @param {File} file - Le fichier Excel
     * @returns {Promise<Object>} { success: boolean, stats: Object }
     */
    async importWishesFromExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    const result = this.parseWishesData(jsonData);

                    if (result.success) {
                        LogService.success(`✅ ${result.stats.imported} souhaits importés`);
                    }

                    resolve(result);
                } catch (error) {
                    LogService.error(`❌ Erreur lors de l'import: ${error.message}`);
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('File read error'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Parse les données de souhaits
     * @param {Array} data - Données du fichier
     * @returns {Object} { success: boolean, stats: Object }
     */
    parseWishesData(data) {
        const stats = {
            imported: 0,
            skipped: 0,
            errors: 0
        };

        // Format attendu : [Enseignant, Choix1, C1, TD1, TP1, Choix2, C2, TD2, TP2, Choix3, C3, TD3, TP3, Contraintes]
        
        for (let i = 1; i < data.length; i++) { // Skip header
            const row = data[i];

            if (!row || row.length < 2) {
                stats.skipped++;
                continue;
            }

            const enseignant = row[0];

            if (!enseignant || !StateManager.state.enseignants.includes(enseignant)) {
                stats.errors++;
                LogService.warning(`⚠️ Enseignant "${enseignant}" non trouvé`);
                continue;
            }

            const souhaits = {
                choix1: row[1] || '',
                c1: parseFloat(row[2]) || 0,
                td1: parseFloat(row[3]) || 0,
                tp1: parseFloat(row[4]) || 0,
                choix2: row[5] || '',
                c2: parseFloat(row[6]) || 0,
                td2: parseFloat(row[7]) || 0,
                tp2: parseFloat(row[8]) || 0,
                choix3: row[9] || '',
                c3: parseFloat(row[10]) || 0,
                td3: parseFloat(row[11]) || 0,
                tp3: parseFloat(row[12]) || 0,
                contraintes: row[13] || 'Aucune remarque.'
            };

            StateManager.state.enseignantSouhaits[enseignant] = souhaits;
            stats.imported++;
        }

        StateManager.saveState();

        return {
            success: true,
            stats
        };
    }

    /**
     * Importe les matières depuis Excel
     * @param {File} file - Le fichier Excel
     * @returns {Promise<Object>} { success: boolean, stats: Object }
     */
    async importSubjectsFromExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    const result = this.parseSubjectsData(jsonData);

                    if (result.success) {
                        LogService.success(`✅ ${result.stats.imported} matières importées`);
                    }

                    resolve(result);
                } catch (error) {
                    LogService.error(`❌ Erreur lors de l'import: ${error.message}`);
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('File read error'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Parse les données de matières
     * @param {Array} data - Données du fichier
     * @returns {Object} { success: boolean, stats: Object }
     */
    parseSubjectsData(data) {
        const stats = {
            imported: 0,
            updated: 0,
            skipped: 0
        };

        // Format attendu : [Matière, Filière, Sections, TD_Groups, TP_Groups, Vol_Cours, Vol_TD, Vol_TP, Nb_Ens_TP]
        
        for (let i = 1; i < data.length; i++) { // Skip header
            const row = data[i];

            if (!row || row.length < 2) {
                stats.skipped++;
                continue;
            }

            const matiere = row[0];
            const filiere = row[1] || '';
            const sections = parseInt(row[2]) || 0;
            const tdGroups = parseInt(row[3]) || 0;
            const tpGroups = parseInt(row[4]) || 0;
            const volCours = parseInt(row[5]) || 48;
            const volTD = parseInt(row[6]) || 32;
            const volTP = parseInt(row[7]) || 36;
            const nbEnsTP = parseInt(row[8]) || 1;

            const matiereData = {
                filiere,
                sections_cours: sections,
                td_groups: tdGroups,
                tp_groups: tpGroups,
                volumeHTP: {
                    Cours: volCours,
                    TD: volTD,
                    TP: volTP
                },
                nbEnseignantsTP: nbEnsTP
            };

            if (StateManager.state.matiereGroupes[matiere]) {
                // Mise à jour
                StateManager.state.matiereGroupes[matiere] = matiereData;
                stats.updated++;
            } else {
                // Création
                StateManager.addSubject(matiere, matiereData);
                stats.imported++;
            }
        }

        StateManager.saveState();

        return {
            success: true,
            stats
        };
    }

    /**
     * Exporte un template Excel pour les souhaits
     * @returns {boolean} Succès de l'export
     */
    exportWishesTemplate() {
        try {
            const data = [
                ['Enseignant', 'Choix 1', 'C1', 'TD1', 'TP1', 'Choix 2', 'C2', 'TD2', 'TP2', 'Choix 3', 'C3', 'TD3', 'TP3', 'Contraintes']
            ];

            // Ajouter une ligne exemple
            data.push(['Nom Enseignant', 'Matière 1', '1', '2', '0', 'Matière 2', '0', '1', '1', '', '0', '0', '0', 'Disponible le matin']);

            const worksheet = XLSX.utils.aoa_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Souhaits');

            XLSX.writeFile(workbook, 'template_souhaits.xlsx');

            return true;
        } catch (error) {
            console.error('Erreur export template:', error);
            return false;
        }
    }

    /**
     * Exporte un template Excel pour les matières
     * @returns {boolean} Succès de l'export
     */
    exportSubjectsTemplate() {
        try {
            const data = [
                ['Matière', 'Filière', 'Sections', 'TD_Groups', 'TP_Groups', 'Vol_Cours', 'Vol_TD', 'Vol_TP', 'Nb_Ens_TP']
            ];

            // Ajouter une ligne exemple
            data.push(['Mécanique Quantique', 'S5 P', '2', '4', '4', '48', '32', '36', '1']);

            const worksheet = XLSX.utils.aoa_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Matières');

            XLSX.writeFile(workbook, 'template_matieres.xlsx');

            return true;
        } catch (error) {
            console.error('Erreur export template:', error);
            return false;
        }
    }
}

// Export d'une instance singleton
export default new ImportService();