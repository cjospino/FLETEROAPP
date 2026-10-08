const express = require('express');
const cors = require('cors');
const db = require('./database');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('./')); // Para servir el index.html

// Tarifa base (Banderazo)
const TARIFA_FIJA_BASE = 50.00; 

// Endpoint para calcular el flete
// ==========================================
// CONFIGURACIÓN GLOBAL (ACERCAMIENTO)
// ==========================================
app.get('/api/configuracion', (req, res) => {
    db.get(`SELECT * FROM configuracion WHERE id = 1`, (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

app.put('/api/configuracion', (req, res) => {
    const { centro_operaciones, costo_km_acercamiento } = req.body;
    db.run(`UPDATE configuracion SET centro_operaciones = ?, costo_km_acercamiento = ? WHERE id = 1`, 
        [centro_operaciones, costo_km_acercamiento], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: 'Configuración actualizada' });
    });
});

// ==========================================
// CÁLCULO DEL FLETE (ACTUALIZADO)
// ==========================================
app.post('/api/calcular-flete', (req, res) => {
    // Ahora recibimos dos distancias distintas
    const { distancia_flete_km, distancia_acercamiento_km, peso_kg, tipo_carga_id } = req.body;

    db.get(`SELECT costo_por_km FROM tarifas_peso WHERE ? >= peso_min_kg AND ? <= peso_max_kg`, [peso_kg, peso_kg], (err, tarifa) => {
        if (err || !tarifa) return res.status(400).json({ error: 'No hay tarifa para este peso' });

        db.get(`SELECT recargo_porcentaje FROM tipos_carga WHERE id = ?`, [tipo_carga_id], (err, carga) => {
            if (err || !carga) return res.status(400).json({ error: 'Tipo de carga no válido' });

            // Buscar la configuración de acercamiento
            db.get(`SELECT costo_km_acercamiento FROM configuracion WHERE id = 1`, (err, config) => {
                
                const costo_km = tarifa.costo_por_km;
                const recargo_pct = carga.recargo_porcentaje;
                const costo_acercamiento_km = config.costo_km_acercamiento;

                const subtotal_flete = (distancia_flete_km * 2) * costo_km; // Ida y vuelta de la carga
                const costo_acercamiento = distancia_acercamiento_km * costo_acercamiento_km; // Solo ida del camión vacío
                const monto_recargo = subtotal_flete * (recargo_pct / 100);
                
                const total = subtotal_flete + costo_acercamiento + monto_recargo;

                res.json({
                    distancia_ida_vuelta: distancia_flete_km * 2,
                    distancia_acercamiento: distancia_acercamiento_km,
                    subtotal_distancia: subtotal_flete,
                    recargo_carga: monto_recargo,
                    tarifa_base: costo_acercamiento, // Aquí inyectamos el cobro de acercamiento
                    total_a_pagar: total
                });
            });
        });
    });
});
// ==========================================
// ENDPOINTS PARA EL PANEL MASTER (ADMIN)
// ==========================================

// 1. Leer todas las tarifas por peso
app.get('/api/tarifas', (req, res) => {
    db.all(`SELECT * FROM tarifas_peso`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. Agregar una nueva tarifa por peso
app.post('/api/tarifas', (req, res) => {
    const { peso_min_kg, peso_max_kg, costo_por_km } = req.body;
    db.run(`INSERT INTO tarifas_peso (peso_min_kg, peso_max_kg, costo_por_km) VALUES (?, ?, ?)`, 
        [peso_min_kg, peso_max_kg, costo_por_km], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, mensaje: 'Tarifa agregada exitosamente' });
    });
});

// 3. Leer todos los tipos de carga
app.get('/api/cargas', (req, res) => {
    db.all(`SELECT * FROM tipos_carga`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 4. Agregar un nuevo tipo de carga
app.post('/api/cargas', (req, res) => {
    const { nombre, recargo_porcentaje } = req.body;
    db.run(`INSERT INTO tipos_carga (nombre, recargo_porcentaje) VALUES (?, ?)`, 
        [nombre, recargo_porcentaje], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, mensaje: 'Tipo de carga agregado exitosamente' });
    });
});
// 5. Eliminar una tarifa por peso
app.delete('/api/tarifas/:id', (req, res) => {
    db.run(`DELETE FROM tarifas_peso WHERE id = ?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: 'Tarifa eliminada' });
    });
});

// 6. Eliminar un tipo de carga
app.delete('/api/cargas/:id', (req, res) => {
    db.run(`DELETE FROM tipos_carga WHERE id = ?`, req.params.id, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: 'Carga eliminada' });
    });
});
// ==========================================
// ENDPOINTS PARA LOGIN Y REGISTRO
// ==========================================

// 7. Registro de nuevos clientes
app.post('/api/registro', (req, res) => {
    const { nombre_completo, documento_identidad, email, password } = req.body;
    db.run(`INSERT INTO usuarios (rol, nombre_completo, documento_identidad, email, password) VALUES ('cliente', ?, ?, ?, ?)`,
        [nombre_completo, documento_identidad, email, password], function(err) {
        if (err) return res.status(400).json({ error: 'El correo ya está registrado o hubo un error.' });
        res.json({ mensaje: 'Registro exitoso' });
    });
});

// 8. Iniciar Sesión (Login)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT id, rol, nombre_completo FROM usuarios WHERE email = ? AND password = ?`, 
        [email, password], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
        
        res.json(user); // Devuelve los datos del usuario si es exitoso
    });
});
// ==========================================
// SOLICITUDES Y AGENDAMIENTO
// ==========================================

// ==========================================
// SOLICITUDES Y AGENDAMIENTO (CON CHISMOSOS)
// ==========================================

// Guardar una nueva solicitud del cliente
app.post('/api/solicitar-servicio', (req, res) => {
    const { usuario_id, origen, destino, fecha_servicio, monto_total, telefono } = req.body;
    
    console.log("📢 [CLIENTE]: Intentando guardar nueva solicitud...", req.body); // <-- CHISMOSO 1

    db.run(`INSERT INTO solicitudes (usuario_id, origen, destino, fecha_servicio, monto_total, telefono) VALUES (?, ?, ?, ?, ?, ?)`,
        [usuario_id, origen, destino, fecha_servicio, monto_total, telefono], function(err) {
        if (err) {
            console.log("❌ [BD ERROR]: No se pudo guardar ->", err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log("✅ [BD ÉXITO]: Solicitud guardada. ID asignado:", this.lastID); // <-- CHISMOSO 2
        res.json({ mensaje: 'Solicitud agendada con éxito', solicitud_id: this.lastID });
    });
});

// Ver las solicitudes en el Panel Master
app.get('/api/admin/solicitudes', (req, res) => {
    console.log("📢 [MASTER]: El panel Master está pidiendo la lista de solicitudes..."); // <-- CHISMOSO 3
    
    const sql = `
        SELECT s.*, u.nombre_completo, u.documento_identidad, u.email 
        FROM solicitudes s 
        LEFT JOIN usuarios u ON s.usuario_id = u.id 
        ORDER BY s.fecha_servicio ASC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.log("❌ [BD ERROR]: Falló al leer solicitudes ->", err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`📤 [MASTER]: Enviando ${rows.length} solicitudes al panel.`); // <-- CHISMOSO 4
        res.json(rows);
    });
});
// Actualizar el estado de una solicitud
app.put('/api/solicitudes/:id/estado', (req, res) => {
    const { estado } = req.body;
    db.run(`UPDATE solicitudes SET estado = ? WHERE id = ?`, [estado, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: 'Estado actualizado correctamente' });
    });
});
const nodemailer = require('nodemailer');

// Configuración del correo que avisará de nuevas solicitudes
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'fleteroapp@gmail.com',
        // OJO: Aquí luego tendrás que poner una "Contraseña de Aplicación" de Gmail, no tu clave normal.
        pass: 'AQUI_VA_TU_CONTRASEÑA_DE_APLICACION' 
    }
});

// NUEVO: Ver la lista de clientes
app.get('/api/admin/clientes', (req, res) => {
    db.all(`SELECT id, nombre_completo, documento_identidad, email FROM usuarios WHERE rol = 'cliente'`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// NUEVO: Eliminar una solicitud cancelada
app.delete('/api/solicitudes/:id', (req, res) => {
    db.run(`DELETE FROM solicitudes WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ mensaje: 'Solicitud eliminada' });
    });
});

// ==========================================
// ENCENDIDO DEL SERVIDOR
// ==========================================
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});