/**
 * Service d'export de documents (PDF, Excel)
 * @author Ibrahim Mrani - UCD
 */
import { LISTE_JOURS } from '../config/constants.js';
import { getSortedCreneauxKeys } from '../utils/helpers.js';
import DialogManager from '../ui/DialogManager.js';
import LogService from './LogService.js';
import NotificationManager from '../ui/NotificationManager.js';
import StateManager from '../controllers/StateManager.js';
import TableRenderer from '../ui/TableRenderer.js';
import VolumeService from './VolumeService.js';
import StorageService from './StorageService.js';
import { SEANCE_COLORS } from '../config/constants.js';
import { downloadFile } from '../utils/helpers.js';

class ExportService {
    /**
     * Exporte l'EDT en PDF
     * @param {Object} options - Options d'export
     * @returns {Promise<boolean>} Succès de l'export
     */
    async exportToPDF(options = {}) {
        const {
            filter = 'global',
            orientation = 'landscape',
            includeHeader = true,
            includeStats = false
        } = options;

        try {
            // Charger jsPDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation,
                unit: 'mm',
                format: 'a4'
            });

            let currentY = 10;

            // En-tête
            if (includeHeader) {
                // currentY = this.addPDFHeader(doc, currentY);
                currentY = this.addPDFHeader(doc, currentY, filter);
            }

            // Tableau EDT
            currentY = await this.addPDFTable(doc, currentY, filter);

            // Statistiques
            if (includeStats) {
                currentY = this.addPDFStats(doc, currentY);
            }

            // Sauvegarder
            const filename = this.generateFilename('edt', 'pdf');
            doc.save(filename);

            return true;
        } catch (error) {
            console.error('Erreur export PDF:', error);
            return false;
        }
    }

    /**
     * Ajoute l'en-tête au PDF
     * @param {Object} doc - Document jsPDF
     * @param {number} startY - Position Y de départ
     * @returns {number} Nouvelle position Y
     */
    addPDFHeader(doc, startY, selectedFiliere = null) {
        const { annee, session, departement } = StateManager.state.header;

        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('Emploi du Temps', 148, startY, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text(`${departement}`, 148, startY + 7, { align: 'center' });
        doc.text(`${annee} - ${session}`, 148, startY + 14, { align: 'center' });

        // Ajout du titre si le filtre est une filière
        if (
            selectedFiliere &&
            selectedFiliere !== 'global' &&
            selectedFiliere !== 'all'
        ) {
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(`Filière : ${selectedFiliere}`, 148, startY + 20, { align: 'center' });
            return startY + 30;
        }

        return startY + 25;
    }

    /**
     * Ajoute le tableau EDT au PDF
     * @param {Object} doc - Document jsPDF
     * @param {number} startY - Position Y de départ
     * @param {string} filter - Filtre appliqué
     * @returns {number} Nouvelle position Y
     */
    async addPDFTable(doc, startY, filter) {
        TableRenderer.setFilter(filter);
        const seances = TableRenderer.getFilteredSeances();
        const pdfData = TableRenderer.generatePDFData(seances);

        // Utiliser autoTable
        doc.autoTable({
            head: pdfData.head,
            body: pdfData.body.map(row => {
                return row.map(cell => {
                    if (Array.isArray(cell)) {
                        // C'est une cellule avec des séances
                        return cell.map(s =>
                            `${s.matiere} (${s.type})\n${s.groupe}\n${s.enseignant || 'N/A'}\n${s.salle || 'N/A'}`
                        ).join('\n---\n');
                    }
                    return cell;
                });
            }),
            startY: startY,
            theme: 'grid',
            styles: {
                fontSize: 7,
                cellPadding: 2,
                overflow: 'linebreak',
                halign: 'center',
                valign: 'middle'
            },
            headStyles: {
                fillColor: [41, 128, 185],
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { fontStyle: 'bold', fillColor: [236, 240, 241] }
            },
            didParseCell: (data) => {
                // Colorer les cellules selon le type de séance
                if (data.section === 'body' && data.column.index > 0) {
                    const cellValue = data.cell.text.join('');

                    if (cellValue.includes('(Cours)')) {
                        data.cell.styles.fillColor = SEANCE_COLORS.Cours.bg;
                    } else if (cellValue.includes('(TD)')) {
                        data.cell.styles.fillColor = SEANCE_COLORS.TD.bg;
                    } else if (cellValue.includes('(TP)')) {
                        data.cell.styles.fillColor = SEANCE_COLORS.TP.bg;
                    }
                }
            }
        });

        return doc.lastAutoTable.finalY + 10;
    }

    /**
     * Ajoute les statistiques au PDF
     * @param {Object} doc - Document jsPDF
     * @param {number} startY - Position Y de départ
     * @returns {number} Nouvelle position Y
     */
    addPDFStats(doc, startY) {
        const seances = StateManager.getSeances();
        const subjects = StateManager.getCurrentSessionSubjects();

        const globalMetrics = VolumeService.calculateGlobalVolumeMetrics(
            subjects,
            seances,
            StateManager.state.enseignants.length,
            StateManager.state.enseignantVolumesSupplementaires,
            StateManager.state.forfaits || []
        );

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Statistiques Globales', 10, startY);

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Nombre de séances : ${seances.length}`, 10, startY + 7);
        doc.text(`VHT Global : ${globalMetrics.globalVHT}h`, 10, startY + 14);
        doc.text(`VHM Global : ${globalMetrics.globalVHM}h`, 10, startY + 21);
        doc.text(`Enseignants actifs : ${globalMetrics.totalUniqueTeachers}/${globalMetrics.totalRegisteredTeachers}`, 10, startY + 28);

        return startY + 35;
    }

    /**
     * Exporte l'EDT en Excel
     * @param {Object} options - Options d'export
     * @returns {Promise<boolean>} Succès de l'export
     */
    async exportToExcel(options = {}) {
        const {
            filter = 'global',
            includeStats = false
        } = options;

        try {
            const workbook = XLSX.utils.book_new();

            // Feuille EDT
            TableRenderer.setFilter(filter);
            const seances = TableRenderer.getFilteredSeances();
            const htmlTable = TableRenderer.generateSimpleTableHTML(seances);

            // Convertir le HTML en worksheet
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlTable;
            const worksheet = XLSX.utils.table_to_sheet(tempDiv.querySelector('table'));

            XLSX.utils.book_append_sheet(workbook, worksheet, 'EDT');

            // Feuille Statistiques
            if (includeStats) {
                const statsSheet = this.generateStatsWorksheet();
                XLSX.utils.book_append_sheet(workbook, statsSheet, 'Statistiques');
            }

            // Sauvegarder
            const filename = this.generateFilename('edt', 'xlsx');
            XLSX.writeFile(workbook, filename);

            return true;
        } catch (error) {
            console.error('Erreur export Excel:', error);
            return false;
        }
    }

    /**
     * Génère la feuille de statistiques
     * @returns {Object} Worksheet XLSX
     */
    generateStatsWorksheet() {
        const seances = StateManager.getSeances();
        const subjects = StateManager.getCurrentSessionSubjects();

        const data = [
            ['Statistiques Globales'],
            [''],
            ['Métrique', 'Valeur'],
            ['Nombre de séances', seances.length],
            ['Nombre de matières', subjects.length],
            ['Nombre d\'enseignants', StateManager.state.enseignants.length],
            [''],
            ['Répartition par Type'],
            ['Type', 'Nombre'],
            ['Cours', seances.filter(s => s.type === 'Cours').length],
            ['TD', seances.filter(s => s.type === 'TD').length],
            ['TP', seances.filter(s => s.type === 'TP').length]
        ];

        return XLSX.utils.aoa_to_sheet(data);
    }

    /**
     * Exporte les volumes horaires en Excel
     * @returns {Promise<boolean>} Succès de l'export
     */
    async exportVolumesToExcel() {
        try {
            const workbook = XLSX.utils.book_new();

            // Calculer les volumes
            const seances = StateManager.getSeances();
            const enseignants = StateManager.state.enseignants;

            const volumes = VolumeService.calculateAllVolumes(
                enseignants,
                seances,
                StateManager.state.enseignantVolumesSupplementaires,
                StateManager.state.header.session,
                StateManager.state.volumesAutomne
            );

            // Préparer les données
            const data = [
                ['Volumes Horaires par Enseignant'],
                [''],
                ['Enseignant', 'Volume (hTP)']
            ];

            enseignants.forEach(ens => {
                data.push([ens, volumes[ens] || 0]);
            });

            const worksheet = XLSX.utils.aoa_to_sheet(data);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Volumes');

            // Sauvegarder
            const filename = this.generateFilename('volumes', 'xlsx');
            XLSX.writeFile(workbook, filename);

            return true;
        } catch (error) {
            console.error('Erreur export volumes:', error);
            return false;
        }
    }

    /**
     * Génère un nom de fichier
     * @param {string} prefix - Préfixe du fichier
     * @param {string} extension - Extension
     * @returns {string} Le nom de fichier
     */
    generateFilename(prefix, extension) {
        const { session } = StateManager.state.header;
        const date = new Date().toISOString().slice(0, 10);
        const sessionSlug = session.replace(/\s+/g, '_').toLowerCase();

        return `${prefix}_${sessionSlug}_${date}.${extension}`;
    }
    /**
 * Exporte les emplois du temps de tous les enseignants en PDF
 * @returns {Promise<boolean>} Succès de l'export
 */
    async exportTeachersSchedulesToPDF() {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const enseignants = StateManager.state.enseignants;
            const seances = StateManager.getSeances();

            if (enseignants.length === 0) {
                DialogManager.error('Aucun enseignant enregistré.');
                return false;
            }

            let isFirstPage = true;

            for (const enseignant of enseignants) {
                if (!isFirstPage) {
                    doc.addPage();
                }
                isFirstPage = false;

                // Générer l'emploi du temps pour cet enseignant
                await this.generateTeacherSchedulePage(doc, enseignant, seances);
            }

            // Sauvegarder
            const filename = `edt_enseignants_${new Date().toISOString().slice(0, 10)}.pdf`;
            doc.save(filename);

            LogService.success(`✅ Export PDF de ${enseignants.length} emploi(s) du temps réussi`);
            NotificationManager.success(`${enseignants.length} emploi(s) du temps exporté(s)`);

            return true;
        } catch (error) {
            console.error('Erreur export PDF enseignants:', error);
            LogService.error(`❌ Erreur export PDF: ${error.message}`);
            NotificationManager.error('Erreur lors de l\'export PDF');
            return false;
        }
    }

    /**
     * Génère une page PDF pour un enseignant
     * @param {Object} doc - Document jsPDF
     * @param {string} enseignant - Le nom de l'enseignant
     * @param {Array} allSeances - Toutes les séances
     */
    async generateTeacherSchedulePage(doc, enseignant, allSeances) {
        const { annee, session, departement } = StateManager.state.header;

        // Filtrer les séances de cet enseignant
        const seancesEnseignant = allSeances.filter(s => s.hasTeacherAssigned(enseignant));

        // En-tête
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text(`Emploi du Temps - ${enseignant}`, 148, 15, { align: 'center' });

        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        doc.text(`${departement} | ${annee} | ${session}`, 148, 22, { align: 'center' });

        // Informations de volume horaire
        let currentY = 30;
        currentY = this.addTeacherVolumeInfo(doc, enseignant, allSeances, currentY);

        // Tableau récapitulatif des interventions
        currentY += 5;
        currentY = this.addTeacherInterventionsTable(doc, enseignant, seancesEnseignant, currentY);

        // Emploi du temps détaillé
        currentY += 5;
        this.addTeacherScheduleTable(doc, seancesEnseignant, currentY);
    }

    /**
 * Ajoute les informations de volume horaire de l'enseignant
 * @param {Object} doc - Document jsPDF
 * @param {string} enseignant - Le nom de l'enseignant
 * @param {Array} allSeances - Toutes les séances
 * @param {number} startY - Position Y de départ
 * @returns {number} Nouvelle position Y
 */
    addTeacherVolumeInfo(doc, enseignant, allSeances, startY) {
        // Données d'état
        const enseignants = StateManager.state.enseignants || [];
        const forfaits = StateManager.state.forfaits || [];
        const volumesSupplementaires = StateManager.state.enseignantVolumesSupplementaires || {};
        const volumesAutomne = StateManager.state.volumesAutomne || {};

        // Détails individuels (séances passées en param)
        const volumeDetails = VolumeService.calculateTeacherVolumeDetails(
            enseignant,
            allSeances,
            volumesSupplementaires
        );

        // --- Reprendre la logique de VolumeRenderer.computeAnnualMetrics pour obtenir annualVHT ---
        const allSubjects = (typeof StateManager.getSubjects === 'function') ? StateManager.getSubjects() : (StateManager.getCurrentSessionSubjects ? StateManager.getCurrentSessionSubjects() : []);
        const filieres = StateManager.state.filieres || [];

        const getSubjectsForSession = (sessionLabel) => {
            const sessionType = (sessionLabel === 'autumn' ? 'Automne' : 'Printemps');
            const filieresNames = filieres
                .filter(f => f.session === sessionType)
                .map(f => f.nom);
            return allSubjects.filter(s => !s.filiere || filieresNames.includes(s.filiere));
        };

        const autumnSubjects = getSubjectsForSession('autumn');
        const springSubjects = getSubjectsForSession('spring');

        // Charger les séances depuis StorageService si disponible (même logique que VolumeRenderer)
        let autumnSessionData = { seances: [], nextId: 1 };
        let springSessionData = { seances: [], nextId: 1 };
        try {
            if (typeof StorageService !== 'undefined' && StorageService && typeof StorageService.loadSessionData === 'function') {
                autumnSessionData = StorageService.loadSessionData("Session d'automne") || autumnSessionData;
                springSessionData = StorageService.loadSessionData("Session de printemps") || springSessionData;
            } else if (typeof window !== 'undefined' && window.EDTStorage && typeof window.EDTStorage.loadSessionData === 'function') {
                autumnSessionData = window.EDTStorage.loadSessionData("Session d'automne") || autumnSessionData;
                springSessionData = window.EDTStorage.loadSessionData("Session de printemps") || springSessionData;
            }
        } catch (e) {
            // fallback silencieux : utiliser allSeances en dessous si nécessaire
            console.warn('ExportService: StorageService.loadSessionData unavailable, using fallbacks', e);
        }

        // Forfaits par session (même logique que VolumeRenderer)
        const allForfaits = StateManager.state.forfaits || [];
        const forfaitsAutumn = allForfaits.filter(f => !f.session || String(f.session).toLowerCase().includes('automne') || String(f.session).toLowerCase().includes('autumn'));
        const forfaitsSpring = allForfaits.filter(f => String(f.session).toLowerCase().includes('printemps') || String(f.session).toLowerCase().includes('spring'));

        // --- Appel à calculateAnnualGlobalMetrics pour obtenir annualVHT (source de vérité) ---
        let annualMetrics = {};
        try {
            annualMetrics = VolumeService.calculateAnnualGlobalMetrics(
                enseignants,
                autumnSubjects,
                autumnSessionData.seances || [],
                springSubjects,
                springSessionData.seances || [],
                volumesSupplementaires,
                forfaitsAutumn,
                forfaitsSpring
            ) || {};
        } catch (err) {
            console.error('ExportService: erreur calculateAnnualGlobalMetrics', err);
            annualMetrics = {};
        }

        // annualVHT = somme déclarative annuelle (Automne + Printemps)
        const annualVHT = Number(annualMetrics.annualVHT || 0);

        // nombre d'enseignants à utiliser comme dénominateur (fallback sur StateManager)
        const totalRegisteredTeachers = Number(annualMetrics.totalRegisteredTeachers || (StateManager.state.enseignants || []).length || 1);

        // --- CALCUL DEMANDÉ : VHM = VHT / Nombre enseignants ---
        const VHM_calculated = totalRegisteredTeachers > 0 ? Math.round(annualVHT / totalRegisteredTeachers) : 0;

        // Préparer affichage conditionnel selon la session
        const currentSession = (StateManager.state && StateManager.state.header && StateManager.state.header.session) || '';

        // --- NEW: Si session = printemps, afficher le "Total (hTP)" tel que dans le menu Volume ---
        try {
            const seancesForMenu = (typeof StateManager.getSeances === 'function') ? StateManager.getSeances() : (allSeances || []);

            // allVolumesCurrent (calcule selon session courante)
            let allVolumesCurrent = {};
            try {
                allVolumesCurrent = VolumeService.calculateAllVolumes(
                    enseignants,
                    seancesForMenu,
                    volumesSupplementaires,
                    currentSession,
                    volumesAutomne
                ) || {};
            } catch (e) {
                console.warn('ExportService: erreur calculateAllVolumes (current)', e);
                allVolumesCurrent = {};
            }

            // autumnPerTeacher : nécessaire pour l'affichage en printemps
            let autumnPerTeacher = {};
            try {
                let autumnSeances = [];
                if (typeof StorageService !== 'undefined' && StorageService && typeof StorageService.loadSessionData === 'function') {
                    autumnSeances = (StorageService.loadSessionData("Session d'automne") || {}).seances || [];
                } else if (typeof StateManager.getSeancesBySession === 'function') {
                    autumnSeances = StateManager.getSeancesBySession("Session d'automne") || [];
                } else {
                    const allFromState = (typeof StateManager.getSeances === 'function') ? StateManager.getSeances() : (allSeances || []);
                    autumnSeances = allFromState.filter(s => s && s.session && String(s.session).toLowerCase().includes('automne'));
                }

                autumnPerTeacher = VolumeService.calculateAllVolumes(
                    enseignants,
                    autumnSeances,
                    volumesSupplementaires,
                    "Session d'automne",
                    {}
                ) || {};
            } catch (e) {
                console.warn('ExportService: erreur calculateAllVolumes (autumn)', e);
                autumnPerTeacher = {};
            }

            const baseCurrent = Number(allVolumesCurrent[enseignant] || 0);
            const addAutumn = (String(currentSession).toLowerCase().includes('printemps')) ? Number(autumnPerTeacher[enseignant] || 0) : 0;
            const menuTotal = Math.round(baseCurrent + addAutumn);

            if (String(currentSession).toLowerCase().includes('printemps')) {
                // afficher uniquement le Total (hTP) - identique au menu "Volumes"
                // afficher le Total (hTP) - identique au menu "Volumes" et ajouter VHM annuel
                const ecart = menuTotal - VHM_calculated;
                let ecartText = '';
                if (ecart > 0) ecartText = ` (+${ecart}h)`;
                else if (ecart < 0) ecartText = ` (${ecart}h)`;

                const totalAndVHMText = `Total (hTP): ${menuTotal}hTP | VHM Annuel: ${VHM_calculated}hTP${ecartText}`;
                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.setFont(undefined, 'normal');
                doc.text(totalAndVHMText, 14, startY);

                // debug
             

                return startY + 3;
            }
        } catch (e) {
            console.warn('ExportService: erreur dans calcul affichage spécial printemps, fallback normal', e);
        }

        // --- Sinon : affichage classique (Automne / autres) ---
        const volumeEnseignement = volumeDetails.enseignement || 0;
        const volumeForfait = forfaits
            .filter(f => String(f.enseignant || '').trim() === String(enseignant || '').trim())
            .reduce((sum, f) => sum + (Number(f.volumeHoraire) || 0), 0);
        const volumeTotal = volumeEnseignement + volumeForfait;

        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');

        // Comparer le total personnel à la moyenne calculée
        const ecart = volumeTotal - VHM_calculated;
        let ecartText = '';
        if (ecart > 0) ecartText = ` (+${ecart}h)`;
        else if (ecart < 0) ecartText = ` (${ecart}h)`;

        const volumeText = `Vol. Enseignement: ${volumeEnseignement}hTP | Vol. Forfait: ${volumeForfait}hTP | Vol. Total: ${volumeTotal}hTP | VHM: ${VHM_calculated}hTP${ecartText}`;

        doc.setFont(undefined, 'normal');
        doc.text(volumeText, 14, startY);

        // Debug utile
        console.debug('ExportService:addTeacherVolumeInfo', {
            enseignant,
            annualVHT,
            totalRegisteredTeachers,
            VHM_calculated,
            volumeEnseignement,
            volumeForfait,
            volumeTotal,
            annualMetrics
        });

        return startY + 3;
    }

    /**
 * Ajoute le tableau récapitulatif des interventions
 * @param {Object} doc - Document jsPDF
 * @param {string} enseignant - Le nom de l'enseignant
 * @param {Array} seances - Les séances de l'enseignant
 * @param {number} startY - Position Y de départ
 * @returns {number} Nouvelle position Y
 */
    addTeacherInterventionsTable(doc, enseignant, seances, startY) {
        const toutesLesSeances = StateManager.getSeances();
        const matieresEnseignant = [...new Set(seances.map(s => s.matiere))];

        const interventionsParMatiere = {};

        matieresEnseignant.forEach(matiere => {
            interventionsParMatiere[matiere] = {
                cours: new Set(),
                td: new Set(),
                tp: new Set()
            };

            toutesLesSeances
                .filter(s => s.matiere === matiere)
                .forEach(seance => {
                    const type = seance.type.toLowerCase();
                    const intervenants = interventionsParMatiere[matiere][type];

                    seance.enseignantsArray.forEach(ens => {
                        if (ens && ens.trim()) {
                            intervenants.add(ens.trim());
                        }
                    });
                });
        });

        const formatIntervenants = (set) => {
            if (set.size === 0) return '-';

            // Retirer l'enseignant concerné de la liste
            const liste = Array.from(set)
                .filter(ens => ens !== enseignant)
                .sort();

            return liste.length > 0 ? liste.join(', ') : '-';
        };

        const tableData = [];
        Object.keys(interventionsParMatiere).sort().forEach(matiere => {
            const interv = interventionsParMatiere[matiere];

            tableData.push([
                matiere,
                formatIntervenants(interv.cours),
                formatIntervenants(interv.td),
                formatIntervenants(interv.tp)
            ]);
        });

        if (tableData.length === 0) {
            tableData.push(['Aucune matiere assignee', '-', '-', '-']);
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Recapitulatif des Interventions par Matiere', 14, startY);

        doc.autoTable({
            head: [['Matiere', 'Intervenants Cours', 'Intervenants TD', 'Intervenants TP']],
            body: tableData,
            startY: startY + 5,
            theme: 'grid',
            styles: {
                font: 'helvetica',
                fontSize: 9,
                cellPadding: 3,
                overflow: 'linebreak'
            },
            headStyles: {
                fillColor: [102, 126, 234],
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { cellWidth: 60, fontStyle: 'bold' },
                1: { cellWidth: 60 },
                2: { cellWidth: 60 },
                3: { cellWidth: 60 }
            },
            margin: { left: 14, right: 14 }
        });

        return doc.lastAutoTable.finalY;
    }

    /**
     * Ajoute le tableau de l'emploi du temps
     * @param {Object} doc - Document jsPDF
     * @param {Array} seances - Les séances de l'enseignant
     * @param {number} startY - Position Y de départ
     */
    addTeacherScheduleTable(doc, seances, startY) {
        const sortedCreneaux = getSortedCreneauxKeys();
        const creneauxData = StateManager.state.creneaux;
        const jours = LISTE_JOURS;

        // En-tête
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('Emploi du Temps Hebdomadaire', 14, startY);

        // Préparer les données
        const head = [['Jour/Heure', ...sortedCreneaux.map(c => `${c}\n${creneauxData[c].fin}`)]];
        const body = [];

        jours.forEach(jour => {
            const row = [jour];

            sortedCreneaux.forEach(creneau => {
                const seance = seances.find(s => s.jour === jour && s.creneau === creneau);

                if (seance) {
                    const text = `${seance.matiere}\n(${seance.type})\n${seance.groupe}\n${seance.salle || 'N/A'}`;
                    row.push(text);
                } else {
                    row.push('');
                }
            });

            body.push(row);
        });

        // Générer le tableau
        doc.autoTable({
            head: head,
            body: body,
            startY: startY + 5,
            theme: 'grid',
            styles: {
                fontSize: 7,
                cellPadding: 2,
                overflow: 'linebreak',
                halign: 'center',
                valign: 'middle'
            },
            headStyles: {
                fillColor: [102, 126, 234],
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center'
            },
            columnStyles: {
                0: { fontStyle: 'bold', fillColor: [236, 240, 241], cellWidth: 25 }
            },
            margin: { left: 14, right: 14 },
            didParseCell: (data) => {
                // Colorer les cellules selon le type
                if (data.section === 'body' && data.column.index > 0) {
                    const cellValue = data.cell.text.join('');

                    if (cellValue.includes('(Cours)')) {
                        data.cell.styles.fillColor = [255, 221, 221];
                    } else if (cellValue.includes('(TD)')) {
                        data.cell.styles.fillColor = [221, 255, 221];
                    } else if (cellValue.includes('(TP)')) {
                        data.cell.styles.fillColor = [221, 221, 255];
                    }
                }
            }
        });
    }
    /**
 * Nettoie le texte pour l'export PDF (retire les accents et caractères spéciaux)
 * @param {string} text - Le texte à nettoyer
 * @returns {string} Texte nettoyé
 */
    cleanTextForPDF(text) {
        if (!text) return '';

        // Remplacer les caractères accentués
        const accentsMap = {
            'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
            'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
            'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
            'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
            'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
            'ý': 'y', 'ÿ': 'y',
            'ñ': 'n', 'ç': 'c',
            'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A',
            'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
            'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I',
            'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O',
            'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U',
            'Ý': 'Y', 'Ÿ': 'Y',
            'Ñ': 'N', 'Ç': 'C'
        };

        return text.split('').map(char => accentsMap[char] || char).join('');
    }
}

// Export d'une instance singleton
export default new ExportService();