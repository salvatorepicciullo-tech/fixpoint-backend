const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 8080;


/* =======================
   MIDDLEWARE
======================= */
app.use(cors());
app.use(express.json());
app.get('/', (req, res) => {
  res.send('FixPoint backend online 🚀');
});

/* =======================
   DATABASE
======================= */
const dbPath = path.join(__dirname, 'fixpoint.db');
const db = new sqlite3.Database(dbPath, err => {
  if (err) {
    console.error('Errore DB:', err.message);
  } else {
    db.configure('busyTimeout', 5000);
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
    console.log('Database collegato correttamente ✅');
    initDatabase();
  }
});

/* =======================
   DEVICE TYPES
======================= */
app.get('/api/device-types', (req, res) => {
  db.all(
    'SELECT id, name, active FROM device_types ORDER BY name',
    [],
    (err, rows) => err ? res.status(500).json([]) : res.json(rows)
  );
});

app.post('/api/device-types', (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nome obbligatorio' });

  db.get(
    'SELECT id, active FROM device_types WHERE LOWER(name)=LOWER(?)',
    [name],
    (err, row) => {
      if (row && row.active === 0)
        return db.run(
          'UPDATE device_types SET active=1 WHERE id=?',
          [row.id],
          () => res.json({ success: true, reactivated: true })
        );
      if (row) return res.status(409).json({ error: 'Tipo già esistente' });

      db.run(
        'INSERT INTO device_types (name, active) VALUES (?,1)',
        [name],
        function () {
          res.json({ success: true, id: this.lastID });
        }
      );
    }
  );
});

app.put('/api/device-types/:id', (req, res) => {
  db.run(
    'UPDATE device_types SET name=? WHERE id=?',
    [req.body.name, req.params.id],
    function () {
      this.changes ? res.json({ success: true }) : res.status(404).json({});
    }
  );
});

app.delete('/api/device-types/:id', (req, res) => {
  db.get(
    'SELECT COUNT(*) cnt FROM models WHERE device_type_id=?',
    [req.params.id],
    (err, row) => {
      if (row.cnt > 0)
        return db.run(
          'UPDATE device_types SET active=0 WHERE id=?',
          [req.params.id],
          () => res.json({ success: true, disabled: true })
        );
      db.run(
        'DELETE FROM device_types WHERE id=?',
        [req.params.id],
        () => res.json({ success: true })
      );
    }
  );
});

/* =======================
   BRANDS
======================= */
app.get('/api/brands', (req, res) => {
  db.all(
    'SELECT id, name, active FROM brands ORDER BY name',
    [],
    (err, rows) => err ? res.status(500).json([]) : res.json(rows)
  );
});

app.post('/api/brands', (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nome obbligatorio' });

  db.get(
    'SELECT id, active FROM brands WHERE LOWER(name)=LOWER(?)',
    [name],
    (err, row) => {
      if (row && row.active === 0)
        return db.run(
          'UPDATE brands SET active=1 WHERE id=?',
          [row.id],
          () => res.json({ success: true, reactivated: true })
        );
      if (row) return res.status(409).json({ error: 'Marca già esistente' });

      db.run(
        'INSERT INTO brands (name, active) VALUES (?,1)',
        [name],
        function () {
          res.json({ success: true, id: this.lastID });
        }
      );
    }
  );
});

app.put('/api/brands/:id', (req, res) => {
  db.run(
    'UPDATE brands SET name=? WHERE id=?',
    [req.body.name, req.params.id],
    function () {
      this.changes ? res.json({ success: true }) : res.status(404).json({});
    }
  );
});

app.delete('/api/brands/:id', (req, res) => {
  db.get(
    'SELECT COUNT(*) cnt FROM models WHERE brand_id=?',
    [req.params.id],
    (err, row) => {
      if (row.cnt > 0)
        return db.run(
          'UPDATE brands SET active=0 WHERE id=?',
          [req.params.id],
          () => res.json({ success: true, disabled: true })
        );
      db.run(
        'DELETE FROM brands WHERE id=?',
        [req.params.id],
        () => res.json({ success: true })
      );
    }
  );
});

/* =======================
   MODELS
======================= */
app.get('/api/models', (req, res) => {
  const { device_type_id, brand_id } = req.query;
  if (!device_type_id || !brand_id) return res.json([]);
  db.all(
    'SELECT id, name FROM models WHERE device_type_id=? AND brand_id=? ORDER BY name',
    [device_type_id, brand_id],
    (err, rows) => err ? res.status(500).json([]) : res.json(rows)
  );
});

app.post('/api/models', (req, res) => {
  const { name, device_type_id, brand_id } = req.body;
  if (!name || !device_type_id || !brand_id)
    return res.status(400).json({ error: 'Dati mancanti' });

  db.get(
    'SELECT id FROM models WHERE LOWER(name)=LOWER(?) AND device_type_id=? AND brand_id=?',
    [name.trim(), device_type_id, brand_id],
    (err, row) => {
      if (row) return res.status(409).json({ error: 'Modello già esistente' });
      db.run(
        'INSERT INTO models (name, device_type_id, brand_id) VALUES (?,?,?)',
        [name.trim(), device_type_id, brand_id],
        function () {
          res.json({ success: true, id: this.lastID });
        }
      );
    }
  );
});

app.put('/api/models/:id', (req, res) => {
  db.run(
    'UPDATE models SET name=? WHERE id=?',
    [req.body.name, req.params.id],
    function () {
      this.changes ? res.json({ success: true }) : res.status(404).json({});
    }
  );
});

app.delete('/api/models/:id', (req, res) => {
  db.get(
    'SELECT COUNT(*) cnt FROM model_repairs WHERE model_id=?',
    [req.params.id],
    (err, row) => {
      if (row.cnt > 0)
        return res.status(409).json({ error: 'Modello usato nel listino' });
      db.run(
        'DELETE FROM models WHERE id=?',
        [req.params.id],
        () => res.json({ success: true })
      );
    }
  );
});

/* =======================
   REPAIRS
======================= */
app.get('/api/repairs', (req, res) => {
  db.all(
    `
    SELECT id, name, active, price
    FROM repairs
    ORDER BY name
    `,
    [],
    (err, rows) => err ? res.status(500).json([]) : res.json(rows)
  );
});

app.post('/api/repairs', (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Nome obbligatorio' });

  db.get(
    'SELECT id, active FROM repairs WHERE LOWER(name)=LOWER(?)',
    [name],
    (err, row) => {
      if (row && row.active === 0)
        return db.run(
          'UPDATE repairs SET active=1 WHERE id=?',
          [row.id],
          () => res.json({ success: true, reactivated: true })
        );
      if (row) return res.status(409).json({ error: 'Riparazione già esistente' });

      db.run(
        'INSERT INTO repairs (name, active) VALUES (?,1)',
        [name],
        function () {
          res.json({ success: true, id: this.lastID });
        }
      );
    }
  );
});

app.put('/api/repairs/:id', (req, res) => {
  db.run(
    'UPDATE repairs SET name=? WHERE id=?',
    [req.body.name, req.params.id],
    function () {
      this.changes ? res.json({ success: true }) : res.status(404).json({});
    }
  );
});

app.delete('/api/repairs/:id', (req, res) => {
  db.get(
    'SELECT COUNT(*) cnt FROM model_repairs WHERE repair_id=?',
    [req.params.id],
    (err, row) => {
      if (row.cnt > 0)
        return db.run(
          'UPDATE repairs SET active=0 WHERE id=?',
          [req.params.id],
          () => res.json({ success: true, disabled: true })
        );
      db.run(
        'DELETE FROM repairs WHERE id=?',
        [req.params.id],
        () => res.json({ success: true })
      );
    }
  );
});

/* =======================
   FIXPOINTS
======================= */

// LIST
app.get('/api/fixpoints', (req, res) => {
  db.all(
    'SELECT id, name, city, address, phone, email, active FROM fixpoints ORDER BY city, name',
    [],
    (err, rows) => err ? res.status(500).json([]) : res.json(rows)
  );
});


// CREATE
app.post('/api/fixpoints', (req, res) => {
  const { name, city, address, phone, email } = req.body;
  if (!name || !city) return res.status(400).json({ error: 'Nome e città obbligatori' });

  db.run(
    'INSERT INTO fixpoints (name, city, address, phone, email, active) VALUES (?, ?, ?, ?, ?, 1)',
    [name, city, address || null, phone || null, email || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});


// UPDATE
app.put('/api/fixpoints/:id', (req, res) => {
  const { name, city, address, phone, email } = req.body;

  if (!name || !city) {
    return res.status(400).json({ error: 'Nome e città obbligatori' });
  }

  db.run(
    `
    UPDATE fixpoints
    SET name = ?, city = ?, address = ?, phone = ?, email = ?
    WHERE id = ?
    `,
    [name, city, address || null, phone || null, email || null, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});


// DELETE (safe)
app.delete('/api/fixpoints/:id', (req, res) => {
  db.serialize(() => {
    db.run('DELETE FROM quotes WHERE fixpoint_id=?', [req.params.id]);
    db.run('DELETE FROM users WHERE fixpoint_id=?', [req.params.id]);
    db.run('DELETE FROM fixpoints WHERE id=?', [req.params.id], function () {
      res.json({ success: true });
    });
  });
});



/* =======================
   LISTINO (MODEL_REPAIRS)
======================= */

// LIST by model
app.get('/api/model-repairs', (req, res) => {
  const { model_id } = req.query;
  if (!model_id) return res.json([]);

  db.all(
    `
    SELECT
      mr.id,
      mr.price,
      r.id AS repair_id,
      r.name AS repair
    FROM model_repairs mr
    JOIN repairs r ON r.id = mr.repair_id
    WHERE mr.model_id = ?
    ORDER BY r.name
    `,
    [model_id],
    (err, rows) => err ? res.status(500).json([]) : res.json(rows)
  );
});

// CREATE or UPDATE
app.post('/api/model-repairs', (req, res) => {
  const { model_id, repair_id, price } = req.body;
  if (!model_id || !repair_id || price === undefined)
    return res.status(400).json({ error: 'Dati mancanti' });

  db.get(
    'SELECT id FROM model_repairs WHERE model_id=? AND repair_id=?',
    [model_id, repair_id],
    (err, row) => {
      if (row) {
        db.run(
          'UPDATE model_repairs SET price=? WHERE id=?',
          [price, row.id],
          () => res.json({ success: true, updated: true })
        );
      } else {
        db.run(
          'INSERT INTO model_repairs (model_id, repair_id, price) VALUES (?,?,?)',
          [model_id, repair_id, price],
          () => res.json({ success: true, created: true })
        );
      }
    }
  );
});

// DELETE
app.delete('/api/model-repairs/:id', (req, res) => {
  db.run(
    'DELETE FROM model_repairs WHERE id=?',
    [req.params.id],
    () => res.json({ success: true })
  );
});



/* =======================
   INIT DB
======================= */
function initDatabase() {
  const tables = [
    'CREATE TABLE IF NOT EXISTS device_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, active INTEGER DEFAULT 1)',
    'CREATE TABLE IF NOT EXISTS brands (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, active INTEGER DEFAULT 1)',
    'CREATE TABLE IF NOT EXISTS models (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, device_type_id INTEGER, brand_id INTEGER)',
    'CREATE TABLE IF NOT EXISTS repairs (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, active INTEGER DEFAULT 1)',
    'CREATE TABLE IF NOT EXISTS model_repairs (id INTEGER PRIMARY KEY AUTOINCREMENT, model_id INTEGER, repair_id INTEGER, price REAL)'
  ];
  tables.forEach(sql => db.run(sql));
}

/* =======================
   QUOTES (PREVENTIVI)
======================= */

// CREA PREVENTIVO
app.post('/api/quotes', (req, res) => {
  const {
    model_id,
    repair_ids,
    fixpoint_id,
    price,
    city,
    customer_name,
    customer_email,
    status
  } = req.body;

  if (!model_id || !Array.isArray(repair_ids) || repair_ids.length === 0) {
    return res.status(400).json({ error: 'Dati preventivo mancanti' });
  }

  db.run(
    `INSERT INTO quotes
     (model_id, fixpoint_id, price, city, customer_name, customer_email, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [model_id, fixpoint_id, price, city, customer_name, customer_email, status],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      const quoteId = this.lastID;

      const stmt = db.prepare(
        'INSERT INTO quote_repairs (quote_id, repair_id) VALUES (?, ?)'
      );

      repair_ids.forEach(rid => {
        stmt.run(quoteId, rid);
      });

      stmt.finalize();

      res.json({ success: true, quote_id: quoteId });
    }
  );
});

/* =======================
   QUOTES – READ & UPDATE (SAFE ADD)
======================= */

// LIST ALL QUOTES (ADMIN)
app.get('/api/quotes', (req, res) => {
  db.all(
    `
    SELECT
      q.id,
      q.price,
      q.city,
      q.status,
      q.fixpoint_id,
      q.created_at,
      q.customer_name,
      q.customer_email,
      m.name AS model,
      GROUP_CONCAT(r.name, ', ') AS repair
    FROM quotes q
    LEFT JOIN models m ON m.id = q.model_id
    LEFT JOIN quote_repairs qr ON qr.quote_id = q.id
    LEFT JOIN repairs r ON r.id = qr.repair_id
    GROUP BY q.id
    ORDER BY q.created_at DESC
    `,
    [],
    (err, rows) => {
      if (err) {
        console.error('Errore GET /api/quotes', err);
        return res.status(500).json([]);
      }
      res.json(rows);
    }
  );
});

// GET SINGLE QUOTE
app.get('/api/quotes/:id', (req, res) => {
  db.get(
    `
    SELECT
      q.*,
      m.name AS model,
      GROUP_CONCAT(r.name, ', ') AS repair
    FROM quotes q
    LEFT JOIN models m ON m.id = q.model_id
    LEFT JOIN quote_repairs qr ON qr.quote_id = q.id
    LEFT JOIN repairs r ON r.id = qr.repair_id
    WHERE q.id = ?
    GROUP BY q.id
    `,
    [req.params.id],
    (err, row) => {
      if (err || !row) return res.status(404).json({});
      res.json(row);
    }
  );
});

// ASSIGN FIXPOINT (ADMIN)
app.put('/api/quotes/:id/assign', (req, res) => {
  const { fixpoint_id } = req.body;

  db.run(
    'UPDATE quotes SET fixpoint_id=?, status="ASSIGNED" WHERE id=?',
    [fixpoint_id, req.params.id],
    function () {
      if (!this.changes) return res.status(404).json({});
      res.json({ success: true });
    }
  );
});

// CHANGE STATUS
app.put('/api/quotes/:id/status', (req, res) => {
  const { status } = req.body;

  db.run(
    'UPDATE quotes SET status=? WHERE id=?',
    [status, req.params.id],
    function () {
      if (!this.changes) return res.status(404).json({});
      res.json({ success: true });
    }
  );
});

// FIXPOINT – ONLY OWN QUOTES
app.get('/api/fixpoint/quotes', (req, res) => {
  const { fixpoint_id } = req.query;
  if (!fixpoint_id) return res.json([]);

  db.all(
    `
    SELECT
      q.id,
      q.status,
      q.city,
      q.created_at,
      m.name AS model,
      GROUP_CONCAT(r.name, ', ') AS repair
    FROM quotes q
    LEFT JOIN models m ON m.id = q.model_id
    LEFT JOIN quote_repairs qr ON qr.quote_id = q.id
    LEFT JOIN repairs r ON r.id = qr.repair_id
    WHERE q.fixpoint_id = ?
    GROUP BY q.id
    ORDER BY q.created_at DESC
    `,
    [fixpoint_id],
    (err, rows) => err ? res.status(500).json([]) : res.json(rows)
  );
});

/* =======================
   STATISTICHE (READ ONLY)
======================= */
app.get('/api/stats/overview', (req, res) => {
  db.get(
    `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'NEW' THEN 1 ELSE 0 END) AS new_count,
      SUM(CASE WHEN status = 'ASSIGNED' THEN 1 ELSE 0 END) AS assigned_count,
      SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) AS done_count,
      IFNULL(SUM(price), 0) AS total_amount
    FROM quotes
    `,
    [],
    (err, row) => {
      if (err) {
        console.error('Errore statistiche:', err);
        return res.status(500).json({});
      }
      res.json(row);
    }
  );
});

/* =======================
   STATISTICHE PDF (READ ONLY)
======================= */


app.get('/api/stats/overview/pdf', (req, res) => {
  db.get(
    `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'NEW' THEN 1 ELSE 0 END) AS new_count,
      SUM(CASE WHEN status = 'ASSIGNED' THEN 1 ELSE 0 END) AS assigned_count,
      SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) AS done_count,
      IFNULL(SUM(price), 0) AS total_amount
    FROM quotes
    `,
    [],
    (err, stats) => {
      if (err) {
        console.error('Errore PDF stats', err);
        return res.status(500).end();
      }

      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=statistiche_fixpoint.pdf'
      );

      doc.pipe(res);

      doc.fontSize(20).text('Report Statistiche FixPoint', { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(12);
      doc.text(`Totale preventivi: ${stats.total}`);
      doc.text(`Nuovi: ${stats.new_count}`);
      doc.text(`Assegnati: ${stats.assigned_count}`);
      doc.text(`Completati: ${stats.done_count}`);
      doc.moveDown();
      doc.fontSize(14).text(`Incasso totale: € ${stats.total_amount}`);

      doc.moveDown(2);
      doc.fontSize(10).text(
        `Generato il: ${new Date().toLocaleString('it-IT')}`
      );

      doc.end();
    }
  );
});

/* =======================
   PDF PREVENTIVO (ADMIN)
======================= */
app.get('/api/quotes/:id/pdf', (req, res) => {
  const quoteId = req.params.id;

  db.get(
    `
    SELECT
      q.id,
      q.price,
      q.city,
      q.status,
      q.created_at,
      q.customer_name,
      q.customer_email,
      m.name AS model,
      GROUP_CONCAT(r.name, ', ') AS repair,
      f.name AS fixpoint_name,
      f.city AS fixpoint_city,
      f.address AS fixpoint_address,
      f.phone AS fixpoint_phone
    FROM quotes q
    LEFT JOIN models m ON m.id = q.model_id
    LEFT JOIN quote_repairs qr ON qr.quote_id = q.id
    LEFT JOIN repairs r ON r.id = qr.repair_id
    LEFT JOIN fixpoints f ON f.id = q.fixpoint_id
    WHERE q.id = ?
    GROUP BY q.id
    `,
    [quoteId],
    (err, q) => {
      if (err || !q) {
        return res.status(404).json({ error: 'Preventivo non trovato' });
      }

      const doc = new PDFDocument({ margin: 50 });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=preventivo_${q.id}.pdf`
      );

      doc.pipe(res);

      // ===== HEADER
      doc
        .fontSize(18)
        .text(q.fixpoint_name || 'FixPoint', { align: 'left' })
        .fontSize(10)
        .text(q.fixpoint_city || '')
        .text(q.fixpoint_address || '')
        .text(q.fixpoint_phone || '')
        .moveDown();

      // ===== TITLE
      doc
        .fontSize(16)
        .text(`Preventivo #${q.id}`, { align: 'center' })
        .moveDown(2);

      // ===== CLIENTE
      doc.fontSize(12).text('Dati Cliente', { underline: true });
      doc
        .fontSize(10)
        .text(`Nome: ${q.customer_name}`)
        .text(`Email: ${q.customer_email}`)
        .text(`Città: ${q.city}`)
        .moveDown();

      // ===== DISPOSITIVO
      doc.fontSize(12).text('Dispositivo', { underline: true });
      doc
        .fontSize(10)
        .text(`Modello: ${q.model}`)
        .text(`Riparazioni: ${q.repair}`)
        .moveDown();

      // ===== PREZZO
      doc.fontSize(12).text('Totale', { underline: true });
      doc
        .fontSize(14)
        .text(`€ ${q.price}`, { bold: true })
        .moveDown(2);

      // ===== FOOTER
      doc
        .fontSize(9)
        .text(`Creato il: ${q.created_at}`)
        .moveDown(3)
        .text('Firma cliente: ____________________________');

      doc.end();
    }
  );
});


/* =======================
   START
======================= */


app.listen(PORT, () => {
  console.log(`Backend avviato su porta ${PORT} ✅`);
});
