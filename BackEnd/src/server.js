/**
 * Archivo principal de la API
 * Configura Express, CORS y monta las rutas
 */
require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('./config/db'); // Abre la conexion a la base de datos
require('./config/storage'); // Configura Supabase Storage (o avisa si falta)

const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes');
const publicAuthRoutes = require('./routes/publicAuthRoutes');
const storeOrderRoutes = require('./routes/storeOrderRoutes');
const inventarioRoutes = require('./routes/inventarioRoutes');
const uploadController = require('./controllers/uploadController');
const { verifyToken, requireRole } = require('./middleware/auth');

const app = express();

// Carpeta pública de imágenes subidas (se sirve tal cual: /uploads/<archivo>)
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

// ============================================
// MIDDLEWARES
// ============================================

// Permitir peticiones desde el frontend
// CORS_ORIGIN admite varios origenes separados por coma o espacio, ej:
// CORS_ORIGIN=http://127.0.0.1:5500,http://localhost:5173
const corsOrigins = (process.env.CORS_ORIGIN || '*')
  .split(/[,\s]+/)
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins.includes('*') ? '*' : corsOrigins,
  })
);

// Leer JSON en el cuerpo de las peticiones (Body de Postman)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// RUTAS
// ============================================

// Ruta de prueba para saber que el servidor vive
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API del Proyecto Final AK funcionando 🚀',
    endpoints: {
      usuarios: '/api/users',
      productos: '/api/products',
      auth: '/api/auth',
      inventario: '/api/inventario',
    },
  });
});

app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/store-auth', publicAuthRoutes); // login público de clientes (email/Google/Apple)
app.use('/api/store-orders', storeOrderRoutes); // pedidos del carrito con factura por correo (token)
app.use('/api/inventario', inventarioRoutes);

// POST /api/uploads -> sube una imagen (solo admin) y devuelve la URL pública
const uploadMiddleware = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, _file, cb) => cb(null, `tmp-${Date.now()}-${Math.round(Math.random() * 1e9)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single('image');

app.post('/api/uploads', verifyToken, requireRole('admin'), uploadMiddleware, (err, req, res, next) => {
  // Errores típicos de multer: archivo muy grande o campo incorrecto
  if (err instanceof multer.MulterError) {
    const msg =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'La imagen supera el máximo de 5 MB'
        : `Error al subir el archivo: ${err.message}`;
    return res.status(400).json({ success: false, message: msg });
  }
  if (err) return next(err);
  next();
}, uploadController.upload);

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('Error del servidor:', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`👥 Endpoints de usuarios: http://localhost:${PORT}/api/users`);
  console.log(`🛍️  Endpoints de productos: http://localhost:${PORT}/api/products`);
  console.log(`🔐 Endpoint de login:      http://localhost:${PORT}/api/auth/login`);
});
