import { CacheService } from '@infra/cache/cache.service.js';
import type { UserDomain } from '../models/user.model.js';
import type { UserRepository } from './user.repository.js';
import { MongoUserRepository } from './user.repository.js';

/**
 * Wrapper del UserRepository con cache Redis.
 * Cachea usuarios frecuentemente accedidos para mejorar performance.
 */
export class CachedUserRepository implements UserRepository {
  private readonly repository: UserRepository = new MongoUserRepository();
  private readonly cache: CacheService = new CacheService();

  private userCacheKey(userId: string): string {
    return this.cache.buildKey('user', userId);
  }

  public async create(data: Parameters<UserRepository['create']>[0]): Promise<UserDomain> {
    const user = await this.repository.create(data);
    // No cachear usuarios nuevos automáticamente
    return user;
  }

  public async findByEmail(email: string): Promise<UserDomain | null> {
    // No cachear por email (menos frecuente y puede cambiar)
    return this.repository.findByEmail(email);
  }

  public async findByHandle(handle: string): Promise<UserDomain | null> {
    const cacheKey = this.cache.buildKey('user', 'handle', handle.toLowerCase());
    const cached = await this.cache.get<UserDomain>(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.repository.findByHandle(handle);
    if (user) {
      // Cache por 30 minutos
      await this.cache.set(cacheKey, user, 1800);
    }
    return user;
  }

  public async findById(id: string): Promise<UserDomain | null> {
    const cacheKey = this.userCacheKey(id);
    const cached = await this.cache.get<UserDomain>(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.repository.findById(id);
    if (user) {
      // Cache por 30 minutos
      await this.cache.set(cacheKey, user, 1800);
    }
    return user;
  }

  public async findManyByIds(ids: readonly string[]): Promise<UserDomain[]> {
    if (ids.length === 0) {
      return [];
    }

    // Intentar obtener del cache
    const cacheKeys = ids.map((id) => this.userCacheKey(id));
    const cachedUsers = await this.cache.mget<UserDomain>(cacheKeys);
    const cachedMap = new Map<string, UserDomain>();
    const missingIds: string[] = [];

    cachedUsers.forEach((user, index) => {
      if (user) {
        cachedMap.set(ids[index], user);
      } else {
        missingIds.push(ids[index]);
      }
    });

    // Si todos están en cache, devolver
    if (missingIds.length === 0) {
      return ids.map((id) => cachedMap.get(id)!).filter(Boolean);
    }

    // Buscar los faltantes en la BD
    const users = await this.repository.findManyByIds(missingIds);
    const usersMap = new Map(users.map((u) => [u.id, u]));

    // Cachear los usuarios encontrados
    const cacheEntries = users.map((user) => ({
      key: this.userCacheKey(user.id),
      value: user,
      ttl: 1800 // 30 minutos
    }));
    await this.cache.mset(cacheEntries);

    // Combinar resultados
    return ids.map((id) => cachedMap.get(id) || usersMap.get(id)!).filter(Boolean);
  }

  public async findManyByHandles(handles: readonly string[]): Promise<UserDomain[]> {
    // Por simplicidad, no cacheamos por handles (menos frecuente)
    return this.repository.findManyByHandles(handles);
  }

  public async searchUsers(options: Parameters<UserRepository['searchUsers']>[0]): Promise<UserDomain[]> {
    // No cachear búsquedas (son muy variadas)
    return this.repository.searchUsers(options);
  }

  public async update(userId: string, payload: Parameters<UserRepository['update']>[1]): Promise<void> {
    await this.repository.update(userId, payload);
    // Invalidar cache del usuario después de actualizar
    await this.cache.delete(this.userCacheKey(userId));
    // También invalidar por handle si es necesario (necesitamos obtener el usuario actualizado)
    const user = await this.repository.findById(userId);
    if (user) {
      await this.cache.delete(this.cache.buildKey('user', 'handle', user.handle.toLowerCase()));
    }
  }

  public async updateById(userId: string, payload: Parameters<UserRepository['updateById']>[1]): Promise<UserDomain | null> {
    const user = await this.repository.updateById(userId, payload);
    if (user) {
      // Invalidar cache del usuario
      await this.cache.delete(this.userCacheKey(userId));
      await this.cache.delete(this.cache.buildKey('user', 'handle', user.handle.toLowerCase()));
    }
    return user;
  }

  public async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.repository.updatePassword(userId, passwordHash);
    // No invalidar cache, la contraseña no se cachea
  }

  public async deleteById(userId: string): Promise<void> {
    const user = await this.repository.findById(userId);
    await this.repository.deleteById(userId);
    // Invalidar cache después de eliminar
    if (user) {
      await this.cache.delete(this.userCacheKey(userId));
      await this.cache.delete(this.cache.buildKey('user', 'handle', user.handle.toLowerCase()));
    }
  }
}

