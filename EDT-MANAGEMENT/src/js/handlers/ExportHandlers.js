/**
 * Gestionnaire des exports de documents
 * @author Ibrahim Mrani - UCD
 */

import ExportService from '../services/ExportService.js';
import LogService from '../services/LogService.js';
import DialogManager from '../ui/DialogManager.js';
import SpinnerManager from '../ui/SpinnerManager.js';
import NotificationManager from '../ui/NotificationManager.js';
import TableRenderer from '../ui/TableRenderer.js';
import StateManager from '../controllers/StateManager.js';

class ExportHandlers {
    /**
     * Exporte l'EDT en PDF
     */
    async exportPDF() {
        const options = this.getPDFExportOptions();

        SpinnerManager.show();

        try {
            const success = await ExportService.exportToPDF(options);

            SpinnerManager.hide();

            if (success) {
                LogService.success('✅ Export PDF réussi');
                NotificationManager.success('PDF exporté avec succès');
            } else {
                LogService.error('❌ Échec de l\'export PDF');
                NotificationManager.error('Erreur lors de l\'export PDF');
            }
        } catch (error) {
            SpinnerManager.hide();
            LogService.error(`❌ Erreur export PDF : ${error.message}`);
            DialogManager.error(`Erreur : ${error.message}`);
        }
    }

    /**
     * Exporte l'EDT en Excel
     */
    async exportExcel() {
        const options = this.getExcelExportOptions();

        SpinnerManager.show();

        try {
            const success = await ExportService.exportToExcel(options);

            SpinnerManager.hide();

            if (success) {
                LogService.success('✅ Export Excel réussi');
                NotificationManager.success('Excel exporté avec succès');
            } else {
                LogService.error('❌ Échec de l\'export Excel');
                NotificationManager.error('Erreur lors de l\'export Excel');
            }
        } catch (error) {
            SpinnerManager.hide();
            LogService.error(`❌ Erreur export Excel : ${error.message}`);
            DialogManager.error(`Erreur : ${error.message}`);
        }
    }

    /**
     * Exporte les volumes horaires en Excel
     */
    async exportVolumes() {
        SpinnerManager.show();

        try {
            const success = await ExportService.exportVolumesToExcel();

            SpinnerManager.hide();

            if (success) {
                LogService.success('✅ Export volumes réussi');
                NotificationManager.success('Volumes exportés avec succès');
            } else {
                LogService.error('❌ Échec de l\'export volumes');
                NotificationManager.error('Erreur lors de l\'export');
            }
        } catch (error) {
            SpinnerManager.hide();
            LogService.error(`❌ Erreur export volumes : ${error.message}`);
            DialogManager.error(`Erreur : ${error.message}`);
        }
    }

    /**
     * Récupère les options d'export PDF
     * @returns {Object} Les options
     */
    getPDFExportOptions() {
        const currentFilter = TableRenderer.currentFilter;

        return {
            filter: currentFilter,
            orientation: document.getElementById('pdfOrientation')?.value || 'landscape',
            includeHeader: document.getElementById('pdfIncludeHeader')?.checked ?? true,
            includeStats: document.getElementById('pdfIncludeStats')?.checked ?? false
        };
    }

    /**
     * Récupère les options d'export Excel
     * @returns {Object} Les options
     */
    getExcelExportOptions() {
        const currentFilter = TableRenderer.currentFilter;

        return {
            filter: currentFilter,
            includeStats: document.getElementById('excelIncludeStats')?.checked ?? true
        };
    }

    /**
     * Affiche la modale d'options d'export PDF
     */
    showPDFExportDialog() {
        const html = `
            <div class="export-options">
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="pdfIncludeHeader" checked>
                        Inclure l'en-tête (année, session, département)
                    </label>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="pdfIncludeStats">
                        Inclure les statistiques
                    </label>
                </div>
                <div class="form-group">
                    <label for="pdfOrientation">Orientation :</label>
                    <select id="pdfOrientation">
                        <option value="landscape">Paysage (recommandé)</option>
                        <option value="portrait">Portrait</option>
                    </select>
                </div>
            </div>
        `;

        DialogManager.show({
            title: 'Options d\'Export PDF',
            htmlMessage: html,
            confirmText: 'Exporter',
            cancelText: 'Annuler',
            onConfirm: () => {
                this.exportPDF();
            }
        });
    }

    /**
     * Affiche la modale d'options d'export Excel
     */
    showExcelExportDialog() {
        const html = `
            <div class="export-options">
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="excelIncludeStats" checked>
                        Inclure une feuille de statistiques
                    </label>
                </div>
            </div>
        `;

        DialogManager.show({
            title: 'Options d\'Export Excel',
            htmlMessage: html,
            confirmText: 'Exporter',
            cancelText: 'Annuler',
            onConfirm: () => {
                this.exportExcel();
            }
        });
    }
    /**
 * Exporte les emplois du temps des enseignants en PDF
 */
    async exportTeachersSchedules() {
        const enseignants = StateManager.state.enseignants;

        if (enseignants.length === 0) {
            DialogManager.error('Aucun enseignant enregistré.');
            return;
        }

        DialogManager.confirm(
            'Export des Emplois du Temps des Enseignants',
            `Voulez-vous exporter les emplois du temps de <strong>${enseignants.length} enseignant(s)</strong> en PDF ?<br><br>
        Chaque enseignant aura une page dédiée avec :<br>
        - Son emploi du temps hebdomadaire<br>
        - Un tableau récapitulatif de ses interventions<br>
        - La liste de ses co-intervenants par matière<br><br>
        <em>Cette opération peut prendre quelques secondes...</em>`,
            async () => {
                SpinnerManager.show();

                try {
                    const success = await ExportService.exportTeachersSchedulesToPDF();

                    SpinnerManager.hide();

                    if (!success) {
                        DialogManager.error('Erreur lors de l\'export PDF.');
                    }
                } catch (error) {
                    SpinnerManager.hide();
                    LogService.error(`❌ Erreur : ${error.message}`);
                    DialogManager.error(`Erreur : ${error.message}`);
                }
            }
        );
    }

}

// Export d'une instance singleton
export default new ExportHandlers();