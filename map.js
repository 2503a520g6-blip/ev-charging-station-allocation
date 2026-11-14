/**
 * EV Charging Station Allocation System - Offline 2D Regional Grid Map & Radar
 * Zero Google Maps / zero external tile dependency. 100% offline, instant vector graphics.
 */

const EVMap = {
  containerId: 'map-viewport',
  stations: [],
  userLocation: { lat: 12.9716, lng: 77.5946, label: "Current Position" },
  selectedStationId: null,
  recommendedStationId: null,
  onStationClickCallback: null,
  onLocationChangeCallback: null,

  // Geo bounds for Bengalur Metro Region (Approx bounds: 12.70 to 13.25 Lat, 77.25 to 77.85 Lng)
  bounds: {
    minLat: 12.70,
    maxLat: 13.25,
    minLng: 77.25,
    maxLng: 77.85
  },

  init(containerId, options = {}) {
    this.containerId = containerId;
    if (options.onStationClick) this.onStationClickCallback = options.onStationClick;
    if (options.onLocationChange) this.onLocationChangeCallback = options.onLocationChange;

    const el = document.getElementById(containerId);
    if (!el) return;

    // Attach click handler to canvas/container so user can click to relocate
    el.addEventListener('click', (e) => {
      // Ignore if clicked on a station pin or button
      if (e.target.closest('.station-pin') || e.target.closest('.map-controls-overlay')) return;

      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const width = rect.width;
      const height = rect.height;

      // Invert pixel back to geo coordinates
      const lng = this.bounds.minLng + (x / width) * (this.bounds.maxLng - this.bounds.minLng);
      const lat = this.bounds.maxLat - (y / height) * (this.bounds.maxLat - this.bounds.minLat);

      this.setUserLocation(lat, lng, "Custom Clicked Location");
      if (this.onLocationChangeCallback) {
        this.onLocationChangeCallback({ lat, lng });
      }
    });

    this.render();
  },

  setStations(stationsList) {
    this.stations = stationsList || [];
    this.render();
  },

  setUserLocation(lat, lng, label = "User Location") {
    this.userLocation = { lat: Number(lat), lng: Number(lng), label };
    this.render();
  },

  setHighlight(recommendedId) {
    this.recommendedStationId = recommendedId;
    this.render();
  },

  geoToPixel(lat, lng, width, height) {
    // Normalizes lat/lng into SVG coordinates
    const x = ((lng - this.bounds.minLng) / (this.bounds.maxLng - this.bounds.minLng)) * width;
    const y = ((this.bounds.maxLat - lat) / (this.bounds.maxLat - this.bounds.minLat)) * height;
    return { x: Math.round(x), y: Math.round(y) };
  },

  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const width = container.clientWidth || 700;
    const height = container.clientHeight || 380;

    const userPx = this.geoToPixel(this.userLocation.lat, this.userLocation.lng, width, height);

    // Build SVG Grid & Range Rings
    let gridLines = '';
    for (let gx = 0; gx < width; gx += 45) {
      gridLines += `<line x1="${gx}" y1="0" x2="${gx}" y2="${height}" stroke="#1e293b" stroke-width="1" stroke-dasharray="3,3" opacity="0.6"/>`;
    }
    for (let gy = 0; gy < height; gy += 45) {
      gridLines += `<line x1="0" y1="${gy}" x2="${width}" y2="${gy}" stroke="#1e293b" stroke-width="1" stroke-dasharray="3,3" opacity="0.6"/>`;
    }

    // Range rings around user location
    const ring1 = 55;
    const ring2 = 110;
    const ring3 = 180;
    const radarRings = `
      <circle cx="${userPx.x}" cy="${userPx.y}" r="${ring1}" fill="none" stroke="#3b82f6" stroke-width="1" stroke-dasharray="2,4" opacity="0.4" />
      <circle cx="${userPx.x}" cy="${userPx.y}" r="${ring2}" fill="none" stroke="#3b82f6" stroke-width="1" stroke-dasharray="2,4" opacity="0.3" />
      <circle cx="${userPx.x}" cy="${userPx.y}" r="${ring3}" fill="none" stroke="#3b82f6" stroke-width="1" stroke-dasharray="2,4" opacity="0.2" />
      <text x="${userPx.x + ring1 + 4}" y="${userPx.y - 4}" fill="#60a5fa" font-size="9" opacity="0.8">5 km</text>
      <text x="${userPx.x + ring2 + 4}" y="${userPx.y - 4}" fill="#60a5fa" font-size="9" opacity="0.7">10 km</text>
      <text x="${userPx.x + ring3 + 4}" y="${userPx.y - 4}" fill="#60a5fa" font-size="9" opacity="0.6">15 km</text>
    `;

    // Connect user to recommended station if present
    let connectionLine = '';
    let pinsSvg = '';

    this.stations.forEach(st => {
      const pos = this.geoToPixel(st.latitude, st.longitude, width, height);
      const isRecommended = (this.recommendedStationId && this.recommendedStationId === st.id);
      const isAvailable = (st.available_slots_count > 0);
      
      let pinColor = '#10b981'; // Green
      if (!isAvailable) {
        pinColor = '#ef4444'; // Red
      } else if (st.available_slots_count === 1) {
        pinColor = '#f59e0b'; // Amber
      }

      if (isRecommended) {
        connectionLine = `
          <line x1="${userPx.x}" y1="${userPx.y}" x2="${pos.x}" y2="${pos.y}" stroke="#10b981" stroke-width="2.5" stroke-dasharray="6,4">
            <animate attributeName="stroke-dashoffset" from="40" to="0" dur="1.2s" repeatCount="indefinite" />
          </line>
        `;
      }

      const glowRing = isRecommended ? `
        <circle cx="${pos.x}" cy="${pos.y}" r="18" fill="none" stroke="#10b981" stroke-width="2" opacity="0.8">
          <animate attributeName="r" values="12;22;12" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.9;0.1;0.9" dur="1.8s" repeatCount="indefinite" />
        </circle>
      ` : '';

      pinsSvg += `
        <g class="station-pin" data-id="${st.id}" style="cursor:pointer;" onclick="App.inspectStationSlots(${st.id})">
          ${glowRing}
          <circle cx="${pos.x}" cy="${pos.y}" r="${isRecommended ? 10 : 8}" fill="${pinColor}" stroke="#ffffff" stroke-width="2" />
          <!-- Mini lightning bolt icon inside pin -->
          <path d="M${pos.x - 1} ${pos.y - 4} L${pos.x + 2} ${pos.y - 1} L${pos.x} ${pos.y} L${pos.x + 2} ${pos.y + 4} L${pos.x - 2} ${pos.y + 1} L${pos.x} ${pos.y} Z" fill="#ffffff" />
          <text x="${pos.x}" y="${pos.y + 18}" text-anchor="middle" font-size="10" font-weight="600" fill="#f8fafc" style="text-shadow: 0 1px 3px rgba(0,0,0,0.8);">${st.name.substring(0, 14)}</text>
          <text x="${pos.x}" y="${pos.y + 28}" text-anchor="middle" font-size="9" fill="${pinColor}" font-weight="600">${st.available_slots_count}/${st.total_slots} Free</text>
        </g>
      `;
    });

    // User pin marker
    const userPin = `
      <g>
        <circle cx="${userPx.x}" cy="${userPx.y}" r="9" fill="#3b82f6" stroke="#ffffff" stroke-width="2.5" />
        <circle cx="${userPx.x}" cy="${userPx.y}" r="3" fill="#ffffff" />
        <text x="${userPx.x}" y="${userPx.y - 14}" text-anchor="middle" font-size="11" font-weight="700" fill="#60a5fa" style="text-shadow:0 1px 3px #000;">
          📍 ${this.userLocation.label || "You Are Here"}
        </text>
      </g>
    `;

    const svgContent = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="map-svg">
        <rect width="100%" height="100%" fill="#0b1329" />
        ${gridLines}
        ${radarRings}
        ${connectionLine}
        ${pinsSvg}
        ${userPin}
      </svg>
      <div class="map-controls-overlay">
        <span><span class="map-legend-dot" style="background:#10b981;"></span>Available</span>
        <span><span class="map-legend-dot" style="background:#f59e0b;"></span>Limited (1)</span>
        <span><span class="map-legend-dot" style="background:#ef4444;"></span>Full (0)</span>
        <span><span class="map-legend-dot" style="background:#3b82f6;"></span>Your Location</span>
        <span style="color:#94a3b8;margin-left:4px;">(Click anywhere on map to reposition)</span>
      </div>
    `;

    container.innerHTML = svgContent;
  }
};
