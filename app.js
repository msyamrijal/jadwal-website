let deferredPrompt;
const installButton = document.getElementById('install-button');

function setupPWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI to notify the user they can install the PWA
    if (installButton) {
      installButton.hidden = false;
      console.log('`beforeinstallprompt` event was fired.');
    }
  });

  if (installButton) {
    installButton.addEventListener('click', async () => {
      // Hide the app provided install promotion
      installButton.hidden = true;
      // Show the install prompt
      deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      // Optionally, send analytics event with outcome of user choice
      console.log(`User response to the install prompt: ${outcome}`);
      // We've used the prompt, and can't use it again, throw it away
      deferredPrompt = null;
    });
  }

  window.addEventListener('appinstalled', () => {
    // Hide the app-provided install promotion
    if (installButton) {
      installButton.hidden = true;
    }
    // Clear the deferredPrompt so it can be garbage collected
    deferredPrompt = null;
    // Optionally, send analytics event to indicate successful install
    console.log('PWA was installed');
  });
}

function registerServiceWorker() {
  // This is a placeholder function.
  // You can add your service worker registration logic here.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(function(registration) {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(function(error) {
        console.error('Service Worker registration failed:', error);
      });
  }
}