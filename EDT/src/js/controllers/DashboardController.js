/**
 * Contrôleur pour le tableau de bord analytique
 * @author Ibrahim Mrani - UCD
 */

import AnalyticsService from '../services/AnalyticsService.js';
import StateManager from './StateManager.js';
import LogService from '../services/LogService.js';

class DashboardController {
    constructor() {
        this.currentFilter = 'all';
        this.dashboardData = null;
    }

    /**
     * Initialise le dashboard
     */
    init() {
        this.refreshData();
        
        // S'abonner aux changements de state pour auto-refresh
        StateManager.subscribe('seance:added', () => this.refreshData());
        StateManager.subscribe('seance:removed', () => this.refreshData());
        StateManager.subscribe('seance:updated', () => this.refreshData());
        StateManager.subscribe('session:changed', () => this.refreshData());
        
        LogService.info('📊 Dashboard initialisé');
    }

    /**
     * Actualise les données du dashboard
     */
    refreshData() {
        try {
            this.dashboardData = {
                kpis: AnalyticsService.calculateGlobalKPIs(),
                teachersWorkload: AnalyticsService.calculateTeachersWorkload(),
                sessionsDistribution: AnalyticsService.calculateSessionsDistribution(),
                timeSlotsHeatmap: AnalyticsService.calculateTimeSlotsHeatmap(),
                roomsOccupancy: AnalyticsService.calculateRoomsOccupancy(),
                weeklyTimeline: AnalyticsService.calculateWeeklyTimeline(),
                alerts: AnalyticsService.detectAnomalies(),
                subjectStats: AnalyticsService.calculateSubjectStats()
            };
            
            LogService.success('✅ Données du dashboard actualisées');
            
            // Notifier les listeners
            StateManager.notify('dashboard:refreshed', this.dashboardData);
            
        } catch (error) {
            LogService.error(`❌ Erreur lors de l'actualisation du dashboard: ${error.message}`);
        }
    }

    /**
     * Applique des filtres aux données
     * @param {Object} filters - Les filtres à appliquer
     */
    applyFilters(filters) {
        this.currentFilter = filters.period || 'all';
        
        // TODO: Implémenter la logique de filtrage
        // Pour l'instant, on rafraîchit juste les données
        this.refreshData();
    }

    /**
     * Récupère les données du dashboard
     * @returns {Object} Les données
     */
    getDashboardData() {
        if (!this.dashboardData) {
            this.refreshData();
        }
        return this.dashboardData;
    }

    /**
     * Exporte le dashboard
     * @param {string} format - Le format (pdf, excel, image)
     */
    async exportDashboard(format) {
        LogService.info(`📥 Export du dashboard en ${format}...`);
        
        try {
            switch (format) {
                case 'pdf':
                    await this.exportToPDF();
                    break;
                case 'excel':
                    await this.exportToExcel();
                    break;
                case 'image':
                    await this.exportToImage();
                    break;
                default:
                    throw new Error('Format non supporté');
            }
            
            LogService.success(`✅ Export ${format} terminé`);
        } catch (error) {
            LogService.error(`❌ Erreur export: ${error.message}`);
        }
    }

    /**
     * Exporte en PDF
     */
    async exportToPDF() {
        // TODO: Implémenter l'export PDF avec jsPDF
        LogService.info('Export PDF - En développement');
    }

    /**
     * Exporte en Excel
     */
    async exportToExcel() {
        const XLSX = window.XLSX;
        if (!XLSX) {
            throw new Error('XLSX library not loaded');
        }

        const wb = XLSX.utils.book_new();
        const data = this.getDashboardData();

        // Feuille 1: KPIs
        const kpisData = [
            ['Indicateur', 'Valeur'],
            ['Séances totales', data.kpis.totalSeances],
            ['Taux attribution enseignants', `${data.kpis.teacherAssignmentRate}%`],
            ['Taux attribution salles', `${data.kpis.roomAssignmentRate}%`],
            ['Enseignants actifs', `${data.kpis.activeTeachers}/${data.kpis.totalTeachers}`],
            ['Salles utilisées', `${data.kpis.usedRooms}/${data.kpis.totalRooms}`],
            ['Taux occupation global', `${data.kpis.globalOccupancyRate}%`]
        ];
        const ws1 = XLSX.utils.aoa_to_sheet(kpisData);
        XLSX.utils.book_append_sheet(wb, ws1, 'KPIs');

        // Feuille 2: Charge enseignants
        const teachersData = [
            ['Enseignant', 'Volume (hTP)', 'Statut']
        ];
        data.teachersWorkload.forEach(t => {
            teachersData.push([t.nom, t.volume, t.status]);
        });
        const ws2 = XLSX.utils.aoa_to_sheet(teachersData);
        XLSX.utils.book_append_sheet(wb, ws2, 'Enseignants');

        // Feuille 3: Occupation salles
        const roomsData = [
            ['Salle', 'Taux occupation (%)', 'Séances']
        ];
        data.roomsOccupancy.forEach(r => {
            roomsData.push([r.salle, r.occupancyRate, r.totalSeances]);
        });
        const ws3 = XLSX.utils.aoa_to_sheet(roomsData);
        XLSX.utils.book_append_sheet(wb, ws3, 'Salles');

        // Télécharger
        const filename = `Dashboard_${StateManager.state.header.session}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
    }

    /**
     * Exporte en image
     */
    async exportToImage() {
        // TODO: Implémenter l'export image avec html2canvas
        LogService.info('Export Image - En développement');
    }

    /**
     * Obtient les recommandations basées sur les alertes
     * @returns {Array} Liste de recommandations
     */
    getRecommendations() {
        const alerts = this.dashboardData?.alerts || [];
        return alerts.map(alert => ({
            priority: alert.type === 'danger' ? 'high' : alert.type === 'warning' ? 'medium' : 'low',
            message: alert.message,
            action: alert.action
        }));
    }
}

// Export d'une instance singleton
export default new DashboardController();