import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.BACKEND_PORT || 3000;

app.use(cors());
app.use(express.json());

const pool = new pg.Pool({
  user: process.env.DB_USER,
  host: 'localhost',
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

app.get('/health', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT NOW()');
    res.json({
      status: 'UP',
      timestamp: dbRes.rows[0].now,
      database: 'Connected'
    });
  } catch (error) {
    res.status(500).json({ status: 'DOWN', database: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend opérationnel sur http://localhost:${PORT}`);
});
