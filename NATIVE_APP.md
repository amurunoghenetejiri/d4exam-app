# D4EXAM App (native Capacitor)

This repository is the **Android app only** (`com.d4exam.app`).

## What this repo is

- Capacitor 8 + bundled SPA in `dist/`
- Same **Supabase** project as the website (`d4exam-web`)
- Native plugins: biometric, push, camera, screen share, splash

## What this repo is NOT

- Not the public website (`d4exam-web` → https://d4exam.name.ng)
- Not a Vercel deployment
- Does **not** use `server.url` pointing at the website

## Env (client only)

Copy `.env.example` → `.env` (gitignored) with:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (anon)

Never add `SUPABASE_SERVICE_ROLE_KEY` or `RESEND_API_KEY` to the app.

## Build APK locally

```bash
npm ci
npm run build:app   # prepare-capacitor-dist → dist/
npx cap sync android
cd android && ./gradlew assembleDebug
```

Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`

## CI

- `.github/workflows/build-android.yml` — build debug APK on push to `main`
- `.github/workflows/release-android.yml` — tagged release (`v*`) publishes APK assets

Set repository secrets for CI builds:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
