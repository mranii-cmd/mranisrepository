/**
 * Renderer pour le tableau de bord analytique avec graphiques Chart.js
 * @author Ibrahim Mrani - UCD
 */

import DashboardController from '../controllers/DashboardController.js';
import { safeText } from '../utils/sanitizers.js';
import StateManager from '../controllers/StateManager.js';
import SchedulingService from '../services/SchedulingService.js';
import { escapeHTML } from '../utils/sanitizers.js';

class DashboardRenderer {
    constructor() {
        this.container = null;
        this.charts = {}; // Stockage des instances Chart.js
    }

    /**
     * Initialise le renderer
     * @param {string} containerId - L'ID du conteneur
     */
    init(containerId = 'dashboardContainer') {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.warn(`Container #${containerId} not found`);
        }
    }

    /**
     * Rend le dashboard complet
     */
    render() {
        if (!this.container) return;

        const data = DashboardController.getDashboardData();

        if (!data) {
            this.container.innerHTML = '<p class="empty-message">Aucune donnée disponible</p>';
            return;
        }

        const html = `
            <div class="dashboard-container">
                ${this.renderHeader()}
                ${this.renderKPIs(data.kpis)}
                ${this.renderAlerts(data.alerts)}
                ${this.renderCharts(data)}
                ${this.renderSubjectStats(data.subjectStats)}
            </div>
        `;

        this.container.innerHTML = html;

        // Initialiser les graphiques Chart.js après le rendu
        this.initCharts(data);
    }

    /**
     * Rend l'en-tête du dashboard
     * @returns {string} HTML
     */
    renderHeader() {
        return `
            <div class="dashboard-header">
                <div class="dashboard-title">
                    <h2>📊 Dashboard Analytics</h2>
                    <p class="dashboard-subtitle">Vue d'ensemble de votre emploi du temps</p>
                </div>
                <div class="dashboard-actions">
                    <button class="btn btn-sm btn-secondary" onclick="window.EDTDashboardController?.refreshData()">
                        🔄 Actualiser
                    </button>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" onclick="window.EDTDashboardController?.exportDashboard('pdf')">
                            📄 PDF
                        </button>
                        <button class="btn btn-sm btn-success" onclick="window.EDTDashboardController?.exportDashboard('excel')">
                            📗 Excel
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Rend les KPIs
     * @param {Object} kpis - Les données KPIs
     * @returns {string} HTML
     */
    renderKPIs(kpis) {
        return `
            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-icon">📅</div>
                    <div class="kpi-content">
                        <div class="kpi-value">${kpis.totalSeances}</div>
                        <div class="kpi-label">Séances Totales</div>
                    </div>
                </div>
                
                <div class="kpi-card">
                    <div class="kpi-icon">👨‍🏫</div>
                    <div class="kpi-content">
                        <div class="kpi-value">${kpis.teacherAssignmentRate}%</div>
                        <div class="kpi-label">Attribution Enseignants</div>
                        <div class="kpi-subtext">${kpis.activeTeachers}/${kpis.totalTeachers} actifs</div>
                    </div>
                </div>
                
                <div class="kpi-card">
                    <div class="kpi-icon">🏛️</div>
                    <div class="kpi-content">
                        <div class="kpi-value">${kpis.roomAssignmentRate}%</div>
                        <div class="kpi-label">Attribution Salles</div>
                        <div class="kpi-subtext">${kpis.usedRooms}/${kpis.totalRooms} utilisées</div>
                    </div>
                </div>
                
                <div class="kpi-card ${kpis.globalOccupancyRate > 70 ? 'kpi-success' : kpis.globalOccupancyRate > 50 ? 'kpi-warning' : 'kpi-danger'}">
                    <div class="kpi-icon">📊</div>
                    <div class="kpi-content">
                        <div class="kpi-value">${kpis.globalOccupancyRate}%</div>
                        <div class="kpi-label">Occupation Globale</div>
                        <div class="kpi-subtext">Créneaux utilisés</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Rend les alertes
     * @param {Array} alerts - Les alertes
     * @returns {string} HTML
     */
    renderAlerts(alerts) {
        if (!alerts || alerts.length === 0) {
            return `
                <div class="alerts-section">
                    <div class="alert alert-success">
                        <span class="alert-icon">✅</span>
                        <div class="alert-content">
                            <strong>Tout est OK !</strong>
                            <p>Aucune alerte détectée pour le moment.</p>
                        </div>
                    </div>
                </div>
            `;
        }

        const alertsHtml = alerts.map(alert => `
            <div class="alert alert-${alert.type}">
                <span class="alert-icon">${alert.icon}</span>
                <div class="alert-content">
                    <strong>${alert.title}</strong>
                    <p>${safeText(alert.message)}</p>
                    ${alert.action ? `<small class="alert-action">💡 ${safeText(alert.action)}</small>` : ''}
                </div>
            </div>
        `).join('');

        return `
            <div class="alerts-section">
                <h3>🔔 Alertes et Recommandations</h3>
                ${alertsHtml}
            </div>
        `;
    }

    /**
     * Rend les conteneurs pour les graphiques
     * @param {Object} data - Les données
     * @returns {string} HTML
     */
    renderCharts(data) {
        return `
            <div class="charts-section">
                <div class="charts-row">
                    <div class="chart-container chart-large">
                        <h3>👨‍🏫 Charge de Travail par Enseignant</h3>
                        <canvas id="teachersWorkloadChart"></canvas>
                    </div>
                    
                    <div class="chart-container chart-small">
                        <h3>📊 Distribution des Séances</h3>
                        <canvas id="sessionsDistributionChart"></canvas>
                    </div>
                </div>
                
                <div class="charts-row">
                    <div class="chart-container chart-medium">
                        <h3>⏰ Heatmap des Créneaux</h3>
                        <div id="timeSlotsHeatmap"></div>
                    </div>
                    
                    <div class="chart-container chart-medium">
                        <h3>🏛️ Occupation des Salles</h3>
                        <canvas id="roomsOccupancyChart"></canvas>
                    </div>
                </div>
                
                <div class="charts-row">
                    <div class="chart-container chart-full">
                        <h3>📈 Timeline Hebdomadaire</h3>
                        <canvas id="weeklyTimelineChart"></canvas>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Rend les statistiques par matière
     * @param {Array} subjectStats - Les stats par matière
     * @returns {string} HTML
     */
    renderSubjectStats(subjectStats) {
        if (!subjectStats || subjectStats.length === 0) {
            return '';
        }

        const statsHtml = subjectStats.map(s => `
            <tr>
                <td><strong>${safeText(s.nom)}</strong></td>
                <td>${safeText(s.filiere)}</td>
                <td>${s.totalSeances}</td>
                <td>${s.cours}</td>
                <td>${s.td}</td>
                <td>${s.tp}</td>
                <td>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${s.completion}%; background-color: ${this.getCompletionColor(s.completion)}"></div>
                        <span class="progress-bar-text">${s.completion}%</span>
                    </div>
                </td>
            </tr>
        `).join('');

        return `
            <div class="subject-stats-section">
                <h3>📚 Statistiques par Matière</h3>
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Matière</th>
                            <th>Filière</th>
                            <th>Total</th>
                            <th>Cours</th>
                            <th>TD</th>
                            <th>TP</th>
                            <th>Complétion</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${statsHtml}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Initialise tous les graphiques Chart.js
     * @param {Object} data - Les données
     */
    initCharts(data) {
        // Détruire les graphiques existants
        this.destroyCharts();

        // 1. Graphique charge enseignants
        this.initTeachersWorkloadChart(data.teachersWorkload);

        // 2. Graphique distribution séances
        this.initSessionsDistributionChart(data.sessionsDistribution);

        // 3. Heatmap créneaux
        this.initTimeSlotsHeatmap(data.timeSlotsHeatmap);

        // 4. Graphique occupation salles
        this.initRoomsOccupancyChart(data.roomsOccupancy);

        // 5. Timeline hebdomadaire
        this.initWeeklyTimelineChart(data.weeklyTimeline);
    }

    /**
     * Initialise le graphique de charge enseignants (barres horizontales)
     * @param {Array} data - Les données
     */
    initTeachersWorkloadChart(data) {
        const ctx = document.getElementById('teachersWorkloadChart');
        if (!ctx) return;

        // Limiter aux 15 premiers enseignants
        const topTeachers = data.slice(0, 30);
        // Calculer la valeur de référence (maxWorkload) via SchedulingService si disponible
        let referenceValue = 0;
        try {
            if (typeof SchedulingService.computeMaxWorkloadForCurrentSession === 'function') {
                referenceValue = Number(SchedulingService.computeMaxWorkloadForCurrentSession() || 0);
            } else if (StateManager && StateManager.state && StateManager.state.toleranceMaxWorkload !== undefined) {
                // fallback grossier : utiliser tolerance comme repère si rien d'autre
                referenceValue = Number(StateManager.state.toleranceMaxWorkload || 0);
            }
        } catch (err) {
            console.warn('Unable to compute reference workload:', err);
            referenceValue = 0;
        }

        this.charts.teachersWorkload = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topTeachers.map(t => t.nom),
                datasets: [{
                    label: 'Volume hTP',
                    data: topTeachers.map(t => t.volume),
                    backgroundColor: topTeachers.map(t => t.color),
                    borderColor: topTeachers.map(t => t.color),
                    borderWidth: 1
                },
                // Dataset pour la ligne de référence (verticale sur le graphique horizontal)
                {
                    type: 'line',
                    label: 'Volume référence',
                    data: topTeachers.map(() => referenceValue),
                    borderColor: 'rgba(220, 53, 69, 0.95)', // rouge distinct
                    borderWidth: 2,
                    pointRadius: 0,
                    borderDash: [6, 4],
                    fill: false,
                    tension: 0,
                    order: 2
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const teacher = topTeachers[context.dataIndex];
                                //return `${context.parsed.x}h (${teacher.status})`;
                                // If the context dataset is the reference line, show reference label
                                if (context.dataset && context.dataset.label === 'Volume référence') {
                                    return `Référence: ${referenceValue} h`;
                                }
                                return `${context.parsed.x}h (${teacher.status})`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Volume hTP'
                        }
                    }
                }
            }
        });
    }

    /**
     * Initialise le graphique de distribution (camembert)
     * @param {Object} data - Les données
     */
    initSessionsDistributionChart(data) {
        const ctx = document.getElementById('sessionsDistributionChart');
        if (!ctx) return;

        this.charts.sessionsDistribution = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.data,
                    backgroundColor: data.colors,
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const percentage = ((value / data.total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Initialise la heatmap des créneaux
     * @param {Object} data - Les données
     */
    initTimeSlotsHeatmap(data) {
        const container = document.getElementById('timeSlotsHeatmap');
        if (!container) return;

        let html = '<table class="heatmap-table"><thead><tr><th>Jour/Créneau</th>';

        // En-têtes créneaux
        data.creneaux.forEach(creneau => {
            html += `<th>${creneau}</th>`;
        });
        html += '</tr></thead><tbody>';

        // Lignes jours
        data.jours.forEach(jour => {
            html += `<tr><th>${jour}</th>`;
            data.creneaux.forEach(creneau => {
                const cell = data.data[jour][creneau];
                html += `<td class="heatmap-cell heatmap-${cell.level}" style="background-color: ${cell.color}" title="${cell.count} séance(s)">
                    ${cell.count > 0 ? cell.count : ''}
                </td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';

        // Légende
        html += `
            <div class="heatmap-legend">
                <span class="legend-item"><span class="legend-color" style="background-color: #e9ecef"></span> Vide</span>
                <span class="legend-item"><span class="legend-color" style="background-color: #d1ecf1"></span> Faible</span>
                <span class="legend-item"><span class="legend-color" style="background-color: #fff3cd"></span> Moyen</span>
                <span class="legend-item"><span class="legend-color" style="background-color: #f8d7da"></span> Élevé</span>
            </div>
        `;

        container.innerHTML = html;
    }

    /**
     * Initialise le graphique d'occupation des salles
     * @param {Array} data - Les données
     */
    initRoomsOccupancyChart(data) {
        const ctx = document.getElementById('roomsOccupancyChart');
        if (!ctx) return;

        // Limiter aux 10 premières salles
        const topRooms = data.slice(0, 10);

        this.charts.roomsOccupancy = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topRooms.map(r => r.salle),
                datasets: [{
                    label: 'Taux d\'occupation (%)',
                    data: topRooms.map(r => r.occupancyRate),
                    backgroundColor: topRooms.map(r => r.color),
                    borderColor: topRooms.map(r => r.color),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const room = topRooms[context.dataIndex];
                                return `${context.parsed.y}% (${room.totalSeances} séances)`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Taux d\'occupation (%)'
                        }
                    }
                }
            }
        });
    }

    /**
     * Initialise le graphique timeline hebdomadaire
     * @param {Object} data - Les données
     */
    initWeeklyTimelineChart(data) {
        const ctx = document.getElementById('weeklyTimelineChart');
        if (!ctx) return;

        this.charts.weeklyTimeline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Nombre de séances',
                    data: data.data,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            afterLabel: (context) => {
                                return `Moyenne: ${data.average} séances/jour`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Nombre de séances'
                        },
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    /**
     * Détruit tous les graphiques
     */
    destroyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {};
    }

    /**
     * Obtient la couleur selon le taux de complétion
     * @param {number} completion - Le pourcentage
     * @returns {string} La couleur
     */
    getCompletionColor(completion) {
        if (completion >= 100) return '#28a745';
        if (completion >= 75) return '#ffc107';
        if (completion >= 50) return '#fd7e14';
        return '#dc3545';
    }
}

// Export d'une instance singleton
export default new DashboardRenderer();