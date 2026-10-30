# Getting Bragboard on phones

One codebase (`client/`) produces the website, the Android app and the iPhone app. All of them use the same server and the same accounts, so everything is in sync after signing in.

| Platform | Free way | Store way |
|---|---|---|
| Any browser | open your server address | – |
| iPhone | Safari → Share → **Add to Home Screen** | App Store / TestFlight, Apple Developer Program $99/year |
| Android | install the APK, or Chrome → **Install app** | Google Play, $25 once |

## Web app on the home screen (iPhone and Android, free)

The web app is a PWA: it has an icon, opens full screen and remembers your login.

- **iPhone**: open `https://your-address` in **Safari** → Share button → *Add to Home Screen*.
- **Android**: open it in **Chrome** → menu (⋮) → *Install app* / *Add to Home screen*.

For most friend groups this is enough, and updates arrive automatically when the server updates.

## Native Android app (APK, free)

Builds run in the cloud on [Expo EAS](https://expo.dev/eas) (free plan includes monthly builds); no Android Studio needed.

```bash
cd client
npx eas-cli@latest login          # free Expo account
npx eas-cli@latest init           # links the project, adds its id to app.json
```

Edit `client/eas.json` and replace `https://bragboard.example.com` with your server address. Then:

```bash
npx eas-cli@latest build --platform android --profile preview
```

When it finishes you get a link and QR code to download the `.apk`. Open it on the phone and allow installing from that source. Share the same link or file with friends.

### Google Play (optional)

```bash
npx eas-cli@latest build --platform android --profile production   # .aab for the store
npx eas-cli@latest submit --platform android
```

You need a Google Play developer account ($25 once), a privacy policy URL and the *Data safety* form (the app stores name, username, email and game scores; users can delete their account in Settings).

## Native iPhone app (optional, $99/year)

Apple only allows installing native apps through the App Store or TestFlight, which needs the [Apple Developer Program](https://developer.apple.com/programs/).

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios
```

EAS creates the certificates for you. Invite friends through **TestFlight** (up to 10,000 testers, no review for internal testers) or publish to the App Store. The app already has in-app account deletion, which Apple requires.

## Developing on your phone

```bash
cd client
npx expo start
```

Scan the QR code with **Expo Go** (Android) or the Camera app (iPhone). The phone must reach your dev server: set `EXPO_PUBLIC_API_URL` in `client/.env.development` to your computer's LAN IP, e.g. `http://192.168.1.20:8090`, or to your Pi's public address.

## Changing the server inside the app

On the sign-in screen tap **Server: …** at the bottom and enter another address. Useful if you build the app once and later move the server.

## Releasing a new version

- Web/PWA: push to `main`, then run `deploy/update.sh` on the Pi (or let cron do it).
- Android/iPhone: bump `version` in `client/app.json` and run the build command again. (For instant updates without reinstalling you can add [EAS Update](https://docs.expo.dev/eas-update/introduction/) later.)
