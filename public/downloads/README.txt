Place the release APK here as: d4exam.apk

Install app on the website downloads from the SAME site:
  https://YOUR-DOMAIN/downloads/d4exam.apk

Never use a GitHub URL for student install — browsers would open GitHub instead of installing.

When you ship a new APK:
1. Build release APK in Android Studio (Build → Generate Signed Bundle / APK)
2. Copy the APK to public/downloads/d4exam.apk in this repo (overwrite)
3. Optionally bump versionCode / versionName in android/app/build.gradle
4. Update minVersion, latestVersion, minBuild, latestBuild in public/app-version.json
5. Commit + push so Vercel deploys the new binary

The Install app button uses a same-origin download so Chrome/Phoenix
show the native download/install UI — not a GitHub page.
