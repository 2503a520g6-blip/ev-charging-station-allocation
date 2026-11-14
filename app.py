"""
EV Charging Station Allocation System - Backend Server
Modern, responsive, lightweight, zero-external-dependency Flask application.
"""

import os
import math
import random
import string
from datetime import datetime
from flask import Flask, request, jsonify, render_template, send_from_directory
from database import get_db_connection, init_db, hash_password

app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['JSON_SORT_KEYS'] = False

# Ensure DB exists on startup
init_db(force_reseed=False)

def calculate_haversine(lat1, lon1, lat2, lon2):
    """Calculates great-circle distance between two points in kilometers."""
    R = 6371.0  # Earth radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 2)

def generate_reservation_code():
    chars = string.ascii_uppercase + string.digits
    rand_str = ''.join(random.choices(chars, k=4))
    year = datetime.now().year
    return f"RES-{year}-{rand_str}"

# ----------------- WEB PAGES ----------------- #

@app.route('/')
def index():
    return render_template('index.html')

# ----------------- DASHBOARD & STATS ----------------- #

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM stations WHERE status = 'Active'")
    total_active_stations = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM stations")
    total_stations = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM slots")
    total_slots = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM slots WHERE status = 'Available'")
    available_slots = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM slots WHERE status = 'Occupied'")
    occupied_slots = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM slots WHERE status = 'Reserved'")
    reserved_slots = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM slots WHERE status = 'Maintenance'")
    maintenance_slots = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM reservations WHERE status = 'Active'")
    active_sessions = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM reservations WHERE status = 'Pending'")
    pending_reservations = cursor.fetchone()[0]

    # Stations with at least 1 available slot
    cursor.execute("""
    SELECT COUNT(DISTINCT station_id) 
    FROM slots 
    WHERE status = 'Available'
    """)
    available_stations = cursor.fetchone()[0]

    # Occupied/Full stations
    cursor.execute("""
    SELECT s.id, COUNT(sl.id) as tot,
           SUM(CASE WHEN sl.status = 'Available' THEN 1 ELSE 0 END) as free_sl
    FROM stations s
    JOIN slots sl ON s.id = sl.station_id
    GROUP BY s.id
    """)
    station_slot_rows = cursor.fetchall()
    occupied_stations = sum(1 for row in station_slot_rows if row['free_sl'] == 0)

    # Top zones by available slots for chart
    cursor.execute("""
    SELECT s.zone, COUNT(sl.id) as total_zone_slots,
           SUM(CASE WHEN sl.status = 'Available' THEN 1 ELSE 0 END) as free_slots
    FROM stations s
    JOIN slots sl ON s.id = sl.station_id
    GROUP BY s.zone
    ORDER BY total_zone_slots DESC
    LIMIT 6
    """)
    zone_stats = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return jsonify({
        "success": True,
        "total_stations": total_stations,
        "available_stations": available_stations,
        "occupied_stations": occupied_stations,
        "total_slots": total_slots,
        "available_slots": available_slots,
        "occupied_slots": occupied_slots,
        "reserved_slots": reserved_slots,
        "maintenance_slots": maintenance_slots,
        "active_sessions": active_sessions,
        "pending_reservations": pending_reservations,
        "slot_distribution": {
            "available": available_slots,
            "occupied": occupied_slots,
            "reserved": reserved_slots,
            "maintenance": maintenance_slots
        },
        "zone_stats": zone_stats
    })

# ----------------- STATIONS API ----------------- #

@app.route('/api/stations', methods=['GET'])
def list_stations():
    search_query = request.args.get('q', '').strip().lower()
    connector_filter = request.args.get('connector', '').strip()
    status_filter = request.args.get('status', '').strip()
    user_lat = request.args.get('lat', type=float)
    user_lng = request.args.get('lng', type=float)

    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
    SELECT s.*,
           COUNT(sl.id) as total_slots_count,
           SUM(CASE WHEN sl.status = 'Available' THEN 1 ELSE 0 END) as available_slots_count,
           SUM(CASE WHEN sl.status = 'Occupied' THEN 1 ELSE 0 END) as occupied_slots_count,
           SUM(CASE WHEN sl.status = 'Reserved' THEN 1 ELSE 0 END) as reserved_slots_count
    FROM stations s
    LEFT JOIN slots sl ON s.id = sl.station_id
    GROUP BY s.id
    ORDER BY s.id ASC
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()

    stations = []
    for row in rows:
        st = dict(row)
        st['available_slots_count'] = st['available_slots_count'] or 0
        st['occupied_slots_count'] = st['occupied_slots_count'] or 0
        st['reserved_slots_count'] = st['reserved_slots_count'] or 0

        # Calculate distance if user lat/lng provided
        if user_lat is not None and user_lng is not None:
            dist = calculate_haversine(user_lat, user_lng, st['latitude'], st['longitude'])
            st['distance_km'] = dist
            st['eta_mins'] = max(2, int(round((dist / 32.0) * 60)))
        else:
            st['distance_km'] = None
            st['eta_mins'] = None

        # Filter query
        if search_query:
            combined = f"{st['name']} {st['address']} {st['city']} {st['zone']} {st['operator']}".lower()
            if search_query not in combined:
                continue

        # Filter connector
        if connector_filter and connector_filter.lower() != 'all':
            if connector_filter.lower() not in st['connector_types'].lower():
                continue

        # Filter status
        if status_filter and status_filter.lower() != 'all':
            if st['status'].lower() != status_filter.lower():
                continue

        stations.append(st)

    # If coordinates provided, sort by distance
    if user_lat is not None and user_lng is not None:
        stations.sort(key=lambda x: x['distance_km'] if x['distance_km'] is not None else 9999)

    return jsonify({"success": True, "count": len(stations), "stations": stations})

@app.route('/api/stations/<int:station_id>', methods=['GET'])
def get_station(station_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM stations WHERE id = ?", (station_id,))
    station_row = cursor.fetchone()
    if not station_row:
        conn.close()
        return jsonify({"success": False, "message": "Station not found"}), 404

    station = dict(station_row)

    cursor.execute("SELECT * FROM slots WHERE station_id = ? ORDER BY slot_number ASC", (station_id,))
    slots = [dict(s) for s in cursor.fetchall()]

    conn.close()
    station['slots'] = slots
    return jsonify({"success": True, "station": station})

@app.route('/api/stations', methods=['POST'])
def create_station():
    data = request.json or {}
    name = data.get('name', '').strip()
    address = data.get('address', '').strip()
    city = data.get('city', 'Bengaluru').strip()
    zone = data.get('zone', 'Metro Zone').strip()
    latitude = float(data.get('latitude', 12.9716))
    longitude = float(data.get('longitude', 77.5946))
    total_slots = int(data.get('total_slots', 4))
    power_kw = float(data.get('power_kw', 50.0))
    connector_types = data.get('connector_types', 'CCS2, Type 2').strip()
    price_per_kwh = float(data.get('price_per_kwh', 15.0))
    operator = data.get('operator', 'Independent EV').strip()
    status = data.get('status', 'Active').strip()

    if not name or not address:
        return jsonify({"success": False, "message": "Station name and address are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    INSERT INTO stations (name, address, city, zone, latitude, longitude, total_slots, power_kw, connector_types, price_per_kwh, operator, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (name, address, city, zone, latitude, longitude, total_slots, power_kw, connector_types, price_per_kwh, operator, status))
    station_id = cursor.lastrowid

    # Create associated slots
    connectors = [c.strip() for c in connector_types.split(',')] if connector_types else ['CCS2']
    slot_type = "Ultra Fast DC" if power_kw >= 150 else ("Fast DC" if power_kw >= 50 else "Standard AC")

    for s_idx in range(1, total_slots + 1):
        conn_type = connectors[(s_idx - 1) % len(connectors)]
        cursor.execute("""
        INSERT INTO slots (station_id, slot_number, slot_type, power_kw, connector_type, status)
        VALUES (?, ?, ?, ?, ?, 'Available')
        """, (station_id, s_idx, slot_type, power_kw, conn_type))

    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Station created successfully", "station_id": station_id}), 201

@app.route('/api/stations/<int:station_id>', methods=['PUT'])
def update_station(station_id):
    data = request.json or {}
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM stations WHERE id = ?", (station_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({"success": False, "message": "Station not found"}), 404

    cursor.execute("""
    UPDATE stations SET
        name = COALESCE(?, name),
        address = COALESCE(?, address),
        city = COALESCE(?, city),
        zone = COALESCE(?, zone),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        power_kw = COALESCE(?, power_kw),
        connector_types = COALESCE(?, connector_types),
        price_per_kwh = COALESCE(?, price_per_kwh),
        operator = COALESCE(?, operator),
        status = COALESCE(?, status)
    WHERE id = ?
    """, (
        data.get('name'), data.get('address'), data.get('city'), data.get('zone'),
        data.get('latitude'), data.get('longitude'), data.get('power_kw'),
        data.get('connector_types'), data.get('price_per_kwh'), data.get('operator'),
        data.get('status'), station_id
    ))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Station updated successfully"})

@app.route('/api/stations/<int:station_id>', methods=['DELETE'])
def delete_station(station_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM stations WHERE id = ?", (station_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({"success": False, "message": "Station not found"}), 404

    cursor.execute("DELETE FROM stations WHERE id = ?", (station_id,))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Station and its slots removed successfully"})

# ----------------- SLOTS API ----------------- #

@app.route('/api/stations/<int:station_id>/slots', methods=['GET'])
def get_station_slots(station_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM slots WHERE station_id = ? ORDER BY slot_number ASC", (station_id,))
    slots = [dict(s) for s in cursor.fetchall()]
    conn.close()
    return jsonify({"success": True, "slots": slots})

@app.route('/api/slots/<int:slot_id>', methods=['PUT'])
def update_slot(slot_id):
    data = request.json or {}
    conn = get_db_connection()
    cursor = conn.cursor()

    new_status = data.get('status')
    vehicle_number = data.get('vehicle_number', None)

    cursor.execute("SELECT * FROM slots WHERE id = ?", (slot_id,))
    slot = cursor.fetchone()
    if not slot:
        conn.close()
        return jsonify({"success": False, "message": "Slot not found"}), 404

    cursor.execute("""
    UPDATE slots SET
        status = COALESCE(?, status),
        vehicle_number = ?
    WHERE id = ?
    """, (new_status, vehicle_number, slot_id))
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Slot updated successfully"})

# ----------------- SMART ALLOCATION MODULE ----------------- #

@app.route('/api/allocate', methods=['POST'])
def smart_allocate():
    """
    Intelligent EV Charging Station Allocation Algorithm:
    Evaluates Distance, Available Slots, Power Capacity, and Price.
    Provides mathematically scored best recommendation + alternative candidates.
    """
    data = request.json or {}

    user_lat = float(data.get('latitude', 12.9716))
    user_lng = float(data.get('longitude', 77.5946))
    pref_connector = data.get('connector_type', 'Any').strip()
    min_power = float(data.get('min_power_kw', 0))
    battery_kwh = float(data.get('battery_capacity_kwh', 50.0))
    current_soc = float(data.get('current_battery_pct', 20.0))
    target_soc = float(data.get('target_battery_pct', 80.0))

    if target_soc <= current_soc:
        target_soc = min(100.0, current_soc + 50.0)

    energy_needed_kwh = round(battery_kwh * ((target_soc - current_soc) / 100.0), 2)

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT s.*, 
           COUNT(sl.id) as total_slots_count,
           SUM(CASE WHEN sl.status = 'Available' THEN 1 ELSE 0 END) as available_slots_count
    FROM stations s
    JOIN slots sl ON s.id = sl.station_id
    WHERE s.status = 'Active'
    GROUP BY s.id
    """)
    stations = cursor.fetchall()

    candidates = []
    for st_row in stations:
        st = dict(st_row)
        
        # Must have at least 1 available slot
        if st['available_slots_count'] <= 0:
            continue

        # Check connector support
        if pref_connector != 'Any' and pref_connector.lower() not in st['connector_types'].lower():
            continue

        # Check min power
        if min_power > 0 and st['power_kw'] < min_power:
            continue

        # Distance via Haversine
        dist = calculate_haversine(user_lat, user_lng, st['latitude'], st['longitude'])
        eta_mins = max(3, int(round((dist / 32.0) * 60)))

        # Find best available matching slot
        cursor.execute("""
        SELECT * FROM slots 
        WHERE station_id = ? AND status = 'Available'
        ORDER BY power_kw DESC, id ASC
        LIMIT 1
        """, (st['id'],))
        best_slot_row = cursor.fetchone()
        best_slot = dict(best_slot_row) if best_slot_row else None

        # Estimated charging time (minutes) = (energy_needed / power) * 60
        effective_power = min(st['power_kw'], 150.0) # EV on-board acceptance ceiling
        charging_time_mins = max(10, int(round((energy_needed_kwh / effective_power) * 60)))
        estimated_cost = round(energy_needed_kwh * st['price_per_kwh'], 2)

        # Multi-factor smart scoring (0 to 100)
        # 1. Proximity score (40% weight): Closer is better. 0 km = 100, 20 km = 0
        proximity_score = max(5.0, 100.0 - (dist * 4.5))
        # 2. Availability score (35% weight): Ratio of available to total slots
        avail_ratio = st['available_slots_count'] / float(st['total_slots_count'])
        availability_score = avail_ratio * 100.0
        # 3. Charging Speed/Power score (15% weight)
        power_score = min(100.0, (st['power_kw'] / 180.0) * 100.0)
        # 4. Pricing score (10% weight): Lower price is better
        price_score = max(10.0, 100.0 - ((st['price_per_kwh'] - 10.0) * 6.0))

        composite_score = round(
            (0.40 * proximity_score) +
            (0.35 * availability_score) +
            (0.15 * power_score) +
            (0.10 * price_score),
            1
        )

        candidates.append({
            "station": st,
            "assigned_slot": best_slot,
            "distance_km": dist,
            "eta_mins": eta_mins,
            "charging_time_mins": charging_time_mins,
            "energy_needed_kwh": energy_needed_kwh,
            "estimated_cost": estimated_cost,
            "composite_score": composite_score,
            "metrics": {
                "proximity_score": round(proximity_score, 1),
                "availability_score": round(availability_score, 1),
                "power_score": round(power_score, 1),
                "price_score": round(price_score, 1)
            }
        })

    conn.close()

    if not candidates:
        return jsonify({
            "success": False,
            "message": "No available stations found matching your criteria. Try adjusting your connector or power filters."
        }), 404

    # Rank by composite score descending
    candidates.sort(key=lambda x: x['composite_score'], reverse=True)

    top_recommendation = candidates[0]
    top_recommendation['badge'] = "Best Match - Optimal Balance"

    # Assign badges to runners-up for clear decision support
    alternatives = candidates[1:5]
    for alt in alternatives:
        if alt['distance_km'] < top_recommendation['distance_km']:
            alt['badge'] = "Nearest Station"
        elif alt['station']['power_kw'] > top_recommendation['station']['power_kw']:
            alt['badge'] = "Fastest Charger"
        elif alt['station']['price_per_kwh'] < top_recommendation['station']['price_per_kwh']:
            alt['badge'] = "Budget Friendly"
        else:
            alt['badge'] = "High Availability"

    return jsonify({
        "success": True,
        "recommended": top_recommendation,
        "alternatives": alternatives,
        "total_evaluated": len(stations),
        "total_eligible": len(candidates)
    })

# ----------------- RESERVATIONS & BOOKINGS ----------------- #

@app.route('/api/reservations', methods=['GET'])
def list_reservations():
    user_id = request.args.get('user_id', type=int)
    status_filter = request.args.get('status', '').strip()

    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
    SELECT r.*, 
           s.name as station_name, s.address as station_address, s.city as station_city, s.operator as station_operator,
           sl.slot_number, sl.slot_type,
           u.full_name as user_full_name, u.email as user_email
    FROM reservations r
    JOIN stations s ON r.station_id = s.id
    JOIN slots sl ON r.slot_id = sl.id
    JOIN users u ON r.user_id = u.id
    WHERE 1=1
    """
    params = []
    if user_id:
        query += " AND r.user_id = ?"
        params.append(user_id)
    if status_filter and status_filter.lower() != 'all':
        query += " AND r.status = ?"
        params.append(status_filter)

    query += " ORDER BY r.id DESC"
    cursor.execute(query, params)
    reservations = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return jsonify({"success": True, "count": len(reservations), "reservations": reservations})

@app.route('/api/reservations', methods=['POST'])
def create_reservation():
    data = request.json or {}
    user_id = int(data.get('user_id', 2))
    station_id = int(data.get('station_id', 0))
    slot_id = data.get('slot_id')
    vehicle_model = data.get('vehicle_model', 'Standard EV').strip()
    vehicle_plate = data.get('vehicle_plate', 'KA-01-EV-2026').strip()
    connector_type = data.get('connector_type', 'CCS2').strip()
    duration_hours = float(data.get('duration_hours', 1.0))
    start_time = data.get('start_time', datetime.now().strftime("%Y-%m-%d %H:%M"))

    if not station_id:
        return jsonify({"success": False, "message": "Station ID is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM stations WHERE id = ?", (station_id,))
    station = cursor.fetchone()
    if not station:
        conn.close()
        return jsonify({"success": False, "message": "Station not found"}), 404

    # If slot_id was not explicitly specified, allocate the first available slot at this station
    if not slot_id:
        cursor.execute("""
        SELECT id, power_kw, connector_type FROM slots 
        WHERE station_id = ? AND status = 'Available'
        ORDER BY slot_number ASC
        LIMIT 1
        """, (station_id,))
        free_slot = cursor.fetchone()
        if not free_slot:
            conn.close()
            return jsonify({"success": False, "message": "No slots currently available at this station"}), 409
        slot_id = free_slot['id']
        charging_speed = free_slot['power_kw']
    else:
        slot_id = int(slot_id)
        cursor.execute("SELECT * FROM slots WHERE id = ? AND station_id = ?", (slot_id, station_id))
        chosen_slot = cursor.fetchone()
        if not chosen_slot:
            conn.close()
            return jsonify({"success": False, "message": "Selected slot does not exist"}), 404
        if chosen_slot['status'] != 'Available':
            conn.close()
            return jsonify({"success": False, "message": f"Slot #{chosen_slot['slot_number']} is currently {chosen_slot['status']}"}), 409
        charging_speed = chosen_slot['power_kw']

    res_code = generate_reservation_code()
    estimated_energy = round(min(charging_speed, 100.0) * duration_hours * 0.7, 1)
    estimated_cost = round(estimated_energy * station['price_per_kwh'], 2)

    cursor.execute("""
    INSERT INTO reservations (reservation_code, user_id, station_id, slot_id, vehicle_model, vehicle_plate, connector_type, charging_speed_kw, start_time, duration_hours, status, estimated_energy_kwh, estimated_cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)
    """, (res_code, user_id, station_id, slot_id, vehicle_model, vehicle_plate, connector_type, charging_speed, start_time, duration_hours, estimated_energy, estimated_cost))
    res_id = cursor.lastrowid

    # Update slot status to Occupied/Reserved
    cursor.execute("""
    UPDATE slots SET status = 'Occupied', vehicle_number = ?, current_reservation_id = ?
    WHERE id = ?
    """, (vehicle_plate, res_id, slot_id))

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": f"Slot allocated successfully! Reservation code: {res_code}",
        "reservation_code": res_code,
        "reservation_id": res_id,
        "slot_id": slot_id,
        "estimated_cost": estimated_cost
    }), 201

@app.route('/api/reservations/<int:res_id>/cancel', methods=['PUT'])
def cancel_reservation(res_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM reservations WHERE id = ?", (res_id,))
    res = cursor.fetchone()
    if not res:
        conn.close()
        return jsonify({"success": False, "message": "Reservation not found"}), 404

    if res['status'] == 'Cancelled':
        conn.close()
        return jsonify({"success": False, "message": "Reservation is already cancelled"}), 400

    # Mark reservation as cancelled
    cursor.execute("UPDATE reservations SET status = 'Cancelled' WHERE id = ?", (res_id,))

    # Free the slot
    cursor.execute("""
    UPDATE slots SET status = 'Available', vehicle_number = NULL, current_reservation_id = NULL
    WHERE id = ?
    """, (res['slot_id'],))

    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Reservation cancelled and charging slot released"})

@app.route('/api/reservations/<int:res_id>/status', methods=['PUT'])
def update_reservation_status(res_id):
    data = request.json or {}
    new_status = data.get('status', 'Completed')

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM reservations WHERE id = ?", (res_id,))
    res = cursor.fetchone()
    if not res:
        conn.close()
        return jsonify({"success": False, "message": "Reservation not found"}), 404

    cursor.execute("UPDATE reservations SET status = ? WHERE id = ?", (new_status, res_id))

    if new_status in ['Completed', 'Cancelled']:
        cursor.execute("""
        UPDATE slots SET status = 'Available', vehicle_number = NULL, current_reservation_id = NULL
        WHERE id = ?
        """, (res['slot_id'],))

    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": f"Reservation updated to {new_status}"})

# ----------------- AUTH & USERS ----------------- #

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    username = data.get('username', '').strip().lower()
    password = data.get('password', '').strip()

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM users WHERE LOWER(username) = ?", (username,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        return jsonify({"success": False, "message": "Invalid username or password"}), 401

    if hash_password(password) != user['password_hash']:
        return jsonify({"success": False, "message": "Invalid username or password"}), 401

    user_dict = dict(user)
    del user_dict['password_hash']

    return jsonify({
        "success": True,
        "message": f"Welcome back, {user_dict['full_name']}!",
        "user": user_dict
    })

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    username = data.get('username', '').strip().lower()
    password = data.get('password', '').strip()
    full_name = data.get('full_name', '').strip()
    email = data.get('email', '').strip()
    vehicle_model = data.get('vehicle_model', 'Electric Vehicle').strip()
    vehicle_plate = data.get('vehicle_plate', 'EV-NEW-2026').strip()
    preferred_connector = data.get('preferred_connector', 'CCS2').strip()

    if not username or not password or not full_name:
        return jsonify({"success": False, "message": "Username, password and name are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM users WHERE LOWER(username) = ?", (username,))
    if cursor.fetchone():
        conn.close()
        return jsonify({"success": False, "message": "Username already exists"}), 409

    cursor.execute("""
    INSERT INTO users (username, password_hash, full_name, email, role, vehicle_model, vehicle_plate, preferred_connector)
    VALUES (?, ?, ?, ?, 'user', ?, ?, ?)
    """, (username, hash_password(password), full_name, email, vehicle_model, vehicle_plate, preferred_connector))
    user_id = cursor.lastrowid
    conn.commit()

    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    new_user = dict(cursor.fetchone())
    del new_user['password_hash']
    conn.close()

    return jsonify({"success": True, "message": "User registered successfully", "user": new_user}), 201

@app.route('/api/users', methods=['GET'])
def list_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, full_name, email, role, vehicle_model, vehicle_plate, preferred_connector, battery_capacity_kwh, created_at FROM users ORDER BY id ASC")
    users = [dict(u) for u in cursor.fetchall()]
    conn.close()
    return jsonify({"success": True, "users": users})

@app.route('/api/reset-data', methods=['POST'])
def reset_database():
    """Resets database with fresh demo stations, slots, and reservations."""
    init_db(force_reseed=True)
    return jsonify({"success": True, "message": "Database successfully reset to initial demo state!"})

if __name__ == '__main__':
    print("=" * 60)
    print("  EV CHARGING STATION ALLOCATION SYSTEM")
    print("  Local Server running on http://127.0.0.1:5000")
    print("=" * 60)
    app.run(host='127.0.0.1', port=5000, debug=False)
