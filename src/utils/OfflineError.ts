export class OfflineError extends Error {
  constructor() {
    super('No network connection')
    this.name = 'OfflineError'
  }
}
