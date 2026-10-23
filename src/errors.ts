export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly key: string,
    message: string
  ) {
    super(message);
  }
}

export function errorBody(key: string, message: string): { errors: Record<string, string[]> } {
  return { errors: { [key]: [message] } };
}
