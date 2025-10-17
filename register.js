import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { signInWithGoogle } from './auth-helpers.js';

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
                const user = userCredential.user;
                await updateProfile(user, {
                    displayName: displayName
                });

                // 3. Simpan nama lowercase ke Firestore untuk pencarian notifikasi
                const userDocRef = doc(db, 'users', user.uid);
                await setDoc(userDocRef, {
                    displayName_lowercase: displayName.toLowerCase()
                }, { merge: true });

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