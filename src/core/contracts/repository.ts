import type { EntityId } from '../entities/base.entity.js';

/**
 * Contrato base para repositorios de dominio. Define operaciones mínimas que pueden
 * especializarse según la entidad. Los métodos adicionales deben declararse en
 * interfaces más específicas ubicadas en cada módulo.
 */
export interface Repository<TEntity> {
  findById(id: EntityId): Promise<TEntity | null>;
  save(entity: TEntity): Promise<void>;
  delete(id: EntityId): Promise<void>;
}

