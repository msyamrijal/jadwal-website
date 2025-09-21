import { auth } from './firebase-config.js';
import { GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

/**
 * Handles the Google Sign-In process using a popup.
 * Redirects to the dashboard on success.
 * Throws a user-friendly error on failure.
 */
export async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        console.log('Pendaftaran/Login dengan Google berhasil untuk:', result.user.email);
        // After any successful sign-in, always go to the dashboard.
        window.location.replace('/dashboard.html');
    } catch (error) {
        console.error('Error dengan Google Sign-In:', error);
        
        // Re-throw a more specific, user-friendly error to be caught by the caller.
        if (error.code === 'auth/popup-closed-by-user') {
            // This isn't a real error, so we'll throw a specific message to ignore it.
            throw new Error('POPUP_CLOSED');
        } else if (error.code === 'auth/unauthorized-domain') {
            throw new Error('Domain aplikasi ini belum diizinkan. Silakan hubungi administrator.');
        }
        // For all other errors, throw a generic message.
        throw new Error('Gagal login dengan Google. Silakan coba lagi.');
    }
}