export class PaasError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
  ) {
    super(message)
    this.name = 'PaasError'
  }
}

export class NotFoundError extends PaasError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404)
    this.name = 'NotFoundError'
  }
}

export class ForbiddenError extends PaasError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403)
    this.name = 'ForbiddenError'
  }
}

export class ConflictError extends PaasError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409)
    this.name = 'ConflictError'
  }
}

export class OrchestratorError extends PaasError {
  constructor(message: string, public clusterType: string) {
    super(message, 'ORCHESTRATOR_ERROR', 502)
    this.name = 'OrchestratorError'
  }
}
