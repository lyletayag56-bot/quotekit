// Paste your Firebase web app config here (Firebase console → Project
// settings → Your apps → Web app). These values are public identifiers;
// firestore.rules is what actually controls access.
export const firebaseConfig = {
  apiKey: 'your-web-api-key',
  authDomain: 'your-project-id.firebaseapp.com',
  projectId: 'your-project-id',
  appId: 'your-app-id',
};

// When the dashboard is opened on localhost (e.g. via `firebase
// emulators:start`), it talks to the local emulator suite instead of
// production. No quota burned while developing.
export const USE_EMULATORS =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1';

export const EMULATOR_PORTS = {
  auth: 9099,
  firestore: 8080,
  functions: 5001,
};
