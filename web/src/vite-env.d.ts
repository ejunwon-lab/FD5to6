/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare namespace google {
  namespace accounts {
    namespace oauth2 {
      interface TokenClient {
        requestAccessToken(opts?: { prompt?: string }): void
      }
      interface TokenResponse {
        access_token: string
        expires_in: number
        error?: string
      }
      function initTokenClient(config: {
        client_id: string
        scope: string
        callback: (response: TokenResponse) => void
      }): TokenClient
    }
  }
}
