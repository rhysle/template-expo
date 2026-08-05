import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { requestBytes, type JsonRequestOptions } from './http'
import { Reporter } from './reporter'
import type {
  AppleUploadOperation,
  JsonApiResource,
  JsonApiSingleResponse,
  MonetizationConfig,
  ProductKey,
  StoreLocalization,
} from './types'

const ROOT = path.resolve(__dirname, '../..')
const EDITABLE_VERSION_STATE = 'PREPARE_FOR_SUBMISSION'

interface VersionAttributes {
  version: number | string
  state: string
}

interface MetadataLocalizationAttributes {
  locale: string
  name: string
  description?: string
}

interface ReviewScreenshotAttributes {
  fileName: string
  fileSize: number
  sourceFileChecksum?: string
  uploaded?: boolean
  uploadOperations?: AppleUploadOperation[]
}

interface DesiredLocalization extends MetadataLocalizationAttributes {}

interface ReviewAsset {
  bytes: Uint8Array
  fileName: string
  fileSize: number
  sourceFileChecksum: string
}

interface VersionedMetadataDefinition {
  label: string
  versionsPath: string
  createVersionPath: string
  versionType: string
  parentRelationship: string
  parentType: string
  parentId: string
  localizationType: string
  createLocalizationPath: string
  localizationsPath: (versionId: string) => string
  desiredLocalizations: DesiredLocalization[]
}

interface ReviewScreenshotDefinition {
  label: string
  sourcePath?: string
  currentPath: string
  type: string
  createPath: string
  parentRelationship: string
  parentType: string
  parentId: string
  legacyVersionsPath: string
  legacyImagesPath: (versionId: string) => string
  legacyDeletePath: string
}

type AppleRequest = <T>(pathOrUrl: string, options?: JsonRequestOptions) => Promise<T | undefined>

type AppleListAll = <T extends JsonApiResource>(pathOrUrl: string) => Promise<T[]>

const versionNumber = (version: JsonApiResource<VersionAttributes>): number =>
  Number(version.attributes.version) || 0

const sameLocalization = (
  current: MetadataLocalizationAttributes,
  desired: DesiredLocalization
): boolean =>
  current.name === desired.name && (current.description ?? '') === (desired.description ?? '')

const resolveReviewAsset = (sourcePath: string): ReviewAsset => {
  const absolutePath = path.isAbsolute(sourcePath) ? sourcePath : path.resolve(ROOT, sourcePath)
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Apple review screenshot not found: ${absolutePath}`)
  }
  const extension = path.extname(absolutePath).toLowerCase()
  if (!['.png', '.jpg', '.jpeg'].includes(extension)) {
    throw new Error(`Apple review screenshot must be PNG or JPEG: ${absolutePath}`)
  }

  const bytes = fs.readFileSync(absolutePath)
  const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12)
  const baseName = path.basename(absolutePath, extension)
  return {
    bytes,
    fileName: `${baseName}-${hash}${extension === '.jpeg' ? '.jpg' : extension}`,
    fileSize: bytes.byteLength,
    sourceFileChecksum: crypto.createHash('md5').update(bytes).digest('hex'),
  }
}

export class AppleMetadataReconciler {
  constructor(
    private readonly config: MonetizationConfig,
    private readonly localizations: StoreLocalization[],
    private readonly reporter: Reporter,
    private readonly request: AppleRequest,
    private readonly listAll: AppleListAll
  ) {}

  async syncSubscriptionGroup(groupId: string): Promise<void> {
    await this.syncVersionedMetadata({
      label: 'subscription group',
      versionsPath: `/v1/subscriptionGroups/${groupId}/versions?limit=200`,
      createVersionPath: '/v1/subscriptionGroupVersions',
      versionType: 'subscriptionGroupVersions',
      parentRelationship: 'subscriptionGroup',
      parentType: 'subscriptionGroups',
      parentId: groupId,
      localizationType: 'subscriptionGroupLocalizations',
      createLocalizationPath: '/v2/subscriptionGroupLocalizations',
      localizationsPath: (versionId) =>
        `/v1/subscriptionGroupVersions/${versionId}/localizations?limit=200`,
      desiredLocalizations: this.localizations.map((localization) => ({
        locale: localization.appleLocale,
        name: localization.apple.subscriptionGroupDisplayName,
      })),
    })
  }

  async syncSubscription(
    subscriptionId: string,
    key: Exclude<ProductKey, 'lifetime'>
  ): Promise<void> {
    await this.syncVersionedMetadata({
      label: `${key} subscription`,
      versionsPath: `/v1/subscriptions/${subscriptionId}/versions?limit=200`,
      createVersionPath: '/v1/subscriptionVersions',
      versionType: 'subscriptionVersions',
      parentRelationship: 'subscription',
      parentType: 'subscriptions',
      parentId: subscriptionId,
      localizationType: 'subscriptionLocalizations',
      createLocalizationPath: '/v2/subscriptionLocalizations',
      localizationsPath: (versionId) =>
        `/v1/subscriptionVersions/${versionId}/localizations?limit=200`,
      desiredLocalizations: this.localizations.map((localization) => ({
        locale: localization.appleLocale,
        name: localization.apple.products[key].displayName,
        description: localization.apple.products[key].description,
      })),
    })
    await this.syncReviewScreenshot({
      label: `${key} subscription`,
      sourcePath: this.config.products[key].appleReviewScreenshotPath,
      currentPath: `/v1/subscriptions/${subscriptionId}/appStoreReviewScreenshot`,
      type: 'subscriptionAppStoreReviewScreenshots',
      createPath: '/v1/subscriptionAppStoreReviewScreenshots',
      parentRelationship: 'subscription',
      parentType: 'subscriptions',
      parentId: subscriptionId,
      legacyVersionsPath: `/v1/subscriptions/${subscriptionId}/versions?limit=200`,
      legacyImagesPath: (versionId) => `/v1/subscriptionVersions/${versionId}/images?limit=200`,
      legacyDeletePath: '/v2/subscriptionImages',
    })
  }

  async syncLifetimePurchase(purchaseId: string): Promise<void> {
    await this.syncVersionedMetadata({
      label: 'lifetime purchase',
      versionsPath: `/v2/inAppPurchases/${purchaseId}/versions?limit=200`,
      createVersionPath: '/v1/inAppPurchaseVersions',
      versionType: 'inAppPurchaseVersions',
      parentRelationship: 'inAppPurchase',
      parentType: 'inAppPurchases',
      parentId: purchaseId,
      localizationType: 'inAppPurchaseLocalizations',
      createLocalizationPath: '/v2/inAppPurchaseLocalizations',
      localizationsPath: (versionId) =>
        `/v1/inAppPurchaseVersions/${versionId}/localizations?limit=200`,
      desiredLocalizations: this.localizations.map((localization) => ({
        locale: localization.appleLocale,
        name: localization.apple.products.lifetime.displayName,
        description: localization.apple.products.lifetime.description,
      })),
    })
    await this.syncReviewScreenshot({
      label: 'lifetime purchase',
      sourcePath: this.config.products.lifetime.appleReviewScreenshotPath,
      currentPath: `/v2/inAppPurchases/${purchaseId}/appStoreReviewScreenshot`,
      type: 'inAppPurchaseAppStoreReviewScreenshots',
      createPath: '/v1/inAppPurchaseAppStoreReviewScreenshots',
      parentRelationship: 'inAppPurchaseV2',
      parentType: 'inAppPurchases',
      parentId: purchaseId,
      legacyVersionsPath: `/v2/inAppPurchases/${purchaseId}/versions?limit=200`,
      legacyImagesPath: (versionId) => `/v1/inAppPurchaseVersions/${versionId}/images?limit=200`,
      legacyDeletePath: '/v2/inAppPurchaseImages',
    })
  }

  private async syncVersionedMetadata(definition: VersionedMetadataDefinition): Promise<void> {
    const versions = await this.listAll<JsonApiResource<VersionAttributes>>(definition.versionsPath)
    const sortedVersions = [...versions].sort(
      (left, right) => versionNumber(right) - versionNumber(left)
    )
    const editableVersion = sortedVersions.find(
      (version) => version.attributes.state === EDITABLE_VERSION_STATE
    )
    let version = editableVersion ?? sortedVersions[0]
    let currentLocalizations = version
      ? await this.listAll<JsonApiResource<MetadataLocalizationAttributes>>(
          definition.localizationsPath(version.id)
        )
      : []

    const localizationChanges = definition.desiredLocalizations.filter((desired) => {
      const current = currentLocalizations.find(
        (localization) => localization.attributes.locale === desired.locale
      )
      return !current || !sameLocalization(current.attributes, desired)
    })

    if (localizationChanges.length === 0) {
      this.reporter.ok(
        `Apple ${definition.label} metadata (${definition.desiredLocalizations.length} localizations)`
      )
      return
    }

    if (!editableVersion) {
      if (this.reporter.command === 'verify') {
        this.reportMetadataDifferences(definition, localizationChanges, 'error')
        return
      }
      if (this.reporter.command === 'plan') {
        this.reporter.change(`create Apple ${definition.label} metadata version`)
        this.reportMetadataDifferences(definition, definition.desiredLocalizations, 'change')
        return
      }

      version = await this.createVersion(definition)
      currentLocalizations = []
      this.reporter.change(`created Apple ${definition.label} metadata version`)
    }

    if (!version) throw new Error(`Apple did not provide a ${definition.label} metadata version`)

    for (const desired of definition.desiredLocalizations) {
      const current = currentLocalizations.find(
        (localization) => localization.attributes.locale === desired.locale
      )
      if (current && sameLocalization(current.attributes, desired)) continue

      const action = current ? 'update' : 'create'
      const message = `${action} Apple ${definition.label} ${desired.locale} localization`
      if (this.reporter.command === 'verify') {
        this.reporter.error(message)
      } else if (this.reporter.command === 'plan') {
        this.reporter.change(message)
      } else {
        await this.writeLocalization(definition, version.id, desired, current)
        this.reporter.change(`${action}d Apple ${definition.label} ${desired.locale} localization`)
      }
    }
  }

  private reportMetadataDifferences(
    definition: VersionedMetadataDefinition,
    localizationChanges: DesiredLocalization[],
    kind: 'change' | 'error'
  ): void {
    for (const localization of localizationChanges) {
      this.reporter[kind](`update Apple ${definition.label} ${localization.locale} localization`)
    }
  }

  private async createVersion(
    definition: VersionedMetadataDefinition
  ): Promise<JsonApiResource<VersionAttributes>> {
    const response = await this.request<JsonApiSingleResponse<JsonApiResource<VersionAttributes>>>(
      definition.createVersionPath,
      {
        method: 'POST',
        body: {
          data: {
            type: definition.versionType,
            relationships: {
              [definition.parentRelationship]: {
                data: { type: definition.parentType, id: definition.parentId },
              },
            },
          },
        },
      }
    )
    if (!response) throw new Error(`Apple did not return the created ${definition.label} version`)
    return response.data
  }

  private async writeLocalization(
    definition: VersionedMetadataDefinition,
    versionId: string,
    desired: DesiredLocalization,
    current?: JsonApiResource<MetadataLocalizationAttributes>
  ): Promise<void> {
    const attributes = {
      name: desired.name,
      ...(desired.description === undefined ? {} : { description: desired.description }),
      ...(current ? {} : { locale: desired.locale }),
    }
    await this.request(
      current
        ? `${definition.createLocalizationPath}/${current.id}`
        : definition.createLocalizationPath,
      {
        method: current ? 'PATCH' : 'POST',
        body: {
          data: {
            type: definition.localizationType,
            ...(current ? { id: current.id } : {}),
            attributes,
            ...(current
              ? {}
              : {
                  relationships: {
                    version: {
                      data: { type: definition.versionType, id: versionId },
                    },
                  },
                }),
          },
        },
      }
    )
  }

  private async syncReviewScreenshot(definition: ReviewScreenshotDefinition): Promise<void> {
    if (!definition.sourcePath) return

    const asset = resolveReviewAsset(definition.sourcePath)
    const [currentResponse, legacyVersions] = await Promise.all([
      this.request<{ data: JsonApiResource<ReviewScreenshotAttributes> | null }>(
        definition.currentPath,
        { allowNotFound: true }
      ),
      this.listAll<JsonApiResource<VersionAttributes>>(definition.legacyVersionsPath),
    ])
    const legacyImages = (
      await Promise.all(
        legacyVersions.map((version) =>
          this.listAll<JsonApiResource<ReviewScreenshotAttributes>>(
            definition.legacyImagesPath(version.id)
          )
        )
      )
    ).flat()
    const misplacedImages = legacyImages.filter(
      (image) =>
        image.attributes.fileName === asset.fileName && image.attributes.fileSize === asset.fileSize
    )
    const current = currentResponse?.data ?? undefined
    const currentMatches =
      current?.attributes.fileSize === asset.fileSize &&
      (current.attributes.sourceFileChecksum
        ? current.attributes.sourceFileChecksum.toLowerCase() === asset.sourceFileChecksum
        : current.attributes.fileName === asset.fileName)

    if (currentMatches && misplacedImages.length === 0) {
      this.reporter.ok(`Apple ${definition.label} Review Information screenshot`)
      return
    }

    if (this.reporter.command === 'verify') {
      if (misplacedImages.length > 0) {
        this.reporter.error(
          `Apple ${definition.label} screenshot is incorrectly stored as a promotional image`
        )
      }
      if (!currentMatches) {
        this.reporter.error(`Apple ${definition.label} Review Information screenshot differs`)
      }
      return
    }

    if (this.reporter.command === 'plan') {
      if (misplacedImages.length > 0) {
        this.reporter.change(
          `remove incorrectly uploaded Apple ${definition.label} promotional image`
        )
      }
      if (!currentMatches) {
        this.reporter.change(`upload Apple ${definition.label} Review Information screenshot`)
      }
      return
    }

    for (const image of misplacedImages) {
      await this.request(`${definition.legacyDeletePath}/${image.id}`, { method: 'DELETE' })
    }
    if (misplacedImages.length > 0) {
      this.reporter.change(
        `removed incorrectly uploaded Apple ${definition.label} promotional image`
      )
    }

    if (!currentMatches) {
      if (current) {
        await this.request(`${definition.createPath}/${current.id}`, { method: 'DELETE' })
      }
      await this.uploadReviewAsset(definition, asset)
      this.reporter.change(`uploaded Apple ${definition.label} Review Information screenshot`)
    }
  }

  private async uploadReviewAsset(
    definition: ReviewScreenshotDefinition,
    asset: ReviewAsset
  ): Promise<void> {
    const response = await this.request<
      JsonApiSingleResponse<JsonApiResource<ReviewScreenshotAttributes>>
    >(definition.createPath, {
      method: 'POST',
      body: {
        data: {
          type: definition.type,
          attributes: { fileName: asset.fileName, fileSize: asset.fileSize },
          relationships: {
            [definition.parentRelationship]: {
              data: {
                type: definition.parentType,
                id: definition.parentId,
              },
            },
          },
        },
      },
    })
    if (!response) throw new Error(`Apple did not reserve the ${definition.type} upload`)
    const operations = response.data.attributes.uploadOperations ?? []
    if (operations.length === 0)
      throw new Error(`Apple returned no upload operations for ${asset.fileName}`)

    for (const operation of operations) {
      const chunk = asset.bytes.subarray(operation.offset, operation.offset + operation.length)
      if (chunk.byteLength !== operation.length) {
        throw new Error(
          `Apple requested an invalid upload range for ${asset.fileName}: ${operation.offset}+${operation.length}`
        )
      }
      await requestBytes(operation.url, {
        method: operation.method,
        headers: Object.fromEntries(
          operation.requestHeaders.map((header) => [header.name, header.value])
        ),
        body: chunk,
      })
    }

    await this.request(`${definition.createPath}/${response.data.id}`, {
      method: 'PATCH',
      body: {
        data: {
          type: definition.type,
          id: response.data.id,
          attributes: {
            uploaded: true,
            sourceFileChecksum: asset.sourceFileChecksum,
          },
        },
      },
    })
  }
}
