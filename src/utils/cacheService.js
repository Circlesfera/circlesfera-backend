const logger = require('./logger');

/**
 * Servicio de caché en memoria para optimizar consultas frecuentes
 * En producción, esto debería usar Redis para escalabilidad
 */
class CacheService {
  constructor() {
    this.cache = new Map();
    this.ttlMap = new Map();

    // Limpiar caché expirada cada 5 minutos
    setInterval(
      () => {
        this.cleanExpired();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Obtener valor del caché
   * @param {string} key - Clave del caché
   * @returns {any|null} Valor almacenado o null si no existe o expiró
   */
  get(key) {
    const ttl = this.ttlMap.get(key);

    if (ttl && ttl < Date.now()) {
      // Expirado
      this.delete(key);
      return null;
    }

    return this.cache.get(key) || null;
  }

  /**
   * Guardar valor en caché
   * @param {string} key - Clave del caché
   * @param {any} value - Valor a almacenar
   * @param {number} ttlSeconds - Tiempo de vida en segundos (default: 5 minutos)
   */
  set(key, value, ttlSeconds = 300) {
    this.cache.set(key, value);

    if (ttlSeconds > 0) {
      const expiresAt = Date.now() + ttlSeconds * 1000;
      this.ttlMap.set(key, expiresAt);
    }
  }

  /**
   * Eliminar valor del caché
   * @param {string} key - Clave a eliminar
   */
  delete(key) {
    this.cache.delete(key);
    this.ttlMap.delete(key);
  }

  /**
   * Eliminar múltiples claves que coincidan con un patrón
   * @param {string} pattern - Patrón de búsqueda (ej: 'user:*')
   */
  deletePattern(pattern) {
    const regex = new RegExp(pattern.replace('*', '.*'));
    const keys = Array.from(this.cache.keys());

    keys.forEach(key => {
      if (regex.test(key)) {
        this.delete(key);
      }
    });
  }

  /**
   * Limpiar todo el caché
   */
  clear() {
    this.cache.clear();
    this.ttlMap.clear();
    logger.info('Caché completamente limpiado');
  }

  /**
   * Limpiar entradas expiradas
   */
  cleanExpired() {
    const now = Date.now();
    let cleanedCount = 0;

    this.ttlMap.forEach((expiresAt, key) => {
      if (expiresAt < now) {
        this.delete(key);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      logger.info(`Limpiadas ${cleanedCount} entradas de caché expiradas`);
    }
  }

  /**
   * Obtener o crear valor en caché
   * @param {string} key - Clave del caché
   * @param {Function} fetchFn - Función asíncrona para obtener el valor si no está en caché
   * @param {number} ttlSeconds - Tiempo de vida en segundos
   * @returns {Promise<any>} Valor del caché o resultado de fetchFn
   */
  async getOrSet(key, fetchFn, ttlSeconds = 300) {
    const cached = this.get(key);

    if (cached !== null) {
      return cached;
    }

    const value = await fetchFn();
    this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Obtener estadísticas del caché
   * @returns {Object} Estadísticas del caché
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()).slice(0, 10), // Primeras 10 claves
    };
  }
}

// Exportar instancia única (singleton)
const cacheService = new CacheService();

module.exports = cacheService;
