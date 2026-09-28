/** Marker interface for application-layer use cases (domain-pure inputs/outputs). */
export interface UseCase<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}
