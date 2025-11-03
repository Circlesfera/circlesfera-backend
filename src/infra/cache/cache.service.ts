import { getRedisClient } from './redis/connection.js';
import { logger } from '@infra/logger/logger.js';

export interface CacheOptions {
  ttl?: number; // Time to live en segundos
  prefix?: string; // Prefijo para la key
}

/**
 * Servicio genérico de cache usando Redis.
 * Proporciona métodos para set, get, delete e invalidación de cache.
 */
export class CacheService {
  private readonly redis = getRedisClient();

  /**
   * Obtiene un valor del cache.
   * @param key - Clave del cache
   * @returns Valor parseado o null si no existe
   */
  public async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      logger.warn({ err: error, key }, 'Error al obtener del cache');
      return null;
    }
  }

  /**
   * Guarda un valor en el cache.
   * @param key - Clave del cache
   * @param value - Valor a guardar (será serializado como JSON)
   * @param ttl - Tiempo de vida en segundos (opcional)
   */
  public async set(key: string, value: unknown, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      logger.warn({ err: error, key }, 'Error al guardar en cache');
      // No lanzar error, solo loggear - el cache es opcional
    }
  }

  /**
   * Elimina una clave del cache.
   * @param key - Clave a eliminar
   */
  public async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.warn({ err: error, key }, 'Error al eliminar del cache');
    }
  }

  /**
   * Elimina múltiples claves del cache usando un patrón.
   * @param pattern - Patrón de claves (ej: "feed:home:*")
   */
  public async deleteByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      logger.warn({ err: error, pattern }, 'Error al eliminar por patrón del cache');
    }
  }

  /**
   * Construye una clave de cache con prefijo.
   * @param prefix - Prefijo
   * @param parts - Partes de la clave
   * @returns Clave completa
   */
  public buildKey(prefix: string, ...parts: (string | number | undefined)[]): string {
    const filtered = parts.filter((p) => p !== undefined && p !== null);
    return `${prefix}:${filtered.join(':')}`;
  }

  /**
   * Obtiene múltiples valores del cache.
   * @param keys - Array de claves
   * @returns Array de valores (null para valores no encontrados)
   */
  public async mget<T>(keys: string[]): Promise<Array<T | null>> {
    if (keys.length === 0) {
      return [];
    }

    try {
      const values = await this.redis.mget(...keys);
      return values.map((value) => {
        if (!value) {
          return null;
        }
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      logger.warn({ err: error, keysCount: keys.length }, 'Error al obtener múltiples valores del cache');
      return keys.map(() => null);
    }
  }

  /**
   * Guarda múltiples valores en el cache.
   * @param entries - Array de [key, value, ttl?]
   */
  public async mset(
    entries: Array<{ key: string; value: unknown; ttl?: number }>
  ): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    try {
      // Usar pipeline para mejor performance
      const pipeline = this.redis.pipeline();
      for (const entry of entries) {
        const serialized = JSON.stringify(entry.value);
        if (entry.ttl) {
          pipeline.setex(entry.key, entry.ttl, serialized);
        } else {
          pipeline.set(entry.key, serialized);
        }
      }
      await pipeline.exec();
    } catch (error) {
      logger.warn({ err: error, entriesCount: entries.length }, 'Error al guardar múltiples valores en cache');
    }
  }
}

