import mongoose from 'mongoose';

/**
 * Configuración de base de datos para tests
 * Conecta a una base de datos de test aislada
 */

const MONGO_TEST_URI = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/circlesfera-test';

/**
 * Configura la conexión a la base de datos de test
 */
export async function setupTestDB(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_TEST_URI);
  }
}

/**
 * Cierra la conexión a la base de datos de test
 */
export async function teardownTestDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
}

/**
 * Limpia todas las colecciones de la base de datos
 * Útil para beforeEach en tests de integración
 */
export async function clearTestDB(): Promise<void> {
  const collections = mongoose.connection.collections;
  
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

/**
 * Convierte un ID de string a ObjectId de MongoDB
 */
export function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

/**
 * Convierte un array de IDs a ObjectIds
 */
export function toObjectIds(ids: string[]): mongoose.Types.ObjectId[] {
  return ids.map(id => toObjectId(id));
}

