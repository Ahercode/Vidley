# Vidley - Native Mobile App Build Guide

This guide explains how to build Vidley as a native iOS and Android app using Capacitor.

## Prerequisites

### For Android:
- [Android Studio](https://developer.android.com/studio) installed
- Android SDK configured
- A Google Play Developer account ($25 one-time fee) for publishing

### For iOS:
- macOS with [Xcode](https://developer.apple.com/xcode/) installed
- An Apple Developer account ($99/year) for publishing
- CocoaPods installed (`sudo gem install cocoapods`)

## Building the Apps

### 1. Build the Web App First
```bash
cd frontend
yarn build
```

### 2. Sync with Native Platforms
```bash
npx cap sync
```

### 3. Open in IDE

**For Android:**
```bash
npx cap open android
# Or use the script:
yarn build:android
```
This opens Android Studio. From there:
- Wait for Gradle sync to complete
- Click **Build > Generate Signed Bundle / APK**
- Follow the wizard to create a signed APK or App Bundle

**For iOS:**
```bash
npx cap open ios
# Or use the script:
yarn build:ios
```
This opens Xcode. From there:
- Select your development team in Signing & Capabilities
- Click **Product > Archive**
- Follow the wizard to upload to App Store Connect

## App Store / Play Store Publishing

### Google Play Store
1. Create a Google Play Developer account
2. Create a new app in Google Play Console
3. Upload your signed AAB (Android App Bundle)
4. Fill in store listing details, screenshots, etc.
5. Submit for review

### Apple App Store
1. Create an Apple Developer account
2. Create an App ID in Apple Developer Portal
3. Create an app in App Store Connect
4. Archive and upload from Xcode
5. Fill in app details, screenshots, etc.
6. Submit for review

## Customizing App Icons

Replace the icons in:
- **Android:** `android/app/src/main/res/mipmap-*` directories
- **iOS:** `ios/App/App/Assets.xcassets/AppIcon.appiconset`

You can use tools like:
- [App Icon Generator](https://appicon.co/)
- [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/)

## Environment Configuration

The app uses the production API URL by default. To change it:
1. Edit `src/App.tsx` and update `API_URL`
2. Rebuild: `yarn build && npx cap sync`

## Common Commands

| Command | Description |
|---------|-------------|
| `yarn build` | Build web app |
| `npx cap sync` | Sync web app to native platforms |
| `npx cap open android` | Open Android project in Android Studio |
| `npx cap open ios` | Open iOS project in Xcode |
| `npx cap run android` | Build and run on Android device/emulator |
| `npx cap run ios` | Build and run on iOS device/simulator |

## Troubleshooting

### Android Gradle Issues
```bash
cd android
./gradlew clean
cd ..
npx cap sync android
```

### iOS CocoaPods Issues
```bash
cd ios/App
pod install --repo-update
cd ../..
npx cap sync ios
```

### Web Assets Not Updating
```bash
yarn build
npx cap sync
```
