const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const rootDir = __dirname;

app.use(cors());
app.use(express.json());
app.use(express.static(rootDir));

function hasDatabaseConfig() {
  return Boolean(
    process.env.DB_HOST &&
    process.env.DB_USER &&
    process.env.DB_NAME
  );
}

async function getConnection() {
  if (!hasDatabaseConfig()) {
    return null;
  }

  return mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

app.get('/api/health', async (req, res) => {
  if (!hasDatabaseConfig()) {
    return res.status(500).json({
      ok: false,
      message: 'Falta la configuración de MySQL. Completa .env con DB_HOST, DB_USER, DB_PASSWORD y DB_NAME.'
    });
  }

  try {
    const connection = await getConnection();
    const [rows] = await connection.execute('SELECT 1 AS ok');

    return res.json({
      ok: true,
      message: 'Conexión a MySQL correcta',
      result: rows[0]
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'No se pudo conectar a MySQL',
      error: error.message
    });
  }
});

app.get('/api/diagnostico', async (req, res) => {
  try {
    const connection = await getConnection();

    if (!connection) {
      return res.status(500).json({
        success: false,
        message: 'La base de datos aún no está configurada.'
      });
    }

    const diagnosticoId = Number(req.query.id || 0);

    if (!diagnosticoId) {
      const [rows] = await connection.execute('SELECT * FROM diagnosticos ORDER BY created_at DESC LIMIT 20');
      return res.json({ success: true, data: rows });
    }

    const [rows] = await connection.execute('SELECT * FROM diagnosticos WHERE id = ?', [diagnosticoId]);

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Diagnóstico no encontrado.' });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al consultar diagnóstico.', error: error.message });
  }
});

app.post('/api/diagnostico', async (req, res) => {
  try {
    const connection = await getConnection();

    if (!connection) {
      return res.status(500).json({
        success: false,
        message: 'La base de datos aún no está configurada.'
      });
    }

    const {
      action,
      diagnosticoId,
      nombre,
      etapa,
      area,
      score,
      totalScore,
      empresaNombre,
      etapaNegocio,
      financiera,
      contable,
      procesos,
      digital,
      estrategia
    } = req.body || {};

    if (action === 'save-result') {
      const finalNombre = empresaNombre || nombre || 'Sin nombre';
      const finalEtapa = etapaNegocio || etapa || 'No especificada';
      const finalScore = Number(totalScore || 0);

      const [existing] = await connection.execute(
        'SELECT id FROM diagnosticos WHERE empresa_nombre = ? ORDER BY created_at DESC LIMIT 1',
        [finalNombre]
      );

      if (existing && existing.length) {
        const id = existing[0].id;
        await connection.execute(
          `UPDATE diagnosticos SET etapa_negocio = ?, financiera = ?, contable = ?, procesos = ?, digital = ?, estrategia = ?, total_score = ?, updated_at = NOW() WHERE id = ?`,
          [finalEtapa, Number(financiera || 0), Number(contable || 0), Number(procesos || 0), Number(digital || 0), Number(estrategia || 0), finalScore, id]
        );
        return res.json({ success: true, id, message: 'Diagnóstico actualizado con éxito.' });
      }

      const [result] = await connection.execute(
        `INSERT INTO diagnosticos (empresa_nombre, etapa_negocio, financiera, contable, procesos, digital, estrategia, total_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [finalNombre, finalEtapa, Number(financiera || 0), Number(contable || 0), Number(procesos || 0), Number(digital || 0), Number(estrategia || 0), finalScore]
      );

      return res.json({ success: true, id: result.insertId, message: 'Diagnóstico guardado con éxito.' });
    }

    if (action === 'create') {
      const [result] = await connection.execute(
        'INSERT INTO diagnosticos (empresa_nombre, etapa_negocio) VALUES (?, ?)',
        [nombre || 'Sin nombre', etapa || 'No especificada']
      );

      return res.json({ success: true, id: result.insertId });
    }

    if (action === 'update') {
      if (!diagnosticoId || !area || typeof score !== 'number') {
        return res.status(400).json({ success: false, message: 'Faltan datos para actualizar el diagnóstico.' });
      }

      const validAreas = ['financiera', 'contable', 'procesos', 'digital', 'estrategia'];
      if (!validAreas.includes(area)) {
        return res.status(400).json({ success: false, message: 'Área no válida.' });
      }

      const [result] = await connection.execute(
        `UPDATE diagnosticos SET ${area} = ?, updated_at = NOW() WHERE id = ?`,
        [score, diagnosticoId]
      );

      return res.json({ success: true, affectedRows: result.affectedRows });
    }

    if (action === 'finalize') {
      if (!diagnosticoId || typeof totalScore !== 'number') {
        return res.status(400).json({ success: false, message: 'Falta totalScore o diagnosticoId.' });
      }

      const [result] = await connection.execute(
        'UPDATE diagnosticos SET total_score = ?, updated_at = NOW() WHERE id = ?',
        [totalScore, diagnosticoId]
      );

      return res.json({ success: true, affectedRows: result.affectedRows });
    }

    return res.status(400).json({ success: false, message: 'Acción no soportada.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al guardar el diagnóstico.', error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(rootDir, 'pages', 'index.html'));
});

app.listen(port, () => {
  console.log(`Servidor AKVO escuchando en http://localhost:${port}`);
});
