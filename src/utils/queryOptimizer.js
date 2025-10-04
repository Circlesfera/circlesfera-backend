const logger = require('./logger');

/**
 * Utilidades para optimizar queries de MongoDB
 */

/**
 * Builder de queries optimizadas
 */
class QueryBuilder {
  constructor(model, query = {}) {
    this.model = model;
    this.query = query;
    this.options = {
      lean: true,
      select: null,
      populate: null,
      sort: null,
      skip: 0,
      limit: 10,
    };
  }

  /**
   * Usar lean() para retornar objetos planos (más rápido)
   */
  useLean(value = true) {
    this.options.lean = value;
    return this;
  }

  /**
   * Seleccionar solo campos necesarios
   */
  select(fields) {
    this.options.select = fields;
    return this;
  }

  /**
   * Popular referencias
   */
  populate(path, select) {
    if (!this.options.populate) {
      this.options.populate = [];
    }
    this.options.populate.push({ path, select });
    return this;
  }

  /**
   * Ordenar resultados
   */
  sort(sortBy) {
    this.options.sort = sortBy;
    return this;
  }

  /**
   * Paginación
   */
  paginate(page = 1, limit = 10) {
    this.options.skip = (page - 1) * limit;
    this.options.limit = limit;
    return this;
  }

  /**
   * Ejecutar query
   */
  async exec() {
    const startTime = Date.now();

    let queryChain = this.model.find(this.query);

    if (this.options.select) {
      queryChain = queryChain.select(this.options.select);
    }

    if (this.options.populate) {
      this.options.populate.forEach(pop => {
        queryChain = queryChain.populate(pop.path, pop.select);
      });
    }

    if (this.options.sort) {
      queryChain = queryChain.sort(this.options.sort);
    }

    if (this.options.skip) {
      queryChain = queryChain.skip(this.options.skip);
    }

    if (this.options.limit) {
      queryChain = queryChain.limit(this.options.limit);
    }

    if (this.options.lean) {
      queryChain = queryChain.lean();
    }

    const results = await queryChain;
    const executionTime = Date.now() - startTime;

    // Log queries lentas (> 100ms)
    if (executionTime > 100) {
      logger.warn('Slow query detected', {
        model: this.model.modelName,
        query: this.query,
        executionTime: `${executionTime}ms`,
      });
    }

    return results;
  }

  /**
   * Contar documentos
   */
  async count() {
    return this.model.countDocuments(this.query);
  }

  /**
   * Ejecutar con paginación completa
   */
  async execWithPagination(page = 1, limit = 10) {
    this.paginate(page, limit);

    const [results, total] = await Promise.all([
      this.exec(),
      this.count(),
    ]);

    return {
      results,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }
}

/**
 * Crear query optimizada
 */
const optimizedQuery = (model, query = {}) => {
  return new QueryBuilder(model, query);
};

/**
 * Batch loading de documentos
 * Útil para evitar N+1 queries
 */
const batchLoad = async (model, ids, select = null) => {
  const query = model.find({ _id: { $in: ids } });

  if (select) {
    query.select(select);
  }

  const results = await query.lean();

  // Crear map para acceso rápido
  const map = new Map();
  results.forEach(doc => {
    map.set(doc._id.toString(), doc);
  });

  return map;
};

/**
 * Proyección estándar para usuarios públicos
 */
const USER_PUBLIC_PROJECTION = 'username avatar fullName bio isVerified followersCount followingCount';

/**
 * Proyección mínima para usuarios (solo para listas)
 */
const USER_MINIMAL_PROJECTION = 'username avatar fullName isVerified';

/**
 * Proyección para posts en feed
 */
const POST_FEED_PROJECTION = 'user type content caption location tags likes comments views createdAt';

/**
 * Proyección para posts en perfil
 */
const POST_PROFILE_PROJECTION = 'content type likes comments createdAt';

module.exports = {
  QueryBuilder,
  optimizedQuery,
  batchLoad,
  USER_PUBLIC_PROJECTION,
  USER_MINIMAL_PROJECTION,
  POST_FEED_PROJECTION,
  POST_PROFILE_PROJECTION,
};

