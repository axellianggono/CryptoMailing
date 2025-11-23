// Basic token guard
(() => {
  const token = localStorage.getItem('token');
  const privKey = localStorage.getItem('privateKey');
  if (!token) {
    alert('Anda belum login. Silakan login terlebih dahulu.');
    window.location.href = 'login.html';
    return;
  }

  // expose globally for other scripts
  window.authToken = token;
  window.userPrivateKey = privKey;

const userNameEl = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-button');

function parseJwt(tokenValue) {
  try {
    const base64Url = tokenValue.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
    const jsonPayload = decodeURIComponent(
      atob(padded)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

  const payload = parseJwt(token);
  const currentUsername = payload && payload.data && payload.data.username ? payload.data.username : 'User';

  if (userNameEl) {
    userNameEl.textContent = currentUsername;
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('privateKey');
      window.location.href = 'login.html';
    });
  }
})();
