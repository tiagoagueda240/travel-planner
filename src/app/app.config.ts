import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getAnalytics, provideAnalytics, ScreenTrackingService, UserTrackingService } from '@angular/fire/analytics';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDyk7-t3VmyiX_PqCr3WkHjh7A3MUjlSq0",
  authDomain: "ia-trip-planner.firebaseapp.com",
  projectId: "ia-trip-planner",
  storageBucket: "ia-trip-planner.firebasestorage.app",
  messagingSenderId: "120987091205",
  appId: "1:120987091205:web:dec3de4f02d1770533376c",
  measurementId: "G-NDWH8719NV"
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideFirestore(() => getFirestore()),
    // Se tiveres aqui a linha do provideAuth(...), apaga-a!
  ]
};
