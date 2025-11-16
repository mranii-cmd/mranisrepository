/**
 * Service d'import de fichiers Excel (souhaits, matières)
 * @author Ibrahim Mrani - UCD
 */

import StateManager from '../controllers/StateManager.js';
import LogService from './LogService.js';
import DialogManager from '../ui/DialogManager.js';
import NotificationManager from '../ui/NotificationManager.js';
import SchedulingService from './SchedulingService.js'; // <-- ajouté

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
                        LogService.success(`✅ ${result.stats.imported} souhaits importés, ${result.stats.created} enseignants créés`);
                        NotificationManager.success(`${result.stats.imported} souhaits importés`, 5000);
                    }

                    resolve(result);
                } catch (error) {
                    LogService.error(`❌ Erreur lors de l'import: ${error.message}`);
                    NotificationManager.error('Erreur lors de l\'import');
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
            created: 0,
            skipped: 0,
            errors: 0
        };

        // Format attendu : [Enseignant, Choix1, C1, TD1, TP1, Choix2, C2, TD2, TP2, Choix3, C3, TD3, TP3, Contraintes]
        
        // Vérifier si la première ligne contient des en-têtes
        let startRow = 1;
        if (data.length > 0 && data[0][0]) {
            const firstCell = String(data[0][0]).toLowerCase();
            if (firstCell.includes('enseignant') || firstCell.includes('nom') || firstCell.includes('name')) {
                startRow = 1; // Ignorer la ligne d'en-tête
                LogService.info('En-tête détecté, démarrage à la ligne 2');
            }
        }

        for (let i = startRow; i < data.length; i++) {
            const row = data[i];

            // Ignorer les lignes vides
            if (!row || row.length < 2 || !row[0]) {
                stats.skipped++;
                continue;
            }

            let enseignant = String(row[0]).trim();

            // Vérifier si l'enseignant existe (recherche insensible à la casse et aux espaces)
            let enseignantTrouve = StateManager.state.enseignants.find(e => 
                e.toLowerCase().trim() === enseignant.toLowerCase().trim()
            );

            // Si l'enseignant n'existe pas, proposer de le créer automatiquement
            if (!enseignantTrouve) {
                LogService.warning(`⚠️ Enseignant "${enseignant}" non trouvé, création automatique...`);
                
                // Créer l'enseignant automatiquement
                StateManager.state.enseignants.push(enseignant);
                StateManager.state.enseignants.sort();
                enseignantTrouve = enseignant;
                stats.created++;
                
                LogService.success(`✅ Enseignant "${enseignant}" créé automatiquement`);
            }

            // Utiliser le nom exacte trouvé dans la liste (pour respecter la casse)
            const nomFinal = enseignantTrouve;

            const souhaits = {
                choix1: row[1] ? String(row[1]).trim() : '',
                c1: this.parseNumericValue(row[2]),
                td1: this.parseNumericValue(row[3]),
                tp1: this.parseNumericValue(row[4]),
                choix2: row[5] ? String(row[5]).trim() : '',
                c2: this.parseNumericValue(row[6]),
                td2: this.parseNumericValue(row[7]),
                tp2: this.parseNumericValue(row[8]),
                choix3: row[9] ? String(row[9]).trim() : '',
                c3: this.parseNumericValue(row[10]),
                td3: this.parseNumericValue(row[11]),
                tp3: this.parseNumericValue(row[12]),
                contraintes: row[13] ? String(row[13]).trim() : 'Aucune remarque.'
            };

            StateManager.state.enseignantSouhaits[nomFinal] = souhaits;
            stats.imported++;

            LogService.info(`📝 Souhaits importés pour ${nomFinal}`);
        }

        StateManager.saveState();

        return {
            success: true,
            stats
        };
    }

    /**
     * Parse une valeur numérique depuis Excel
     * @param {*} value - La valeur à parser
     * @returns {number} La valeur numérique (0 par défaut)
     */
    parseNumericValue(value) {
        if (value === null || value === undefined || value === '') {
            return 0;
        }
        
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    }

    /**
     * Importe les matières depuis Excel
     * @param {File} file - Le fichier Excel
     * @returns {Promise<Object>} { success: boolean, stats: Object }
     */
    async importSubjectsFromExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    const result = this.parseSubjectsData(jsonData);

                    if (result.success) {
                        LogService.success(`✅ ${result.stats.imported} matières importées, ${result.stats.updated} mises à jour`);
                        NotificationManager.success(`${result.stats.imported + result.stats.updated} matières traitées`, 5000);

                        // Si des matières ont été créées, lancer la génération automatique (sans enseignants/salles)
                        if (Array.isArray(result.createdSubjects) && result.createdSubjects.length > 0) {
                            for (const matiereNom of result.createdSubjects) {
                                try {
                                    const subject = StateManager.getSubjects().find(s => s.nom === matiereNom);
                                    if (subject) {
                                        await SchedulingService.autoGenerateSubjectSessions(subject, {
                                            assignTeachers: false,
                                            assignRooms: false,
                                            respectWishes: false,
                                            avoidConflicts: false
                                        });
                                    }
                                } catch (err) {
                                    LogService.warning(`Échec génération auto pour ${matiereNom}: ${err.message}`);
                                }
                            }
                            StateManager.saveState();
                        }
                    }

                    resolve(result);
                } catch (error) {
                    LogService.error(`❌ Erreur lors de l'import: ${error.message}`);
                    NotificationManager.error('Erreur lors de l\'import');
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
     * @returns {Object} { success: boolean, stats: Object, createdSubjects: Array<string> }
     */
    parseSubjectsData(data) {
        const stats = {
            imported: 0,
            updated: 0,
            skipped: 0,
            createdSubjects: []
        };

        // Format attendu (nouveau template) : 
        // [Matière, Filière, Département, Sections, TD_Groups, TP_Groups, Vol_Cours, Vol_TD, Vol_TP, Nb_Ens_TP]
        //
        // Le parser est tolérant : s'il trouve une ligne d'en-têtes, il mappe les colonnes
        // par nom (insensible à la casse / accents). Si aucune en-tête n'est détectée,
        // il conserve le comportement rétro-compatible (ancien format sans colonne 'Département').
        let startRow = 0;
        let headers = [];
        if (data.length > 0 && Array.isArray(data[0])) {
            headers = data[0].map(h => (h || '').toString().trim().toLowerCase());
            const firstCell = headers[0] || '';
            if (firstCell.includes('mati') || firstCell.includes('subject') || firstCell.includes('nom')) {
                // Probablement une ligne d'en-tête
                startRow = 1;
                LogService.info('En-tête détecté dans le fichier matières, utilisation du mapping par colonnes');
            } else {
                // Pas d'en-tête : lecture à partir de la première ligne (index 0)
                startRow = 0;
                headers = []; // indiquer qu'il n'y a pas d'en-têtes
            }
        }

        // Helper pour trouver un index d'entête par jeu de clés (tolérance casse/accents)
        const findIdx = (candidates) => {
            if (!headers || headers.length === 0) return -1;
            const normalized = headers.map(h => h.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
            for (let i = 0; i < normalized.length; i++) {
                const h = normalized[i];
                if (candidates.some(c => h.includes(c))) return i;
            }
            return -1;
        };

        // Si on a des en-têtes, déterminer index des colonnes
        let idx = {};
        if (headers.length > 0) {
            idx.matiere = findIdx(['mati', 'subject', 'nom']);
            idx.filiere = findIdx(['filiere', 'filier', 'filière']);
            idx.departement = findIdx(['depart', 'départ', 'department']);
            idx.sections = findIdx(['section']);
            idx.tdGroups = findIdx(['td', 'td_group', 'td groups']);
            idx.tpGroups = findIdx(['tp', 'tp_group', 'tp groups']);
            idx.volCours = findIdx(['vol_cours', 'cours', 'volcours', 'vol cours']);
            idx.volTD = findIdx(['vol_td', 'vol td', 'voltd']);
            idx.volTP = findIdx(['vol_tp', 'vol tp', 'voltp']);
            idx.nbEnsTP = findIdx(['nb', 'nb_ens', 'nbens', 'nb_ens_tp', 'nbens_tp']);
        }

        for (let i = startRow; i < data.length; i++) {
            const row = data[i];

            if (!row || row.length < 1 || !row[0]) {
                stats.skipped++;
                continue;
            }

            // Lecture tolérante : si on a des headers, utiliser les index calculés,
            // sinon, utiliser l'ancien schéma d'indexes (legacy)
            let matiere, filiere, departement;
            let sections, tdGroups, tpGroups, volCours, volTD, volTP, nbEnsTP;

            if (headers.length > 0) {
                matiere = (idx.matiere >= 0 && row[idx.matiere] !== undefined) ? String(row[idx.matiere]).trim() : '';
                filiere = (idx.filiere >= 0 && row[idx.filiere] !== undefined) ? String(row[idx.filiere]).trim() : '';
                departement = (idx.departement >= 0 && row[idx.departement] !== undefined) ? String(row[idx.departement]).trim() : '';
                sections = (idx.sections >= 0 && row[idx.sections] !== undefined && String(row[idx.sections]).trim() !== '') ? parseInt(row[idx.sections]) : 1;
                tdGroups = (idx.tdGroups >= 0 && row[idx.tdGroups] !== undefined && String(row[idx.tdGroups]).trim() !== '') ? parseInt(row[idx.tdGroups]) : 0;
                tpGroups = (idx.tpGroups >= 0 && row[idx.tpGroups] !== undefined && String(row[idx.tpGroups]).trim() !== '') ? parseInt(row[idx.tpGroups]) : 0;
                volCours = (idx.volCours >= 0 && row[idx.volCours] !== undefined && String(row[idx.volCours]).trim() !== '') ? parseInt(row[idx.volCours]) : 48;
                volTD = (idx.volTD >= 0 && row[idx.volTD] !== undefined && String(row[idx.volTD]).trim() !== '') ? parseInt(row[idx.volTD]) : 32;
                volTP = (idx.volTP >= 0 && row[idx.volTP] !== undefined && String(row[idx.volTP]).trim() !== '') ? parseInt(row[idx.volTP]) : 36;
                nbEnsTP = (idx.nbEnsTP >= 0 && row[idx.nbEnsTP] !== undefined && String(row[idx.nbEnsTP]).trim() !== '') ? parseInt(row[idx.nbEnsTP]) : 1;
            } else {
                // Legacy format (no headers): assume old column order
                matiere = row[0] ? String(row[0]).trim() : '';
                filiere = row[1] ? String(row[1]).trim() : '';
                departement = ''; // not present in legacy format
                sections = (row[2] !== undefined && String(row[2]).trim() !== '') ? parseInt(row[2]) : 1;
                tdGroups = (row[3] !== undefined && String(row[3]).trim() !== '') ? parseInt(row[3]) : 0;
                tpGroups = (row[4] !== undefined && String(row[4]).trim() !== '') ? parseInt(row[4]) : 0;
                volCours = (row[5] !== undefined && String(row[5]).trim() !== '') ? parseInt(row[5]) : 48;
                volTD = (row[6] !== undefined && String(row[6]).trim() !== '') ? parseInt(row[6]) : 32;
                volTP = (row[7] !== undefined && String(row[7]).trim() !== '') ? parseInt(row[7]) : 36;
                nbEnsTP = (row[8] !== undefined && String(row[8]).trim() !== '') ? parseInt(row[8]) : 1;
            }

            // validation minimale
            if (!matiere) {
                stats.skipped++;
                continue;
            }

            const matiereData = {
                filiere,
                departement: departement || '',
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
                // Mise à jour (préserver éventuellement les champs existants)
                StateManager.state.matiereGroupes[matiere] = {
                    ...StateManager.state.matiereGroupes[matiere],
                    ...matiereData
                };
                stats.updated++;
                LogService.info(`📝 Matière "${matiere}" mise à jour`);
            } else {
                // Création (utilise la normalisation de StateManager.addSubject)
                StateManager.addSubject(matiere, matiereData);
                stats.imported++;
                stats.createdSubjects.push(matiere);
                LogService.info(`✅ Matière "${matiere}" créée`);
            }
        }

        StateManager.saveState();

        return {
            success: true,
            stats,
            createdSubjects: stats.createdSubjects
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

            // Ajouter tous les enseignants existants
            const enseignants = StateManager.state.enseignants;
            if (enseignants.length > 0) {
                enseignants.forEach(ens => {
                    const souhaits = StateManager.state.enseignantSouhaits[ens] || {};
                    data.push([
                        ens,
                        souhaits.choix1 || '',
                        souhaits.c1 || '',
                        souhaits.td1 || '',
                        souhaits.tp1 || '',
                        souhaits.choix2 || '',
                        souhaits.c2 || '',
                        souhaits.td2 || '',
                        souhaits.tp2 || '',
                        souhaits.choix3 || '',
                        souhaits.c3 || '',
                        souhaits.td3 || '',
                        souhaits.tp3 || '',
                        souhaits.contraintes || 'Aucune remarque.'
                    ]);
                });
            } else {
                // Ajouter une ligne exemple si aucun enseignant
                data.push([
                    'Dr. Ahmed Bennani',
                    'Mécanique Quantique',
                    '1',
                    '2',
                    '0',
                    'Thermodynamique',
                    '0',
                    '1',
                    '1',
                    '',
                    '0',
                    '0',
                    '0',
                    'Disponible le matin'
                ]);
            }

            const worksheet = XLSX.utils.aoa_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Souhaits');

            XLSX.writeFile(workbook, 'template_souhaits_enseignants.xlsx');

            LogService.success('✅ Template souhaits téléchargé');
            return true;
        } catch (error) {
            console.error('Erreur export template:', error);
            LogService.error(`❌ Erreur export template: ${error.message}`);
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
                // Nouveau template : ajout de la colonne "Département" après "Filière"
                ['Matière', 'Filière', 'Département', 'Sections', 'TD_Groups', 'TP_Groups', 'Vol_Cours', 'Vol_TD', 'Vol_TP', 'Nb_Ens_TP']
            ];

            // Ajouter toutes les matières existantes
            const matieres = Object.keys(StateManager.state.matiereGroupes);
            if (matieres.length > 0) {
                matieres.forEach(nom => {
                    const m = StateManager.state.matiereGroupes[nom];
                    data.push([
                        nom,
                        m.filiere || '',
                        m.departement || '',
                        m.sections_cours || 1,
                        m.td_groups || 0,
                        m.tp_groups || 0,
                        m.volumeHTP?.Cours || 48,
                        m.volumeHTP?.TD || 32,
                        m.volumeHTP?.TP || 36,
                        m.nbEnseignantsTP || 1
                    ]);
                });
            } else {
                // Ajouter une ligne exemple
                data.push(['Mécanique Quantique', 'S5 P', 'Département de Physique', '2', '4', '4', '48', '32', '36', '1']);
            }

            const worksheet = XLSX.utils.aoa_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Matières');

            XLSX.writeFile(workbook, 'template_matieres.xlsx');

            LogService.success('✅ Template matières téléchargé');
            return true;
        } catch (error) {
            console.error('Erreur export template:', error);
            LogService.error(`❌ Erreur export template: ${error.message}`);
            return false;
        }
    }
}

// Export d'une instance singleton
export default new ImportService();