import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword, updateProfile, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const registerButton = document.getElementById('register-button');
    const errorMessage = document.getElementById('error-message');

    // Jika sudah login, redirect
    onAuthStateChanged(auth, (user) => {
        if (user) {
            window.location.replace('/dashboard.html');
        }
    });

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            registerButton.disabled = true;
            registerButton.textContent = 'Memproses...';
            errorMessage.style.display = 'none';

            const displayName = registerForm.displayName.value;
            const email = registerForm.email.value;
            const password = registerForm.password.value;

            if (password.length < 6) {
                errorMessage.textContent = 'Password harus terdiri dari minimal 6 karakter.';
                errorMessage.style.display = 'block';
                registerButton.disabled = false;
                registerButton.textContent = 'Daftar';
                return;
            }

            try {
                // 1. Buat pengguna baru
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                
                // 2. Update profil pengguna dengan nama lengkap
                await updateProfile(userCredential.user, {
                    displayName: displayName
                });

                console.log('Registrasi berhasil untuk:', userCredential.user.email);
                // Redirect akan ditangani oleh onAuthStateChanged

            } catch (error) {
                console.error('Error registrasi:', error.code);
                let friendlyMessage = 'Gagal mendaftar. Silakan coba lagi.';
                if (error.code === 'auth/email-already-in-use') {
                    friendlyMessage = 'Email ini sudah terdaftar. Silakan gunakan email lain atau login.';
                }
                errorMessage.textContent = friendlyMessage;
                errorMessage.style.display = 'block';

                registerButton.disabled = false;
                registerButton.textContent = 'Daftar';
            }
        });
    }
});