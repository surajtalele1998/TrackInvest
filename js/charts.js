/**
 * charts.js - Data Visualization Engine
 */
import { formatInr, formatMoney } from './utils.js';

let portfolioChart = null;

export function renderPortfolioChart(containerId, data) {
    const ctx = document.getElementById(containerId);
    if (!ctx) return;

    if (portfolioChart) portfolioChart.destroy();

    portfolioChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.values,
                backgroundColor: [
                    '#415F91', '#705573', '#186D33', '#B3261E', 
                    '#0288D1', '#D96200', '#388E3C', '#795548'
                ],
                borderWidth: 0,
                spacing: 4
            }]
        },
        options: {
            cutout: '75%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (c) => ` ₹${formatInr(c.raw)}`
                    }
                }
            }
        }
    });
}
