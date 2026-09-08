export type AppVariant = 'development' | 'production'

export const resolveAppVariant: (environment?: NodeJS.ProcessEnv) => AppVariant
export const getVariantIdentifier: (baseIdentifier: string, variant: AppVariant) => string
export const getVariantDisplayName: (baseName: string, variant: AppVariant) => string
