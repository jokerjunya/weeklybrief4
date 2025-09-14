/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  // 他の環境変数もここに追加
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
