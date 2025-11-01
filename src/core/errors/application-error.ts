/**
 * Error de aplicación controlado que permite mapear fallos de dominio a capas externas
 * (HTTP, WebSockets, colas). Incluye un `code` legible y metadatos opcionales.
 */
export class ApplicationError extends Error {
  public readonly statusCode: number;

  public readonly code: string;

  public readonly metadata?: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      code?: string;
      metadata?: Record<string, unknown>;
      cause?: unknown;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = 'ApplicationError';
    this.statusCode = options.statusCode ?? 500;
    this.code = options.code ?? 'INTERNAL_SERVER_ERROR';
    this.metadata = options.metadata;
  }
}

