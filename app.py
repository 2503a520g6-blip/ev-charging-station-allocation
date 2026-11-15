            user_id = db.fetchone()['id']
        else:
            db.execute("""
            INSERT INTO users (username, password_hash, full_name, email, role, vehicle_model, vehicle_plate, preferred_connector)
            VALUES (?, ?, ?, ?, 'user', ?, ?, ?)
            """, (username, hash_password(password), full_name, email, vehicle_model, vehicle_plate, preferred_connector))
            user_id = db.lastrowid
        db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        new_user = db.fetchone()
    new_user.pop('password_hash', None)
    return jsonify({"success": True, "message": "User registered successfully", "user": new_user}), 201
@app.route('/api/users', methods=['GET'])
def list_users():
    with get_db() as db:
        db.execute("SELECT id, username, full_name, email, role, vehicle_model, vehicle_plate, preferred_connector, battery_capacity_kwh, created_at FROM users ORDER BY id ASC")
        users = db.fetchall()
    return jsonify({"success": True, "users": users})
@app.route('/api/reset-data', methods=['POST'])
def reset_database():
    """Resets database with fresh demo stations, slots, and reservations."""
    init_db(force_reseed=True)
    return jsonify({"success": True, "message": "Database successfully reset to initial demo state!"})
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print("=" * 60)
    print("  EV CHARGING STATION ALLOCATION SYSTEM")
    print(f"  Server running on http://127.0.0.1:{port}")
    print("=" * 60)
    app.run(host='0.0.0.0', port=port, debug=False)
