
const express = require("express");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// CONEXIÓN CON MYSQL
const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "biblioteca",
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10
});

// PROBAR CONEXIÓN
app.get("/api/estado", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT 1 AS conectado");

        res.json({
            mensaje: "Conexión con MySQL correcta",
            conectado: rows[0].conectado === 1
        });

    } catch (error) {
        console.error("Error de conexión:", error.message);

        res.status(500).json({
            mensaje: "No se pudo conectar con MySQL"
        });
    }
});

// OBTENER LIBROS
app.get("/api/libros", async (req, res) => {
    try {
        const [libros] = await pool.query(
            "SELECT ID, Clasificacion, Titulo, Autores, Anio FROM libros"
        );

        res.json(libros);

    } catch (error) {
        console.error("Error al consultar libros:", error.message);

        res.status(500).json({
            mensaje: "No se pudieron consultar los libros"
        });
    }
});

/* REGISTRAR CLIC EN UN LIBRO */
app.post("/api/libros/:id/busqueda", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                error: "ID de libro inválido."
            });
        }

        await pool.query(
            `INSERT INTO busquedas_libros (libro_id, cantidad)
             VALUES (?, 1)
             ON DUPLICATE KEY UPDATE cantidad = cantidad + 1`,
            [id]
        );

        res.json({
            mensaje: "Búsqueda registrada."
        });

    } catch (error) {
        console.error("Error al registrar búsqueda:", error.message);

        res.status(500).json({
            error: "No se pudo registrar la búsqueda."
        });
    }
});

// GUARDAR SOLICITUDES
app.post("/api/solicitudes", async (req, res) => {
    try {
        const { titulo, autor, editorial, comentarios } = req.body;

        if (!titulo || !autor) {
            return res.status(400).json({
                error: "El título y el autor son obligatorios."
            });
        }

        await pool.query(
            `INSERT INTO solicitudes_libros
            (titulo, autor, editorial, comentarios)
            VALUES (?, ?, ?, ?)`,
            [
                titulo,
                autor,
                editorial || null,
                comentarios || null
            ]
        );

        res.status(201).json({
            mensaje: "Solicitud guardada correctamente."
        });

    } catch (error) {
        console.error("Error al guardar solicitud:", error.message);

        res.status(500).json({
            error: "No se pudo guardar la solicitud."
        });
    }
});

// CONSULTAR SOLICITUDES
app.get("/api/solicitudes", async (req, res) => {
    try {
        const [solicitudes] = await pool.query(
            `SELECT * FROM solicitudes_libros
             ORDER BY fecha_solicitud DESC`
        );

        res.json(solicitudes);

    } catch (error) {
        console.error("Error al consultar solicitudes:", error.message);

        res.status(500).json({
            error: "No se pudieron consultar las solicitudes."
        });
    }
});
// ====================================
// ACTUALIZAR ESTADO DE SOLICITUD
// ====================================

app.put("/api/solicitudes/:id/estado", async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { estado } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                error: "ID de solicitud inválido."
            });
        }

        if (!["Confirmada", "Rechazada"].includes(estado)) {
            return res.status(400).json({
                error: "Estado no válido."
            });
        }

        const [resultado] = await pool.query(
            `UPDATE solicitudes_libros
             SET estado = ?, fecha_resolucion = NOW()
             WHERE id = ? AND estado = 'Pendiente'`,
            [estado, id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                error: "No se encontró la solicitud pendiente."
            });
        }

        res.json({
            mensaje: `Solicitud ${estado.toLowerCase()} correctamente. Se eliminará después de 7 días.`
        });

    } catch (error) {
        console.error("Error al actualizar solicitud:", error);

        res.status(500).json({
            error: "No se pudo actualizar la solicitud."
        });
    }
});
// ====================================
// ELIMINAR SOLICITUDES DESPUÉS DE 7 DÍAS
// ====================================

async function eliminarSolicitudesAntiguas() {
    try {
        const [resultado] = await pool.query(`
            DELETE FROM solicitudes_libros
            WHERE estado IN ('Confirmada', 'Rechazada')
            AND fecha_resolucion IS NOT NULL
            AND fecha_resolucion <= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `);

        if (resultado.affectedRows > 0) {
            console.log(
                `Se eliminaron ${resultado.affectedRows} solicitudes antiguas.`
            );
        }

    } catch (error) {
        console.error(
            "Error al eliminar solicitudes antiguas:",
            error
        );
    }
}

// Revisar al iniciar el servidor
eliminarSolicitudesAntiguas();

// Revisar automáticamente cada hora
setInterval(eliminarSolicitudesAntiguas, 60 * 60 * 1000);
// ====================================
// LIBROS MÁS BUSCADOS
// ====================================

app.get("/api/libros-mas-buscados", async (req, res) => {
    try {
        const [resultados] = await pool.query(`
            SELECT 
                l.ID,
                l.Clasificacion,
                l.Titulo,
                l.Autores,
                l.Anio,
                b.cantidad
            FROM busquedas_libros b
            JOIN libros l ON l.ID = b.libro_id
            ORDER BY b.cantidad DESC
            LIMIT 10
        `);

        res.json(resultados);

    } catch (error) {
        console.error("Error al obtener libros más buscados:", error);
        res.status(500).json({
            error: "No se pudieron obtener los libros más buscados."
        });
    }
});
// ====================================
// ESTADÍSTICAS DE LIBROS
// ====================================

app.get("/api/estadisticas-libros", async (req, res) => {
    try {
        const [resultados] = await pool.query(`
            SELECT 
                l.Titulo,
                b.cantidad
            FROM busquedas_libros b
            JOIN libros l ON l.ID = b.libro_id
            ORDER BY b.cantidad DESC
            LIMIT 10
        `);

        const [total] = await pool.query(`
            SELECT SUM(cantidad) AS total
            FROM busquedas_libros
        `);


const [materias] = await pool.query(`
    SELECT
        l.Clasificacion,
        SUM(b.cantidad) AS cantidad
    FROM busquedas_libros b
    JOIN libros l ON l.ID = b.libro_id
    GROUP BY l.Clasificacion
    ORDER BY cantidad DESC
    LIMIT 10
`);


       res.json({
    libros: resultados,
    total: total[0].total || 0,
    materias: materias

        });

    } catch (error) {
        console.error("Error al obtener estadísticas:", error);
        res.status(500).json({
            error: "No se pudieron obtener las estadísticas."
        });
    }
});

// INICIAR SERVIDOR
app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
