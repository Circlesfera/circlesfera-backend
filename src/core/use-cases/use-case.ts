/**
 * Contrato genérico para cualquier caso de uso. Los casos de uso encapsulan reglas
 * de negocio y no deben depender de frameworks o detalles de infraestructura.
 */
export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Output>;
}

