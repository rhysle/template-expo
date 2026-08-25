const DEVELOPMENT_IDENTIFIER_SUFFIX = '.dev'

const resolveAppVariant = (environment = process.env) => {
  const variant = environment.APP_VARIANT

  if (variant === undefined && environment.NODE_ENV !== 'production') return 'development'
  if (variant === 'development' || variant === 'production') return variant

  throw new Error(
    'APP_VARIANT must be "development" or "production". Set it before local Prebuild or configure it in the selected EAS build profile or EAS Update environment.'
  )
}

const getVariantIdentifier = (baseIdentifier, variant) =>
  variant === 'development' ? `${baseIdentifier}${DEVELOPMENT_IDENTIFIER_SUFFIX}` : baseIdentifier

const getVariantDisplayName = (baseName, variant) =>
  variant === 'development' ? `${baseName} (Dev)` : baseName

module.exports = {
  getVariantDisplayName,
  getVariantIdentifier,
  resolveAppVariant,
}
