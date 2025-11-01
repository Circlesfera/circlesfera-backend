/**
 * Tipo utilitario para modelar resultados de operaciones que pueden fallar. Evita el uso
 * extensivo de excepciones para control de flujo en reglas de negocio.
 */
export type Result<Success, Failure extends Error = Error> =
  | { ok: true; value: Success }
  | { ok: false; error: Failure };

export const ok = <Success, Failure extends Error = Error>(value: Success): Result<Success, Failure> => ({
  ok: true,
  value
});

export const err = <Success, Failure extends Error = Error>(error: Failure): Result<Success, Failure> => ({
  ok: false,
  error
});

