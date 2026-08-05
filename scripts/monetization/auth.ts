import { createSign, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'

const base64Url = (value: string | Buffer): string => Buffer.from(value).toString('base64url')

const encodeJwtPart = (value: object): string => base64Url(JSON.stringify(value))

export class AppleAuth {
  private token?: { value: string; expiresAt: number }

  constructor(
    private readonly issuerId: string,
    private readonly keyId: string,
    private readonly keyFilepath: string
  ) {}

  getToken(): string {
    const now = Math.floor(Date.now() / 1000)
    if (this.token && this.token.expiresAt - now > 60) return this.token.value

    const expiresAt = now + 19 * 60
    const header = encodeJwtPart({ alg: 'ES256', kid: this.keyId, typ: 'JWT' })
    const payload = encodeJwtPart({
      iss: this.issuerId,
      iat: now,
      exp: expiresAt,
      aud: 'appstoreconnect-v1',
    })
    const signingInput = `${header}.${payload}`
    const signature = sign('SHA256', Buffer.from(signingInput), {
      key: readFileSync(this.keyFilepath),
      dsaEncoding: 'ieee-p1363',
    })
    const value = `${signingInput}.${base64Url(signature)}`
    this.token = { value, expiresAt }
    return value
  }
}

interface GoogleServiceAccount {
  client_email: string
  private_key: string
  token_uri?: string
}

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
}

export class GoogleAuth {
  private token?: { value: string; expiresAt: number }
  private readonly credentials: GoogleServiceAccount

  constructor(jsonKeyPath: string) {
    this.credentials = JSON.parse(readFileSync(jsonKeyPath, 'utf8')) as GoogleServiceAccount
    if (!this.credentials.client_email || !this.credentials.private_key) {
      throw new Error(`Invalid Google service-account key: ${jsonKeyPath}`)
    }
  }

  async getToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    if (this.token && this.token.expiresAt - now > 60) return this.token.value

    const tokenUri = this.credentials.token_uri || 'https://oauth2.googleapis.com/token'
    const header = encodeJwtPart({ alg: 'RS256', typ: 'JWT' })
    const payload = encodeJwtPart({
      iss: this.credentials.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    })
    const signingInput = `${header}.${payload}`
    const signer = createSign('RSA-SHA256')
    signer.update(signingInput)
    signer.end()
    const assertion = `${signingInput}.${base64Url(signer.sign(this.credentials.private_key))}`

    const response = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`Google OAuth failed (${response.status}): ${text}`)
    }
    const result = JSON.parse(text) as GoogleTokenResponse
    this.token = { value: result.access_token, expiresAt: now + result.expires_in }
    return result.access_token
  }
}
