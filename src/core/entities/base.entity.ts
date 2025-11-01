/**
 * Identificador homogéneo para entidades de dominio. Se utiliza string para facilitar
 * interoperabilidad con MongoDB y sistemas externos.
 */
export type EntityId = string;

/**
 * Estructura mínima que toda entidad debe poseer para garantizar trazabilidad.
 */
export interface BaseEntityProps {
  readonly id: EntityId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Clase base que encapsula comportamientos comunes de una entidad de dominio.
 * Las entidades concretas deben extenderla y proveer invariantes en sus constructores.
 */
export abstract class BaseEntity<Props extends BaseEntityProps> {
  protected constructor(protected readonly props: Props) {}

  public get id(): EntityId {
    return this.props.id;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /**
   * Devuelve una copia inmutable de las propiedades de la entidad.
   */
  public toObject(): Props {
    return { ...this.props };
  }
}

