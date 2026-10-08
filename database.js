const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./fletero.db');

db.serialize(() => {
    // 1. Tabla Tipos de Carga
    db.run(`CREATE TABLE IF NOT EXISTS tipos_carga (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT,
        recargo_porcentaje REAL
    )`);

    // 2. Tabla Tarifas por Peso
    db.run(`CREATE TABLE IF NOT EXISTS tarifas_peso (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        peso_min_kg INTEGER,
        peso_max_kg INTEGER,
        costo_por_km REAL
    )`);

    // 3. NUEVA: Tabla de Usuarios (Clientes y Admin)
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rol TEXT,
        nombre_completo TEXT,
        documento_identidad TEXT,
        email TEXT UNIQUE,
        password TEXT
    )`);

    // Crear TU usuario administrador por defecto (si no existe)
    db.get("SELECT COUNT(*) AS count FROM usuarios WHERE rol = 'admin'", (err, row) => {
        if (row.count === 0) {
            db.run(`INSERT INTO usuarios (rol, nombre_completo, documento_identidad, email, password) VALUES 
                ('admin', 'Master Fletero', 'V-Master', 'admin@fletero.app', 'admin123')`);
        }
    });
// 4. NUEVA: Tabla de Configuración Global (Para el costo de acercamiento)
    db.run(`CREATE TABLE IF NOT EXISTS configuracion (
        id INTEGER PRIMARY KEY,
        centro_operaciones TEXT,
        costo_km_acercamiento REAL
    )`);

    // Insertar valores por defecto si está vacía
    db.get("SELECT COUNT(*) AS count FROM configuracion", (err, row) => {
        if (row.count === 0) {
            db.run(`INSERT INTO configuracion (id, centro_operaciones, costo_km_acercamiento) VALUES (1, 'Valencia, Carabobo, Venezuela', 0.50)`);
        }
    });
    // 5. NUEVA: Tabla de Solicitudes/Agendamientos
    db.run(`CREATE TABLE IF NOT EXISTS solicitudes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        origen TEXT,
        destino TEXT,
        fecha_servicio TEXT,
        monto_total REAL,
        estado TEXT DEFAULT 'Pendiente',
        fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    // Forzar la creación de la columna telefono por si no existe
    db.run(`ALTER TABLE solicitudes ADD COLUMN telefono TEXT`, (err) => { 
        /* Si da error es porque ya existe, lo ignoramos */ 
    });
    console.log("Base de datos inicializada y tablas creadas (incluyendo usuarios).");
});

module.exports = db;