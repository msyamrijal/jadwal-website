import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const registerButton = document.getElementById('register-button');
    const errorMessage = document.getElementById('error-message');
    const googleLoginButton = document.getElementById('google-login-button');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Tampilkan status loading pada tombol
            registerButton.disabled = true;
            registerButton.textContent = 'Mendaftarkan...';
            errorMessage.style.display = 'none';

            const displayName = registerForm.displayName.value.trim();
            const email = registerForm.email.value;
            const password = registerForm.password.value;

            // Validasi sederhana agar nama tidak kosong
            if (!displayName) {
                errorMessage.textContent = 'Nama Lengkap (Sesuai di Jadwal) tidak boleh kosong.';
                errorMessage.style.display = 'block';
                registerButton.disabled = false;
                registerButton.textContent = 'Daftar';
                return;
            }

            try {
                // 1. Buat pengguna baru dengan email dan password
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                
                // 2. Perbarui profil pengguna dengan nama lengkap
                // Ini langkah krusial agar jadwal bisa ditemukan
                await updateProfile(userCredential.user, {
                    displayName: displayName
                });

                console.log('Pendaftaran berhasil untuk:', userCredential.user.email);
                
                // Pendaftaran dan pembaruan profil berhasil, sekarang arahkan ke dashboard.
                window.location.replace('/dashboard.html');

            } catch (error) {
                console.error('Error pendaftaran:', error.code, error.message);
                let friendlyMessage = 'Terjadi kesalahan. Silakan coba lagi.';
                
                // Memberikan pesan error yang lebih mudah dimengerti
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        friendlyMessage = 'Email ini sudah terdaftar. Silakan gunakan email lain atau login.';
                        break;
                    case 'auth/weak-password':
                        friendlyMessage = 'Password terlalu lemah. Gunakan minimal 6 karakter.';
                        break;
                    case 'auth/invalid-email':
                        friendlyMessage = 'Format email yang Anda masukkan tidak valid.';
                        break;
                }
                errorMessage.textContent = friendlyMessage;
                errorMessage.style.display = 'block';

                // Kembalikan tombol ke kondisi semula
                registerButton.disabled = false;
                registerButton.textContent = 'Daftar';
            }
        });
    }

    if (googleLoginButton) {
        googleLoginButton.addEventListener('click', async () => {
            const provider = new GoogleAuthProvider();
            
            try {
                const result = await signInWithPopup(auth, provider);
                // Saat pengguna mendaftar dengan Google, akun otomatis dibuat.
                // Firebase secara otomatis mengisi `displayName` dari akun Google.
                console.log('Pendaftaran/Login dengan Google berhasil untuk:', result.user.email);
                // Langsung arahkan ke dashboard.
                window.location.replace('/dashboard.html');
            } catch (error) {
                console.error('Error daftar/login dengan Google:', error);
                // Handle common errors
                if (error.code !== 'auth/popup-closed-by-user') {
                    errorMessage.textContent = 'Gagal mendaftar dengan Google. Silakan coba lagi.';
                    errorMessage.style.display = 'block';
                }
            }
        });
    }
});