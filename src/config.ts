// Register Android com.moneywise and its signing SHA-1 in Google Cloud.
// This OAuth client ID is public configuration, not a client secret.
// Android OAuth client from the supplied configuration. Native sign-in resolves
// it by package + signing SHA-1; never pass an Android ID as webClientId.
export const GOOGLE_ANDROID_CLIENT_ID = '1086023065831-murq0jep4r49o96s26lcjlkhimn3a7ab.apps.googleusercontent.com';
export const GOOGLE_WEB_CLIENT_ID = ''; // Optional web client, only for a future server integration.
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
// This build deliberately uses Google's test ads. Replace IDs and implement
// region-appropriate consent before publishing a monetized production release.
export const TEST_ADS = true;
