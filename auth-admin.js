// auth-admin.js

// --- PENTING ---
// Ganti nilai di bawah ini dengan User ID (UID) akun Anda dari Firebase Authentication.
// Anda bisa menambahkan lebih dari satu UID di dalam array ini.
// Contoh: const ADMIN_UIDS = ['uid-admin-satu', 'uid-admin-kedua'];
const ADMIN_UIDS = ['v22ZHhLZi0deKCkIKEE5gtvRUN22', 'kuRRP9Fxy5aTg5fOMisbQCJTdJ33'];

/**
 * Memeriksa apakah pengguna yang diberikan adalah seorang admin.
 * @param {object} user Objek pengguna dari Firebase Auth.
 * @returns {boolean} True jika pengguna adalah admin.
 */
export function isAdmin(user) {
    return user ? ADMIN_UIDS.includes(user.uid) : false;
}