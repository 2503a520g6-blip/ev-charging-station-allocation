"""
EV Charging Station Allocation System - Database Management & Seeder
Using SQLite for local, fast, zero-dependency data storage.
"""

import sqlite3
import os
import hashlib
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ev_charging.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def init_db(force_reseed=False):
    db_exists = os.path.exists(DB_PATH)
    conn = get_db_connection()
    cursor = conn.cursor()

    if force_reseed and db_exists:
        cursor.execute("DROP TABLE IF EXISTS reservations")
        cursor.execute("DROP TABLE IF EXISTS slots")
        cursor.execute("DROP TABLE IF EXISTS stations")
        cursor.execute("DROP TABLE IF EXISTS users")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        vehicle_model TEXT,
        vehicle_plate TEXT,
        preferred_connector TEXT DEFAULT 'CCS2',
        battery_capacity_kwh REAL DEFAULT 50.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS stations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        zone TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        total_slots INTEGER NOT NULL,
        power_kw REAL NOT NULL,
        connector_types TEXT NOT NULL,
        price_per_kwh REAL NOT NULL,
        operator TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        station_id INTEGER NOT NULL,
        slot_number INTEGER NOT NULL,
        slot_type TEXT NOT NULL,
        power_kw REAL NOT NULL,
        connector_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Available',
        vehicle_number TEXT,
        current_reservation_id INTEGER,
        FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reservation_code TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        station_id INTEGER NOT NULL,
        slot_id INTEGER NOT NULL,
        vehicle_model TEXT NOT NULL,
        vehicle_plate TEXT NOT NULL,
        connector_type TEXT NOT NULL,
        charging_speed_kw REAL NOT NULL,
        start_time TEXT NOT NULL,
        duration_hours REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'Active',
        estimated_energy_kwh REAL NOT NULL,
        estimated_cost REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE,
        FOREIGN KEY (slot_id) REFERENCES slots(id) ON DELETE CASCADE
    )
    """)

    conn.commit()

    # Check if stations table is empty; if so, seed sample data
    cursor.execute("SELECT COUNT(*) FROM stations")
    station_count = cursor.fetchone()[0]

    if station_count == 0 or force_reseed:
        seed_sample_data(conn)

    conn.close()

def seed_sample_data(conn):
    cursor = conn.cursor()

    # Default Users
    users_data = [
        ('admin', hash_password('admin123'), 'System Administrator', 'admin@evcharge.org', 'admin', 'Tesla Model 3', 'EV-ADM-001', 'CCS2', 75.0),
        ('alex_ev', hash_password('user123'), 'Alex Rivera', 'alex.rivera@example.com', 'user', 'Hyundai Ioniq 5', 'KA-01-EV-4421', 'CCS2', 72.6),
        ('sarah_k', hash_password('user123'), 'Sarah Koenig', 'sarah.k@example.com', 'user', 'Tata Nexon EV Max', 'DL-04-EV-8890', 'CCS2', 40.5),
        ('david_lee', hash_password('user123'), 'David Lee', 'david.lee@example.com', 'user', 'MG ZS EV', 'MH-02-EV-1902', 'CCS2', 50.3),
        ('priya_sharma', hash_password('user123'), 'Priya Sharma', 'priya.s@example.com', 'user', 'Nissan Leaf', 'TN-07-EV-3114', 'CHAdeMO', 40.0),
    ]

    cursor.executemany("""
    INSERT OR IGNORE INTO users (username, password_hash, full_name, email, role, vehicle_model, vehicle_plate, preferred_connector, battery_capacity_kwh)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, users_data)

    # 12 Sample EV Charging Stations across urban & highway clusters (Central lat: 12.9716, lng: 77.5946 or normalized 13.00, 77.60)
    stations_data = [
        ("Cyber City Tech Hub", "Plot 14, Electronics City Phase 1", "Bengaluru", "South Sector", 12.8452, 77.6602, 6, 120.0, "CCS2, Type 2, CHAdeMO", 15.50, "Tata Power EZ", "Active"),
        ("Downtown Central Metro", "Station Road, Near MG Road Metro", "Bengaluru", "Central Zone", 12.9752, 77.6062, 8, 150.0, "CCS2, Type 2", 18.00, "ChargeZone Super", "Active"),
        ("Airport Terminal 2 Express", "T2 Forecourt, Kempegowda Airport", "Bengaluru", "North Sector", 13.2008, 77.7088, 6, 240.0, "CCS2, CHAdeMO", 21.00, "Jio-bp pulse", "Active"),
        ("Green Valley Eco Park", "Eco Boulevard, HSR Layout Sector 2", "Bengaluru", "South-East", 12.9121, 77.6446, 4, 50.0, "CCS2, Type 2", 13.50, "Statiq Green", "Active"),
        ("Horizon Galleria Mall", "Level B2, Bannerghatta Main Road", "Bengaluru", "South Sector", 12.8985, 77.5998, 6, 60.0, "CCS2, Type 2", 16.00, "Zeon Charging", "Active"),
        ("Highway Rest Stop KM 42", "Bengaluru-Mysuru Expressway Toll Plaza", "Ramanagara", "Highway Zone", 12.7214, 77.2831, 6, 180.0, "CCS2, CHAdeMO", 19.50, "Shell Recharge", "Active"),
        ("North Suburb Community Hub", "Hebbal Outer Ring Road, Near Flyover", "Bengaluru", "North Sector", 13.0358, 77.5970, 4, 30.0, "Type 2, CCS2", 12.00, "Tata Power EZ", "Active"),
        ("South University Campus", "Kengeri Satellite Town, Tech Block", "Bengaluru", "West Sector", 12.9150, 77.4820, 4, 50.0, "CCS2, Type 2", 14.00, "Statiq Clean", "Active"),
        ("Harbor View Financial Park", "Financial District, Whitefield Main Rd", "Bengaluru", "East Sector", 12.9698, 77.7499, 6, 120.0, "CCS2, Type 2", 17.50, "ChargeZone", "Active"),
        ("West Hills Residential Grid", "8th Main, Malleshwaram West", "Bengaluru", "North-West", 13.0031, 77.5685, 4, 22.0, "Type 2", 11.50, "BESCOM EV Hub", "Active"),
        ("East Gateway Logistics Center", "Hosakote Industrial Area", "Bengaluru", "East Outer", 13.0715, 77.7981, 6, 150.0, "CCS2, CHAdeMO", 16.50, "Jio-bp pulse", "Active"),
        ("Grand Central Railway Hub", "Krantivira Sangolli Rayanna Station", "Bengaluru", "Central Zone", 12.9781, 77.5694, 6, 100.0, "CCS2, Type 2", 15.00, "Zeon Fast", "Active")
    ]

    for station in stations_data:
        cursor.execute("""
        INSERT INTO stations (name, address, city, zone, latitude, longitude, total_slots, power_kw, connector_types, price_per_kwh, operator, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, station)
        station_id = cursor.lastrowid
        total_slots = station[6]
        power_kw = station[7]
        connectors = [c.strip() for c in station[8].split(',')]

        # Populate individual slots for each station
        for s_idx in range(1, total_slots + 1):
            conn_type = connectors[(s_idx - 1) % len(connectors)]
            slot_type = "Ultra Fast DC" if power_kw >= 150 else ("Fast DC" if power_kw >= 50 else "Standard AC")
            
            # Create a realistic initial state: roughly 65% available, 25% occupied, 10% reserved/maintenance
            status = 'Available'
            vehicle_plate = None
            if s_idx == 1 and station_id in [1, 2, 5, 6, 9]:
                status = 'Occupied'
                vehicle_plate = f"EV-{100 + station_id * 7}-ACT"
            elif s_idx == 2 and station_id in [2, 3, 6, 10]:
                status = 'Occupied'
                vehicle_plate = f"EV-{200 + station_id * 5}-PWR"
            elif s_idx == 3 and station_id in [1, 3]:
                status = 'Reserved'
                vehicle_plate = f"EV-{300 + station_id * 3}-RSV"
            elif s_idx == total_slots and station_id == 6:
                status = 'Maintenance'

            cursor.execute("""
            INSERT INTO slots (station_id, slot_number, slot_type, power_kw, connector_type, status, vehicle_number)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (station_id, s_idx, slot_type, power_kw, conn_type, status, vehicle_plate))

    # Pre-seed active & pending reservations
    now = datetime.now()
    sample_reservations = [
        ("RES-2026-9041", 2, 1, 3, "Hyundai Ioniq 5", "KA-01-EV-4421", "CCS2", 120.0, (now - timedelta(minutes=15)).strftime("%Y-%m-%d %H:%M"), 1.0, "Active", 35.0, 542.50),
        ("RES-2026-9042", 3, 2, 1, "Tata Nexon EV Max", "DL-04-EV-8890", "CCS2", 150.0, (now - timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M"), 0.75, "Active", 28.5, 513.00),
        ("RES-2026-9043", 4, 3, 3, "MG ZS EV", "MH-02-EV-1902", "CCS2", 240.0, (now + timedelta(minutes=45)).strftime("%Y-%m-%d %H:%M"), 1.0, "Pending", 38.0, 798.00),
        ("RES-2026-9044", 5, 6, 1, "Nissan Leaf", "TN-07-EV-3114", "CHAdeMO", 180.0, (now - timedelta(minutes=40)).strftime("%Y-%m-%d %H:%M"), 0.5, "Active", 22.0, 429.00),
        ("RES-2026-9039", 2, 5, 2, "Hyundai Ioniq 5", "KA-01-EV-4421", "CCS2", 60.0, (now - timedelta(days=1, hours=3)).strftime("%Y-%m-%d %H:%M"), 1.5, "Completed", 45.0, 720.00),
        ("RES-2026-9035", 3, 4, 1, "Tata Nexon EV Max", "DL-04-EV-8890", "Type 2", 50.0, (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M"), 1.0, "Completed", 30.0, 405.00),
    ]

    cursor.executemany("""
    INSERT INTO reservations (reservation_code, user_id, station_id, slot_id, vehicle_model, vehicle_plate, connector_type, charging_speed_kw, start_time, duration_hours, status, estimated_energy_kwh, estimated_cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, sample_reservations)

    conn.commit()

if __name__ == '__main__':
    print("Initializing EV Charging Station Database...")
    init_db(force_reseed=True)
    print("Database initialized and sample data seeded successfully at:", DB_PATH)
