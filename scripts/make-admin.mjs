import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';

// Cargar variables de entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Intentar cargar .env
try {
  const envPath = join(projectRoot, '.env');
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
} catch (err) {
  console.warn('No se encontró archivo .env, usando variables de entorno del sistema');
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || 'circlesfera';
const HANDLE = process.argv[2] || 'circlesfera';

async function makeAdmin() {
  try {
    console.log(`Conectando a MongoDB: ${MONGO_URI}`);
    console.log(`Base de datos: ${MONGO_DB_NAME}`);
    
    await mongoose.connect(MONGO_URI, {
      dbName: MONGO_DB_NAME
    });

    console.log('✅ Conectado a MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    const result = await usersCollection.updateOne(
      { handle: HANDLE.toLowerCase() },
      { $set: { isAdmin: true } }
    );

    if (result.matchedCount === 0) {
      console.error(`❌ No se encontró ningún usuario con el handle "${HANDLE}"`);
      process.exit(1);
    }

    if (result.modifiedCount === 0) {
      console.log(`ℹ️  El usuario "${HANDLE}" ya es administrador`);
    } else {
      console.log(`✅ Usuario "${HANDLE}" ahora es administrador`);
    }

    await mongoose.disconnect();
    console.log('✅ Desconectado de MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

makeAdmin();

