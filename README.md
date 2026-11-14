# EV Charging Station Allocation System

A modern, fast, responsive web application designed for Electric Vehicle (EV) drivers and charging network operators. It features real-time charging station discovery, intelligent multi-criteria slot allocation using the Haversine distance formula, live slot state management, an offline 2D regional radar simulation, and complete Admin and User modules.

---

## 🌟 Key Highlights & Features

1. **Ultra-Fast & 100% Offline Capable**:
   - Zero external CDNs, zero Google Maps API keys, and zero external font or icon libraries.
   - Pure system typography, embedded inline SVGs, and an in-house pure SVG vector chart engine.
   - Built on lightweight Python Flask + SQLite for minimal memory footprint and instant local execution.

2. **Executive College Presentation Dashboard**:
   - **Summary KPI Cards**: Total Stations, Available Stations, Occupied Stations, Total Slots, Active Sessions, Pending Bookings.
   - **Real-Time Station Table**: Displays live slot occupancy with mini progress bars, power ratings (kW), plug types, and one-click slot inspection.
   - **Vector SVG Donut Chart**: Visualizes slot availability ratios (Available vs Occupied vs Reserved vs Maintenance).
   - **Zone Capacity Chart**: Real-time bar graph of charging density across metropolitan zones.
   - **Offline 2D Regional Map & Radar**: Real coordinate projection with animated radar range circles (5 km, 10 km, 15 km) and dynamic routing lines to recommended stations.

3. **Smart Allocation Engine**:
   - Implements the **Haversine formula** to compute exact geodesic distance between user coordinates and charging hubs:
     $$\Delta\sigma = 2 \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
     $$d = R \cdot \Delta\sigma \quad (R = 6371\text{ km})$$
   - Evaluates multi-criteria scoring:
     - **Proximity Score (40%)**: Normalized by distance decay.
     - **Slot Availability (35%)**: Ratio of unreserved slots.
     - **Charging Power Delivery (15%)**: Ultra-fast DC (150-240 kW) vs Fast DC (50-120 kW) vs AC (22 kW).
     - **Tariff Economy (10%)**: Cost optimization per kWh.
   - Automatically assigns the specific free physical slot at the recommended station.
   - Provides ranked alternative candidates with badges (*Fastest Charger*, *Nearest Station*, *Budget Friendly*).

4. **User & Admin Modules**:
   - **User Mode**:
     - Browse stations with search and plug filters (CCS2, Type 2, CHAdeMO).
     - Book a specific slot with vehicle model, license plate, and estimated duration.
     - Cancel reservations and release slots back to the grid in real-time.
     - Booking history log with timestamped receipts.
   - **Admin Mode**:
     - Add new charging stations with custom slots, power, and pricing.
     - Edit existing station metadata and pricing.
     - Delete stations (with cascading cleanup).
     - Physical slot override (manually toggle slots between Available and Occupied for testing).
     - View all registered users and all active/completed reservations.
     - One-click **Reset Demo Data** to quickly restore the demo database.

---

## 📁 Project Structure

```
ev-charging-system/
├── app.py                  # Flask backend with REST API & Smart Allocation algorithm
├── database.py             # SQLite database schema & 12 sample station seeder
├── requirements.txt        # Minimal dependency file (Flask)
├── run.bat                 # One-click Windows runner batch script
├── README.md               # Documentation & College Presentation Guide
├── static/
│   ├── css/
│   │   └── style.css       # Clean, modern white + emerald green + navy slate theme
│   └── js/
│       ├── app.js          # Main SPA frontend controller & REST API client
│       ├── charts.js       # Zero-CDN pure SVG donut & bar chart engine
│       └── map.js          # Zero-CDN offline 2D regional grid radar & simulator
└── templates/
    └── index.html          # Responsive single-page dashboard layout
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.8 or higher installed on your machine.
- Pip (Python package installer).

### 2. Installation
Open your command terminal (PowerShell or Command Prompt) and navigate to the project directory:

```bash
cd "C:\Users\shanm\.gemini\antigravity\scratch\ev-charging-system"
```

Install Flask (if not already installed):
```bash
pip install -r requirements.txt
```

### 3. Launching the Application

Run the server with Python:
```bash
python app.py
```
*(Or double-click `run.bat` on Windows)*

### 4. Access the Dashboard
Open your web browser and navigate to:
```
http://127.0.0.1:5000
```

---

## 🧪 Demonstration & Viva Guide for College Presentation

### Test Accounts (Pre-configured)
- **Driver Profile**: Alex Rivera (`alex_ev`) — Hyundai Ioniq 5, CCS2, 72.6 kWh battery.
- **Admin Profile**: System Administrator (`admin`) — Full infrastructure management privileges.
- *Quick Switch*: Use the "Switch to Admin / Switch to EV User" button in the bottom-left sidebar to toggle roles seamlessly without re-logging!

### Recommended Demo Walkthrough Steps
1. **Dashboard Overview**:
   - Show the summary cards: 12 Stations, 62 Slots, Active Sessions, and Pending Bookings.
   - Highlight the zero-dependency pure SVG Donut chart displaying live slot availability percentages.
   - Point out the offline 2D vector radar at the bottom showing real station pins and 5 km, 10 km, 15 km range rings.
2. **Interactive Location Simulation**:
   - Click on the location presets (e.g. *Cyber City Tech Hub*, *Downtown Central*, or *Airport Terminal 2*), or click anywhere on the 2D vector map.
   - Notice how all distance calculations, ETAs, and map pins dynamically update.
3. **Smart Allocation in Action**:
   - Click on **Smart Allocation** in the sidebar.
   - Adjust the battery level (e.g. 15% current, 85% target) and select plug preference `CCS2`.
   - Click **"Find & Allocate Best Station"**.
   - Review the calculated composite score, estimated charging duration, charging cost, and assigned slot.
   - Click **"Confirm & Reserve Slot"** to complete a reservation.
4. **Inspect Physical Slots**:
   - In the Station table, click the **"Slots"** button on any station to view its real-time slot grid.
5. **Admin Capabilities**:
   - Switch to Admin Mode using the sidebar button.
   - Navigate to **Admin Control**:
     - Add a new charging station.
     - View and modify live reservations.
     - Toggle individual slot statuses to simulate cars arriving or leaving.
   - Click **"Reset Demo Data"** at any time to return the database to its pristine demo state.
