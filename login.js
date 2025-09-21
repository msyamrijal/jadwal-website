import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { signInWithGoogle } from './auth-helpers.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const loginButton = document.getElementById('login-button');
    const errorMessage = document.getElementById('error-message');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const googleLoginButton = document.getElementById('google-login-button');

    // Cek apakah pengguna sudah login, jika ya, redirect ke dashboard
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log('Pengguna sudah login, mengarahkan ke dashboard...');
            window.location.replace('/dashboard.html'); // Gunakan replace agar tidak bisa kembali ke halaman login
        }
    });

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Tampilkan status loading
            loginButton.disabled = true;
            loginButton.textContent = 'Memproses...';
            errorMessage.style.display = 'none';

            const email = loginForm.email.value;
            const password = loginForm.password.value;

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                // Login berhasil, akan di-redirect oleh onAuthStateChanged
                console.log('Login berhasil untuk:', userCredential.user.email);
            } catch (error) {
                // Tangani error login
                console.error('Error login:', error.code);
                let friendlyMessage = 'Terjadi kesalahan. Silakan coba lagi.';
                switch (error.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                    case 'auth/invalid-credential':
                        friendlyMessage = 'Email atau password yang Anda masukkan salah.';
                        break;
                    case 'auth/invalid-email':
                        friendlyMessage = 'Format email tidak valid.';
                        break;
                }
                errorMessage.textContent = friendlyMessage;
                errorMessage.style.display = 'block';

                // Kembalikan tombol ke state normal
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
            }
        });
    }

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            const email = loginForm.email.value;

            // Reset pesan error
            errorMessage.style.display = 'none';
            errorMessage.style.color = 'red'; // Kembalikan ke warna default

            if (!email) {
                errorMessage.textContent = 'Silakan masukkan alamat email Anda di atas, lalu klik "Lupa Password".';
                errorMessage.style.display = 'block';
                return;
            }

            loginButton.disabled = true;

            sendPasswordResetEmail(auth, email)
                .then(() => {
                    errorMessage.textContent = 'Email untuk reset password telah dikirim. Silakan periksa inbox Anda.';
                    errorMessage.style.color = 'green'; // Beri feedback positif
                    errorMessage.style.display = 'block';
                })
                .catch((error) => {
                    errorMessage.textContent = error.code === 'auth/user-not-found' ? 'Tidak ada pengguna yang terdaftar dengan email ini.' : 'Gagal mengirim email reset. Coba lagi.';
                    errorMessage.style.display = 'block';
                })
                .finally(() => {
                    loginButton.disabled = false;
                });
        });
    }

    if (googleLoginButton) {
        googleLoginButton.addEventListener('click', async () => {
            try {
                await signInWithGoogle();
                // Redirect ditangani di dalam signInWithGoogle
            } catch (error) {
                // Hanya tampilkan pesan error jika bukan karena popup ditutup oleh pengguna
                if (error.message !== 'POPUP_CLOSED') {
                    errorMessage.textContent = error.message;
                    errorMessage.style.display = 'block';
                }
            }
        });
    }
});