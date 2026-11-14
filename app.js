/**
 * EV Charging Station Allocation System - Master Application Script
 * Modular, vanilla JavaScript, fast performance, zero build step.
 */

const App = {
  currentUser: {
    id: 2,
    username: "alex_ev",
    full_name: "Alex Rivera",
    email: "alex.rivera@example.com",
    role: "user",
    vehicle_model: "Hyundai Ioniq 5",
    vehicle_plate: "KA-01-EV-4421",
    preferred_connector: "CCS2",
    battery_capacity_kwh: 72.6
  },
  
  userLocation: {
    lat: 12.9716,
    lng: 77.5946,
    label: "Downtown Central"
  },

  stations: [],
  reservations: [],
  usersList: [],
  currentTab: 'dashboard',
  lastAllocationResult: null,
  activeInspectStationId: null,

  // Location Presets for seamless live demonstration
  presets: [
    { name: "Downtown Central", lat: 12.9716, lng: 77.5946 },
    { name: "Cyber City Tech Hub", lat: 12.8452, lng: 77.6602 },
    { name: "Airport Terminal 2", lat: 13.2008, lng: 77.7088 },
    { name: "Green Valley Eco Park", lat: 12.9121, lng: 77.6446 },
    { name: "Malleshwaram West", lat: 13.0031, lng: 77.5685 },
    { name: "Whitefield Financial", lat: 12.9698, lng: 77.7499 }
  ],

  init() {
    this.bindNavigation();
    this.bindLocationPresets();
    this.updateUserBadge();
    
    // Initialize offline 2D map
    EVMap.init('map-viewport', {
      onLocationChange: (pos) => {
        this.userLocation.lat = pos.lat;
        this.userLocation.lng = pos.lng;
        this.userLocation.label = "Custom Pinned Location";
        this.syncLocationInputs();
        this.loadStations();
      }
    });

    // Initial load
    this.syncLocationInputs();
    this.loadDashboardData();
    this.loadStations();
    this.loadReservations();
  },

  // ================= NOTIFICATIONS ================= //
  toast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconSvg = type === 'error' ? '❌' : (type === 'warn' ? '⚠️' : '✅');
    toast.innerHTML = `<span>${iconSvg}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, 3800);
  },

  // ================= VIEW SWITCHER ================= //
  bindNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Mobile sidebar toggle
    const mobileBtn = document.getElementById('mobile-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (mobileBtn && sidebar) {
      mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
      });
    }
  },

  switchTab(tabId) {
    this.currentTab = tabId;
    document.querySelectorAll('.nav-item[data-tab]').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const targetSec = document.getElementById(`view-${tabId}`);
    if (targetSec) {
      targetSec.classList.add('active');
    }

    // Refresh view specific data
    if (tabId === 'dashboard') {
      this.loadDashboardData();
      this.loadStations();
      setTimeout(() => EVMap.render(), 100);
    } else if (tabId === 'stations') {
      this.loadStations();
    } else if (tabId === 'reservations') {
      this.loadReservations();
    } else if (tabId === 'admin') {
      this.loadAdminData();
    } else if (tabId === 'allocation') {
      setTimeout(() => EVMap.render(), 100);
    } else if (tabId === 'diagnostics') {
      EVMap.init('map-viewport-alt');
      EVMap.setStations(this.stations);
      setTimeout(() => EVMap.render(), 100);
    }

    // Close mobile drawer if open
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.remove('mobile-open');
  },

  // ================= USER & ROLE SWITCHING ================= //
  switchRole(role) {
    if (role === 'admin') {
      this.currentUser = {
        id: 1,
        username: "admin",
        full_name: "System Administrator",
        email: "admin@evcharge.org",
        role: "admin",
        vehicle_model: "Tesla Model 3",
        vehicle_plate: "EV-ADM-001",
        preferred_connector: "CCS2",
        battery_capacity_kwh: 75.0
      };
      this.toast("Switched to System Administrator Mode");
    } else {
      this.currentUser = {
        id: 2,
        username: "alex_ev",
        full_name: "Alex Rivera",
        email: "alex.rivera@example.com",
        role: "user",
        vehicle_model: "Hyundai Ioniq 5",
        vehicle_plate: "KA-01-EV-4421",
        preferred_connector: "CCS2",
        battery_capacity_kwh: 72.6
      };
      this.toast("Switched to User Mode (Alex Rivera)");
    }
    this.updateUserBadge();
    this.loadReservations();
    if (this.currentTab === 'admin') this.loadAdminData();
  },

  updateUserBadge() {
    const nameEl = document.getElementById('user-profile-name');
    const roleEl = document.getElementById('user-profile-role');
    const avatarEl = document.getElementById('user-avatar-initials');
    const roleToggleBtn = document.getElementById('role-toggle-btn');

    if (nameEl) nameEl.textContent = this.currentUser.full_name;
    if (roleEl) roleEl.textContent = this.currentUser.role === 'admin' ? 'System Admin' : 'EV Driver';
    if (avatarEl) {
      avatarEl.textContent = this.currentUser.role === 'admin' ? 'AD' : 'AR';
      avatarEl.style.backgroundColor = this.currentUser.role === 'admin' ? '#7c3aed' : '#1e3a8a';
    }
    if (roleToggleBtn) {
      roleToggleBtn.textContent = this.currentUser.role === 'admin' ? 'Switch to EV User' : 'Switch to Admin';
    }

    // Admin nav item visibility indicator
    const adminNav = document.getElementById('nav-admin-item');
    if (adminNav) {
      adminNav.style.display = 'flex';
      adminNav.querySelector('.nav-label').textContent = this.currentUser.role === 'admin' ? 'Admin Control (Active)' : 'Admin Control';
    }
  },

  toggleCurrentRole() {
    if (this.currentUser.role === 'admin') {
      this.switchRole('user');
    } else {
      this.switchRole('admin');
    }
  },

  // ================= LOCATION PRESETS ================= //
  bindLocationPresets() {
    const container = document.getElementById('preset-locations-box');
    if (!container) return;

    let html = '';
    this.presets.forEach((p, idx) => {
      const activeClass = (idx === 0) ? 'active' : '';
      html += `<button type="button" class="pill-btn ${activeClass}" onclick="App.applyPreset(${idx})">${p.name}</button>`;
    });
    container.innerHTML = html;
  },

  applyPreset(index) {
    const preset = this.presets[index];
    if (!preset) return;

    this.userLocation = {
      lat: preset.lat,
      lng: preset.lng,
      label: preset.name
    };

    document.querySelectorAll('#preset-locations-box .pill-btn').forEach((btn, idx) => {
      btn.classList.toggle('active', idx === index);
    });

    this.syncLocationInputs();
    EVMap.setUserLocation(preset.lat, preset.lng, preset.name);
    this.toast(`Simulated location set to: ${preset.name}`);
    this.loadStations();

    // If currently on smart allocation tab, re-evaluate automatically
    if (this.currentTab === 'allocation' || this.currentTab === 'dashboard') {
      this.runSmartAllocation(false);
    }
  },

  syncLocationInputs() {
    const latInp = document.getElementById('alloc-lat');
    const lngInp = document.getElementById('alloc-lng');
    const labelInp = document.getElementById('alloc-location-name');

    if (latInp) latInp.value = this.userLocation.lat.toFixed(4);
    if (lngInp) lngInp.value = this.userLocation.lng.toFixed(4);
    if (labelInp) labelInp.textContent = this.userLocation.label;
  },

  // ================= DASHBOARD & STATS ================= //
  async loadDashboardData() {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (!data.success) return;

      // Update stat cards
      this.updateStatCard('stat-total-stations', data.total_stations);
      this.updateStatCard('stat-available-stations', data.available_stations);
      this.updateStatCard('stat-occupied-stations', data.occupied_stations);
      this.updateStatCard('stat-total-slots', data.total_slots);
      this.updateStatCard('stat-active-sessions', data.active_sessions);
      this.updateStatCard('stat-pending-reservations', data.pending_reservations);

      // Render pure SVG Donut Chart
      if (data.slot_distribution) {
        Charts.renderDonutChart('chart-donut-slots', data.slot_distribution, 180, 24);
      }

      // Render Zone Bar Chart
      if (data.zone_stats) {
        Charts.renderZoneBarChart('chart-zone-bars', data.zone_stats);
      }

    } catch (err) {
      console.error("Failed to load dashboard statistics:", err);
    }
  },

  updateStatCard(elementId, val) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = val !== undefined ? val : '-';
  },

  // ================= STATIONS DIRECTORY ================= //
  async loadStations() {
    try {
      let url = `/api/stations?lat=${this.userLocation.lat}&lng=${this.userLocation.lng}`;
      
      const searchBox = document.getElementById('station-search-box');
      if (searchBox && searchBox.value.trim()) {
        url += `&q=${encodeURIComponent(searchBox.value.trim())}`;
      }

      const connFilter = document.getElementById('station-conn-filter');
      if (connFilter && connFilter.value !== 'all') {
        url += `&connector=${encodeURIComponent(connFilter.value)}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (!data.success) return;

      this.stations = data.stations || [];
      this.renderStationsTable('dashboard-stations-tbody', this.stations.slice(0, 7), true);
      this.renderStationsTable('full-stations-tbody', this.stations, false);

      // Pass stations to visual 2D map
      EVMap.setStations(this.stations);

    } catch (err) {
      console.error("Failed to load charging stations:", err);
    }
  },

  renderStationsTable(tbodyId, stationsList, isDashboardSummary = false) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    if (!stationsList || stationsList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:#94a3b8;">No charging stations match your criteria.</td></tr>`;
      return;
    }

    let html = '';
    stationsList.forEach(st => {
      const isAvail = st.available_slots_count > 0;
      const statusBadge = isAvail 
        ? `<span class="badge badge-available">● ${st.available_slots_count} Free</span>`
        : `<span class="badge badge-occupied">● Fully Occupied</span>`;

      const distText = st.distance_km !== null ? `${st.distance_km} km (${st.eta_mins}m)` : '--';
      const slotPct = Math.round((st.available_slots_count / st.total_slots) * 100);

      html += `
        <tr>
          <td>
            <div class="station-cell">
              <span class="station-name-link" onclick="App.inspectStationSlots(${st.id})">${st.name}</span>
              <span class="station-location-sub">${st.address}, ${st.zone}</span>
            </div>
          </td>
          <td><strong>${distText}</strong></td>
          <td>
            <div style="font-weight:600;">${st.available_slots_count} / ${st.total_slots}</div>
            <div class="slot-bar-wrap">
              <div class="slot-bar-fill" style="width:${slotPct}%"></div>
              <div class="slot-bar-occ" style="width:${100 - slotPct}%"></div>
            </div>
          </td>
          <td><span class="badge badge-power">⚡ ${st.power_kw} kW</span></td>
          <td><span style="font-size:12px;color:#475569;">${st.connector_types}</span></td>
          <td>${statusBadge}</td>
          <td>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm btn-secondary" onclick="App.inspectStationSlots(${st.id})" title="Inspect Slots">Slots</button>
              ${isAvail ? `<button class="btn btn-sm btn-primary" onclick="App.openBookingModal(${st.id})">Book</button>` : `<button class="btn btn-sm btn-secondary" disabled>Full</button>`}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  // ================= SMART ALLOCATION ALGORITHM ================= //
  async runSmartAllocation(showToastAlert = true) {
    const latInp = document.getElementById('alloc-lat');
    const lngInp = document.getElementById('alloc-lng');
    const connInp = document.getElementById('alloc-connector');
    const minPowerInp = document.getElementById('alloc-min-power');
    const currentSocInp = document.getElementById('alloc-current-soc');
    const targetSocInp = document.getElementById('alloc-target-soc');

    const payload = {
      latitude: latInp ? parseFloat(latInp.value) : this.userLocation.lat,
      longitude: lngInp ? parseFloat(lngInp.value) : this.userLocation.lng,
      connector_type: connInp ? connInp.value : 'Any',
      min_power_kw: minPowerInp ? parseFloat(minPowerInp.value) : 0,
      battery_capacity_kwh: this.currentUser.battery_capacity_kwh || 50.0,
      current_battery_pct: currentSocInp ? parseFloat(currentSocInp.value) : 20.0,
      target_battery_pct: targetSocInp ? parseFloat(targetSocInp.value) : 80.0
    };

    try {
      const res = await fetch('/api/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!data.success) {
        if (showToastAlert) this.toast(data.message || "No station found matching criteria", 'error');
        return;
      }

      this.lastAllocationResult = data;
      this.renderAllocationResults(data);
      
      // Highlight on offline 2D map
      if (data.recommended && data.recommended.station) {
        EVMap.setHighlight(data.recommended.station.id);
      }

      if (showToastAlert) {
        this.toast(`Optimal station found: ${data.recommended.station.name} (${data.recommended.distance_km} km)`);
      }

    } catch (err) {
      console.error("Smart Allocation execution error:", err);
      if (showToastAlert) this.toast("Failed to evaluate allocation algorithm", 'error');
    }
  },

  renderAllocationResults(data) {
    const container = document.getElementById('allocation-result-container');
    if (!container) return;

    const rec = data.recommended;
    const st = rec.station;
    const slot = rec.assigned_slot;

    let alternativesHtml = '';
    if (data.alternatives && data.alternatives.length > 0) {
      data.alternatives.forEach(alt => {
        alternativesHtml += `
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-weight:700;font-size:13.5px;color:#0f172a;">${alt.station.name} <span class="badge badge-rec" style="font-size:10px;margin-left:6px;">${alt.badge}</span></div>
              <div style="font-size:11.5px;color:#64748b;margin-top:2px;">📍 ${alt.distance_km} km | ⏱️ ETA ${alt.eta_mins} mins | ⚡ ${alt.station.power_kw} kW | ₹${alt.station.price_per_kwh}/kWh</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:14px;font-weight:700;color:#10b981;">Score: ${alt.composite_score}</div>
              <button class="btn btn-sm btn-secondary" style="margin-top:4px;" onclick="App.openBookingModal(${alt.station.id}, ${alt.assigned_slot ? alt.assigned_slot.id : 'null'})">Select</button>
            </div>
          </div>
        `;
      });
    }

    container.innerHTML = `
      <div class="recommendation-banner">
        <div class="rec-tag-ribbon">⭐ ${rec.badge || "AI RECOMMENDED OPTIMAL STATION"}</div>
        
        <div class="rec-header-row">
          <div>
            <div class="rec-title">${st.name}</div>
            <div class="rec-address">📍 ${st.address}, ${st.zone} (${st.operator})</div>
          </div>
          <div class="score-badge-circle">
            <span class="score-num">${rec.composite_score}</span>
            <span class="score-sub">Score</span>
          </div>
        </div>

        <div class="rec-metrics-grid">
          <div class="metric-col">
            <span class="m-label">DISTANCE</span>
            <span class="m-val">${rec.distance_km} km</span>
          </div>
          <div class="metric-col">
            <span class="m-label">ESTIMATED ARRIVAL</span>
            <span class="m-val">${rec.eta_mins} mins</span>
          </div>
          <div class="metric-col">
            <span class="m-label">EST. CHARGE TIME</span>
            <span class="m-val">${rec.charging_time_mins} mins</span>
          </div>
          <div class="metric-col">
            <span class="m-label">ESTIMATED COST</span>
            <span class="m-val">₹${rec.estimated_cost}</span>
          </div>
        </div>

        <div class="slot-allocated-box">
          <div>
            <strong>Allocated Slot: #${slot ? slot.slot_number : 'Auto'} (${slot ? slot.slot_type : 'Fast DC'})</strong>
            <div style="font-size:12px;color:#475569;margin-top:2px;">Connector: ${slot ? slot.connector_type : 'CCS2'} • Max Output: ${slot ? slot.power_kw : st.power_kw} kW</div>
          </div>
          <button class="btn btn-primary" onclick="App.confirmAllocatedReservation(${st.id}, ${slot ? slot.id : 'null'})">
            Confirm & Reserve Slot
          </button>
        </div>

        <div style="font-size:12px;color:#64748b;margin-bottom:12px;">
          Algorithm Factors: Proximity (40%), Availability Ratio (35%), Charging Speed (15%), Tariff Economy (10%).
        </div>

        ${alternativesHtml ? `
          <div style="margin-top:18px;">
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#475569;letter-spacing:0.5px;">Alternative Ranked Stations</div>
            ${alternativesHtml}
          </div>
        ` : ''}
      </div>
    `;
  },

  confirmAllocatedReservation(stationId, slotId) {
    this.openBookingModal(stationId, slotId);
  },

  // ================= RESERVATIONS & BOOKING ================= //
  async loadReservations() {
    try {
      let url = '/api/reservations';
      // In user mode, filter by current user; in admin mode, show all reservations
      if (this.currentUser.role !== 'admin') {
        url += `?user_id=${this.currentUser.id}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (!data.success) return;

      this.reservations = data.reservations || [];
      this.renderReservationsTable();
      this.renderAdminReservationsTable();

    } catch (err) {
      console.error("Failed to load reservations:", err);
    }
  },

  renderReservationsTable() {
    const tbody = document.getElementById('reservations-tbody');
    if (!tbody) return;

    if (!this.reservations || this.reservations.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:#94a3b8;">No reservation history found. Make a reservation to get started.</td></tr>`;
      return;
    }

    let html = '';
    this.reservations.forEach(r => {
      let statusBadge = `<span class="badge badge-available">● ${r.status}</span>`;
      if (r.status === 'Cancelled') statusBadge = `<span class="badge badge-occupied">● Cancelled</span>`;
      else if (r.status === 'Pending') statusBadge = `<span class="badge badge-reserved">● Pending</span>`;

      const canCancel = (r.status === 'Active' || r.status === 'Pending');

      html += `
        <tr>
          <td><strong style="color:#1e3a8a;">${r.reservation_code}</strong></td>
          <td>
            <div style="font-weight:600;">${r.station_name}</div>
            <div style="font-size:11.5px;color:#64748b;">${r.station_address}</div>
          </td>
          <td><strong>Slot #${r.slot_number}</strong> (${r.slot_type})</td>
          <td>${r.vehicle_model} <span style="font-size:11px;color:#64748b;">[${r.vehicle_plate}]</span></td>
          <td>${r.start_time} (${r.duration_hours}h)</td>
          <td><strong>₹${r.estimated_cost}</strong></td>
          <td>${statusBadge}</td>
          <td>
            ${canCancel ? `<button class="btn btn-sm btn-danger" onclick="App.cancelReservation(${r.id})">Cancel</button>` : `<span style="font-size:12px;color:#94a3b8;">Closed</span>`}
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  openBookingModal(stationId, slotId = null) {
    const station = this.stations.find(s => s.id === stationId);
    if (!station) return;

    document.getElementById('booking-station-id').value = station.id;
    document.getElementById('booking-station-name').value = `${station.name} (${station.address})`;
    document.getElementById('booking-vehicle-model').value = this.currentUser.vehicle_model || 'Hyundai Ioniq 5';
    document.getElementById('booking-vehicle-plate').value = this.currentUser.vehicle_plate || 'KA-01-EV-4421';
    document.getElementById('booking-connector').value = this.currentUser.preferred_connector || 'CCS2';
    document.getElementById('booking-slot-id').value = slotId || '';

    const modal = document.getElementById('modal-booking');
    if (modal) modal.classList.add('open');
  },

  async submitBooking(event) {
    if (event) event.preventDefault();

    const stationId = parseInt(document.getElementById('booking-station-id').value);
    const slotIdVal = document.getElementById('booking-slot-id').value;
    const vehicleModel = document.getElementById('booking-vehicle-model').value.trim();
    const vehiclePlate = document.getElementById('booking-vehicle-plate').value.trim();
    const connectorType = document.getElementById('booking-connector').value;
    const durationHours = parseFloat(document.getElementById('booking-duration').value || 1.0);

    const payload = {
      user_id: this.currentUser.id,
      station_id: stationId,
      slot_id: slotIdVal ? parseInt(slotIdVal) : null,
      vehicle_model: vehicleModel,
      vehicle_plate: vehiclePlate,
      connector_type: connectorType,
      duration_hours: durationHours
    };

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!data.success) {
        this.toast(data.message || "Failed to reserve slot", 'error');
        return;
      }

      this.closeModal('modal-booking');
      this.toast(`Reservation successful! Booking ID: ${data.reservation_code}`);
      
      // Refresh state
      this.loadDashboardData();
      this.loadStations();
      this.loadReservations();
      this.switchTab('reservations');

    } catch (err) {
      console.error("Booking submission error:", err);
      this.toast("An error occurred during reservation", 'error');
    }
  },

  async cancelReservation(resId) {
    if (!confirm("Are you sure you want to cancel this charging slot reservation?")) return;

    try {
      const res = await fetch(`/api/reservations/${resId}/cancel`, {
        method: 'PUT'
      });
      const data = await res.json();

      if (!data.success) {
        this.toast(data.message || "Failed to cancel reservation", 'error');
        return;
      }

      this.toast("Reservation cancelled. Charging slot released!");
      this.loadDashboardData();
      this.loadStations();
      this.loadReservations();

    } catch (err) {
      console.error("Cancellation error:", err);
      this.toast("Error cancelling reservation", 'error');
    }
  },

  // ================= SLOT INSPECTOR MODAL ================= //
  async inspectStationSlots(stationId) {
    this.activeInspectStationId = stationId;
    const modal = document.getElementById('modal-slot-inspector');
    const titleEl = document.getElementById('inspector-station-title');
    const container = document.getElementById('inspector-slots-container');

    try {
      const res = await fetch(`/api/stations/${stationId}`);
      const data = await res.json();
      if (!data.success) return;

      const st = data.station;
      if (titleEl) titleEl.textContent = `${st.name} — Real-time Slot Status`;

      let slotsHtml = '';
      st.slots.forEach(slot => {
        let statusClass = 'avail';
        let badgeColor = 'badge-available';
        if (slot.status === 'Occupied') {
          statusClass = 'occ';
          badgeColor = 'badge-occupied';
        } else if (slot.status === 'Reserved') {
          statusClass = 'rsv';
          badgeColor = 'badge-reserved';
        }

        slotsHtml += `
          <div class="slot-card-item ${statusClass}">
            <div class="slot-num">Slot #${slot.slot_number}</div>
            <div class="slot-type-text">${slot.slot_type} (${slot.power_kw} kW)</div>
            <div style="font-size:11px;color:#2563eb;margin-top:2px;">${slot.connector_type}</div>
            <div style="margin-top:6px;"><span class="badge ${badgeColor}">${slot.status}</span></div>
            ${slot.vehicle_number ? `<div class="slot-vehicle">🚗 ${slot.vehicle_number}</div>` : ''}
            
            ${this.currentUser.role === 'admin' ? `
              <div style="margin-top:8px;display:flex;gap:4px;">
                <button class="btn btn-sm btn-secondary" style="font-size:10px;padding:2px 6px;" onclick="App.toggleSlotAdmin(${slot.id}, '${slot.status === 'Available' ? 'Occupied' : 'Available'}')">Toggle</button>
              </div>
            ` : (slot.status === 'Available' ? `
              <button class="btn btn-sm btn-primary" style="margin-top:8px;font-size:11px;padding:3px 8px;" onclick="App.closeModal('modal-slot-inspector'); App.openBookingModal(${st.id}, ${slot.id})">Book</button>
            ` : '')}
          </div>
        `;
      });

      container.innerHTML = slotsHtml;
      modal.classList.add('open');

    } catch (err) {
      console.error("Failed to inspect station slots:", err);
    }
  },

  async toggleSlotAdmin(slotId, newStatus) {
    try {
      const res = await fetch(`/api/slots/${slotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, vehicle_number: newStatus === 'Available' ? null : 'MANUAL-OVERRIDE' })
      });
      const data = await res.json();
      if (data.success) {
        this.toast(`Slot updated to ${newStatus}`);
        if (this.activeInspectStationId) this.inspectStationSlots(this.activeInspectStationId);
        this.loadDashboardData();
        this.loadStations();
      }
    } catch (err) {
      console.error("Slot toggle error:", err);
    }
  },

  // ================= ADMIN MANAGEMENT MODULE ================= //
  async loadAdminData() {
    this.renderAdminStationsTable();
    this.loadAdminUsers();
    this.loadReservations();
  },

  renderAdminStationsTable() {
    const tbody = document.getElementById('admin-stations-tbody');
    if (!tbody) return;

    let html = '';
    this.stations.forEach(st => {
      html += `
        <tr>
          <td>#${st.id}</td>
          <td><strong>${st.name}</strong><br><span style="font-size:11px;color:#64748b;">${st.address}</span></td>
          <td>${st.zone}</td>
          <td>${st.available_slots_count} / ${st.total_slots}</td>
          <td>${st.power_kw} kW</td>
          <td>₹${st.price_per_kwh}</td>
          <td><span class="badge ${st.status === 'Active' ? 'badge-available' : 'badge-occupied'}">${st.status}</span></td>
          <td>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm btn-secondary" onclick="App.openEditStationModal(${st.id})">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="App.deleteStation(${st.id})">Delete</button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  renderAdminReservationsTable() {
    const tbody = document.getElementById('admin-reservations-tbody');
    if (!tbody) return;

    let html = '';
    this.reservations.forEach(r => {
      html += `
        <tr>
          <td><strong style="color:#1e3a8a;">${r.reservation_code}</strong></td>
          <td>${r.user_full_name || 'Driver'}</td>
          <td>${r.station_name}</td>
          <td>Slot #${r.slot_number}</td>
          <td>${r.vehicle_plate}</td>
          <td><span class="badge ${r.status === 'Active' ? 'badge-available' : 'badge-reserved'}">${r.status}</span></td>
          <td>
            <div style="display:flex;gap:4px;">
              ${r.status === 'Active' ? `<button class="btn btn-sm btn-secondary" onclick="App.updateReservationStatusAdmin(${r.id}, 'Completed')">Complete</button>` : ''}
              ${r.status !== 'Cancelled' ? `<button class="btn btn-sm btn-danger" onclick="App.updateReservationStatusAdmin(${r.id}, 'Cancelled')">Cancel</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  async loadAdminUsers() {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (!data.success) return;

      this.usersList = data.users || [];
      let html = '';
      this.usersList.forEach(u => {
        html += `
          <tr>
            <td>#${u.id}</td>
            <td><strong>${u.full_name}</strong><br><span style="font-size:11px;color:#64748b;">${u.email}</span></td>
            <td><code>${u.username}</code></td>
            <td><span class="badge ${u.role === 'admin' ? 'badge-power' : 'badge-available'}">${u.role}</span></td>
            <td>${u.vehicle_model || '--'} [${u.vehicle_plate || '--'}]</td>
            <td>${u.preferred_connector || 'CCS2'}</td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  },

  openAddStationModal() {
    document.getElementById('station-form-title').textContent = "Add New EV Charging Station";
    document.getElementById('station-form-id').value = '';
    document.getElementById('st-name').value = '';
    document.getElementById('st-address').value = '';
    document.getElementById('st-city').value = 'Bengaluru';
    document.getElementById('st-zone').value = 'Metro Zone';
    document.getElementById('st-lat').value = this.userLocation.lat.toFixed(4);
    document.getElementById('st-lng').value = this.userLocation.lng.toFixed(4);
    document.getElementById('st-slots').value = '4';
    document.getElementById('st-power').value = '60';
    document.getElementById('st-connectors').value = 'CCS2, Type 2';
    document.getElementById('st-price').value = '15.00';
    document.getElementById('st-operator').value = 'ChargeZone Smart';

    const modal = document.getElementById('modal-station-form');
    if (modal) modal.classList.add('open');
  },

  openEditStationModal(stationId) {
    const st = this.stations.find(s => s.id === stationId);
    if (!st) return;

    document.getElementById('station-form-title').textContent = `Edit Station #${st.id}: ${st.name}`;
    document.getElementById('station-form-id').value = st.id;
    document.getElementById('st-name').value = st.name;
    document.getElementById('st-address').value = st.address;
    document.getElementById('st-city').value = st.city;
    document.getElementById('st-zone').value = st.zone;
    document.getElementById('st-lat').value = st.latitude;
    document.getElementById('st-lng').value = st.longitude;
    document.getElementById('st-slots').value = st.total_slots;
    document.getElementById('st-slots').disabled = true; // slots structure maintained
    document.getElementById('st-power').value = st.power_kw;
    document.getElementById('st-connectors').value = st.connector_types;
    document.getElementById('st-price').value = st.price_per_kwh;
    document.getElementById('st-operator').value = st.operator;

    const modal = document.getElementById('modal-station-form');
    if (modal) modal.classList.add('open');
  },

  async submitStationForm(event) {
    if (event) event.preventDefault();

    const stationId = document.getElementById('station-form-id').value;
    const isEdit = !!stationId;

    const payload = {
      name: document.getElementById('st-name').value.trim(),
      address: document.getElementById('st-address').value.trim(),
      city: document.getElementById('st-city').value.trim(),
      zone: document.getElementById('st-zone').value.trim(),
      latitude: parseFloat(document.getElementById('st-lat').value),
      longitude: parseFloat(document.getElementById('st-lng').value),
      total_slots: parseInt(document.getElementById('st-slots').value),
      power_kw: parseFloat(document.getElementById('st-power').value),
      connector_types: document.getElementById('st-connectors').value.trim(),
      price_per_kwh: parseFloat(document.getElementById('st-price').value),
      operator: document.getElementById('st-operator').value.trim(),
      status: 'Active'
    };

    try {
      const url = isEdit ? `/api/stations/${stationId}` : '/api/stations';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!data.success) {
        this.toast(data.message || "Failed to save station", 'error');
        return;
      }

      this.closeModal('modal-station-form');
      this.toast(isEdit ? "Station updated successfully" : "New charging station added!");
      this.loadDashboardData();
      this.loadStations();
      this.loadAdminData();

    } catch (err) {
      console.error("Save station error:", err);
      this.toast("Error saving station", 'error');
    }
  },

  async deleteStation(stationId) {
    if (!confirm(`Are you sure you want to delete Charging Station #${stationId}? All associated slots will be removed.`)) return;

    try {
      const res = await fetch(`/api/stations/${stationId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        this.toast("Charging station deleted successfully");
        this.loadDashboardData();
        this.loadStations();
        this.loadAdminData();
      }
    } catch (err) {
      console.error("Station deletion error:", err);
      this.toast("Failed to delete station", 'error');
    }
  },

  async updateReservationStatusAdmin(resId, newStatus) {
    try {
      const res = await fetch(`/api/reservations/${resId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        this.toast(`Reservation status set to ${newStatus}`);
        this.loadDashboardData();
        this.loadStations();
        this.loadReservations();
      }
    } catch (err) {
      console.error("Reservation status update error:", err);
    }
  },

  // ================= DEMO RESET ================= //
  async resetDemoData() {
    if (!confirm("Reset database to initial pristine state with 12 stations, 62 slots and sample reservations?")) return;

    try {
      const res = await fetch('/api/reset-data', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.toast("Demo data successfully reset!");
        this.loadDashboardData();
        this.loadStations();
        this.loadReservations();
        this.applyPreset(0);
      }
    } catch (err) {
      console.error("Data reset error:", err);
      this.toast("Failed to reset database", 'error');
    }
  },

  // ================= MODAL HELPERS ================= //
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
  }
};

// Start application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
