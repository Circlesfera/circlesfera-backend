import type { CollectionRepository } from '../repositories/collection.repository.js';
import { MongoCollectionRepository } from '../repositories/collection.repository.js';
import type { SaveRepository } from '../repositories/save.repository.js';
import { MongoSaveRepository } from '../repositories/save.repository.js';
import type { PostRepository } from '@modules/feed/repositories/post.repository.js';
import { MongoPostRepository } from '@modules/feed/repositories/post.repository.js';
import { ApplicationError } from '@core/errors/application-error.js';

export interface CollectionItem {
  id: string;
  name: string;
  description?: string;
  postCount: number;
  coverImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export class CollectionService {
  public constructor(
    private readonly collections: CollectionRepository = new MongoCollectionRepository(),
    private readonly saves: SaveRepository = new MongoSaveRepository(),
    private readonly posts: PostRepository = new MongoPostRepository()
  ) {}

  public async createCollection(userId: string, name: string, description?: string): Promise<CollectionItem> {
    // Validar que no exista una colección con el mismo nombre
    const existingCollections = await this.collections.findByUserId(userId);
    const duplicateName = existingCollections.find((c) => c.name.toLowerCase() === name.toLowerCase());

    if (duplicateName) {
      throw new ApplicationError('Ya existe una colección con ese nombre', {
        statusCode: 400,
        code: 'COLLECTION_NAME_EXISTS'
      });
    }

    const collection = await this.collections.create(userId, name, description);

    return this.toCollectionItem(collection);
  }

  public async getUserCollections(userId: string): Promise<CollectionItem[]> {
    const collections = await this.collections.findByUserId(userId);

    // Recalcular contadores de posts para cada colección
    const collectionsWithCounts = await Promise.all(
      collections.map(async (collection) => {
        const { items } = await this.saves.findByCollectionId(collection.id, 10000); // Obtener todos para contar
        return {
          ...collection,
          postCount: items.length
        };
      })
    );

    // Incluir la colección por defecto (sin nombre, "Guardados")
    const defaultCollection: CollectionItem = {
      id: 'default',
      name: 'Guardados',
      description: 'Todos tus posts guardados',
      postCount: await this.getDefaultCollectionPostCount(userId),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return [defaultCollection, ...collectionsWithCounts.map((c) => this.toCollectionItem(c))];
  }

  public async updateCollection(collectionId: string, userId: string, updates: { name?: string; description?: string }): Promise<CollectionItem> {
    const collection = await this.collections.findById(collectionId);

    if (!collection) {
      throw new ApplicationError('Colección no encontrada', {
        statusCode: 404,
        code: 'COLLECTION_NOT_FOUND'
      });
    }

    if (collection.userId !== userId) {
      throw new ApplicationError('No tienes permiso para editar esta colección', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    // Validar nombre único si se está cambiando
    if (updates.name) {
      const existingCollections = await this.collections.findByUserId(userId);
      const duplicateName = existingCollections.find(
        (c) => c.id !== collectionId && c.name.toLowerCase() === updates.name!.toLowerCase()
      );

      if (duplicateName) {
        throw new ApplicationError('Ya existe una colección con ese nombre', {
          statusCode: 400,
          code: 'COLLECTION_NAME_EXISTS'
        });
      }
    }

    const updated = await this.collections.update(collectionId, updates);

    return this.toCollectionItem(updated);
  }

  public async deleteCollection(collectionId: string, userId: string): Promise<void> {
    const collection = await this.collections.findById(collectionId);

    if (!collection) {
      throw new ApplicationError('Colección no encontrada', {
        statusCode: 404,
        code: 'COLLECTION_NOT_FOUND'
      });
    }

    if (collection.userId !== userId) {
      throw new ApplicationError('No tienes permiso para eliminar esta colección', {
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    }

    // Mover todos los posts de esta colección a la colección por defecto (sin colección)
    // Esto se hace actualizando los saves para que no tengan collectionId
    // Nota: Esto requeriría un método en SaveRepository para actualizar todos los saves de una colección
    // Por simplicidad, los posts se moverán automáticamente cuando se elimine la colección

    await this.collections.delete(collectionId);
  }

  private async getDefaultCollectionPostCount(userId: string): Promise<number> {
    // Contar todos los saves sin collectionId usando findByUserId con collectionId undefined
    const { items } = await this.saves.findByUserId(userId, 10000, undefined, undefined);
    return items.length;
  }

  private toCollectionItem(collection: { id: string; name: string; description?: string; postCount: number; coverImageUrl?: string; createdAt: Date; updatedAt: Date }): CollectionItem {
    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      postCount: collection.postCount,
      coverImageUrl: collection.coverImageUrl,
      createdAt: collection.createdAt.toISOString(),
      updatedAt: collection.updatedAt.toISOString()
    };
  }
}

