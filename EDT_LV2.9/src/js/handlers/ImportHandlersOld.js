/**
 * Gestionnaire des imports de fichiers
 * @author Ibrahim Mrani - UCD
 */

import ImportService from '../services/ImportService.js';
import LogService from '../services/LogService.js';
import DialogManager from '../ui/DialogManager.js';
import SpinnerManager from '../ui/SpinnerManager.js';
import NotificationManager from '../ui/NotificationManager.js';

class ImportHandlers {
    /**
     * Importe les souhaits des enseignants
     * @param {File} file - Le fichier Excel
     */
    async importWishes(file) {
        if (!file) return;

        SpinnerManager.show();

        try {
            const result = await ImportService.importWishesFromExcel(file);

            SpinnerManager.hide();

            if (result.success) {
                const { imported, skipped, errors } = result.stats;
                
                DialogManager.success(
                    `✅ Import réussi !<br><br>
                    <strong>Résultats :</strong><br>
                    - Souhaits importés : ${imported}<br>
                    - Lignes ignorées : ${skipped}<br>
                    - Erreurs : ${errors}`
                );

                // Rafraîchir l'interface si nécessaire
                window.EDTApp?.populateFormSelects();
            } else {
                DialogManager.error('Erreur lors de l\'import des souhaits.');
            }
        } catch (error) {
            SpinnerManager.hide();
            LogService.error(`❌ Erreur import : ${error.message}`);
            DialogManager.error(`Erreur : ${error.message}`);
        }
    }

    /**
     * Importe les matières
     * @param {File} file - Le fichier Excel
     */
    async importSubjects(file) {
        if (!file) return;

        SpinnerManager.show();

        try {
            const result = await ImportService.importSubjectsFromExcel(file);

            SpinnerManager.hide();

            if (result.success) {
                const { imported, updated, skipped } = result.stats;
                
                DialogManager.success(
                    `✅ Import réussi !<br><br>
                    <strong>Résultats :</strong><br>
                    - Matières créées : ${imported}<br>
                    - Matières mises à jour : ${updated}<br>
                    - Lignes ignorées : ${skipped}`
                );

                // Rafraîchir l'interface
                window.EDTApp?.populateFormSelects();
                window.EDTApp?.renderAll();
            } else {
                DialogManager.error('Erreur lors de l\'import des matières.');
            }
        } catch (error) {
            SpinnerManager.hide();
            LogService.error(`❌ Erreur import : ${error.message}`);
            DialogManager.error(`Erreur : ${error.message}`);
        }
    }

    /**
     * Déclenche le sélecteur de fichier pour import souhaits
     */
    triggerWishesImport() {
        const input = document.getElementById('fileImportWishes');
        if (input) {
            input.click();
        }
    }

    /**
     * Déclenche le sélecteur de fichier pour import matières
     */
    triggerSubjectsImport() {
        const input = document.getElementById('fileImportSubjects');
        if (input) {
            input.click();
        }
    }

    /**
     * Télécharge le template Excel pour les souhaits
     */
    downloadWishesTemplate() {
        const success = ImportService.exportWishesTemplate();

        if (success) {
            NotificationManager.success('Template téléchargé');
            LogService.success('✅ Template souhaits téléchargé');
        } else {
            NotificationManager.error('Erreur lors du téléchargement');
            LogService.error('❌ Échec du téléchargement du template');
        }
    }

    /**
     * Télécharge le template Excel pour les matières
     */
    downloadSubjectsTemplate() {
        const success = ImportService.exportSubjectsTemplate();

        if (success) {
            NotificationManager.success('Template téléchargé');
            LogService.success('✅ Template matières téléchargé');
        } else {
            NotificationManager.error('Erreur lors du téléchargement');
            LogService.error('❌ Échec du téléchargement du template');
        }
    }
}

// Export d'une instance singleton
export default new ImportHandlers();