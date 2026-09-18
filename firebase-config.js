// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyDJX0DwSr1XZ0j03VyMNA0JKrasV4J0gV0",
    authDomain: "game-website-pembelajaran.firebaseapp.com",
    projectId: "game-website-pembelajaran",
    storageBucket: "game-website-pembelajaran.firebasestorage.app",
    messagingSenderId: "574744726596",
    appId: "1:574744726596:web:59949c5291b3929ade8011",
    measurementId: "G-11TF0KK9P0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);