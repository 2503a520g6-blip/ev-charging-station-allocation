/**
 * EV Charging Station Allocation System - Pure SVG Chart Engine
 * Lightweight, zero-dependency, zero-CDN, instant rendering.
 */

const Charts = {
  /**
   * Generates an SVG Donut Chart for slot availability breakdown
   */
  renderDonutChart(containerId, data, size = 180, strokeWidth = 26) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const total = Object.values(data).reduce((acc, v) => acc + (Number(v) || 0), 0);
    if (total === 0) {
      container.innerHTML = '<div style="color:#94a3b8;font-size:12px;text-align:center;padding:40px;">No slot data available</div>';
      return;
    }

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const center = size / 2;

    const colors = {
      available: '#10b981',   // Emerald
      occupied: '#ef4444',    // Red
      reserved: '#f59e0b',    // Amber
      maintenance: '#64748b'  // Slate
    };

    let accumulatedPct = 0;
    let paths = '';

    for (const [key, value] of Object.entries(data)) {
      const val = Number(value) || 0;
      if (val <= 0) continue;

      const pct = val / total;
      const strokeDasharray = `${pct * circumference} ${circumference}`;
      const strokeDashoffset = -accumulatedPct * circumference;
      const color = colors[key] || '#94a3b8';

      paths += `
        <circle 
          cx="${center}" 
          cy="${center}" 
          r="${radius}" 
          fill="transparent" 
          stroke="${color}" 
          stroke-width="${strokeWidth}" 
          stroke-dasharray="${strokeDasharray}" 
          stroke-dashoffset="${strokeDashoffset}" 
          transform="rotate(-90 ${center} ${center})"
        >
          <title>${key}: ${val} slots (${Math.round(pct * 100)}%)</title>
        </circle>
      `;

      accumulatedPct += pct;
    }

    const availVal = data.available || 0;
    const availPct = Math.round((availVal / total) * 100);

    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="chart-svg">
        <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="${strokeWidth}" />
        ${paths}
        <text x="${center}" y="${center - 4}" text-anchor="middle" font-size="20" font-weight="700" fill="#0f172a">${availPct}%</text>
        <text x="${center}" y="${center + 14}" text-anchor="middle" font-size="10" font-weight="600" fill="#64748b" text-transform="uppercase">Available</text>
      </svg>
      <div class="chart-legend">
        <div class="legend-item"><span class="legend-color" style="background:#10b981"></span> Available (${data.available || 0})</div>
        <div class="legend-item"><span class="legend-color" style="background:#ef4444"></span> Occupied (${data.occupied || 0})</div>
        <div class="legend-item"><span class="legend-color" style="background:#f59e0b"></span> Reserved (${data.reserved || 0})</div>
        <div class="legend-item"><span class="legend-color" style="background:#64748b"></span> Maint (${data.maintenance || 0})</div>
      </div>
    `;

    container.innerHTML = svg;
  },

  /**
   * Generates an SVG Bar Chart for Zone Slot Capacity & Availability
   */
  renderZoneBarChart(containerId, zoneData) {
    const container = document.getElementById(containerId);
    if (!container || !zoneData || zoneData.length === 0) return;

    let barsHtml = '';
    const maxVal = Math.max(...zoneData.map(z => z.total_zone_slots || 1), 10);

    zoneData.forEach(z => {
      const total = z.total_zone_slots || 0;
      const free = z.free_slots || 0;
      const freePct = total > 0 ? (free / total) * 100 : 0;
      const widthPct = Math.round((total / maxVal) * 100);

      barsHtml += `
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
            <span style="font-weight:600;color:#1e293b;">${z.zone}</span>
            <span style="color:#64748b;font-weight:500;">${free} free / ${total} total</span>
          </div>
          <div style="background-color:#e2e8f0;height:10px;border-radius:999px;overflow:hidden;display:flex;width:100%;">
            <div style="background-color:#10b981;height:100%;width:${freePct}%;transition:width 0.4s ease;"></div>
            <div style="background-color:#ef4444;height:100%;width:${100 - freePct}%;"></div>
          </div>
        </div>
      `;
    });

    container.innerHTML = barsHtml;
  }
};
