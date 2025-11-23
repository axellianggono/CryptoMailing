(() => {
  const authToken = window.authToken;
  const userPrivateKey = window.userPrivateKey;
  const statusText = document.getElementById('status-text');
  const sendForm = document.getElementById('send-form');
  const receiverInput = document.getElementById('receiver');
  const usersList = document.getElementById('users-list');

  if (!authToken) {
    alert('Anda belum login. Silakan login terlebih dahulu.');
    window.location.href = 'login.html';
    return;
  }

  if (!userPrivateKey) {
    alert('Kunci privat tidak ditemukan di perangkat ini. Kirim dan tanda tangan pesan tidak akan berfungsi.');
  }

  const setStatus = (message, success = false) => {
    if (!statusText) return;
    statusText.textContent = message;
    statusText.className = success ? 'text-success' : 'text-danger';
  };

  async function fetchReceiverPublicKey(username) {
    const response = await fetch(`../backend/public_key.php?username=${encodeURIComponent(username)}`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    return response.json();
  }

  function generateSessionKey() {
    return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
  }

  function encryptMessage(message, sessionKey) {
    return CryptoJS.AES.encrypt(message, sessionKey).toString();
  }

  function encryptSessionKey(sessionKey, receiverPublicKey) {
    const rsa = new JSEncrypt();
    rsa.setPublicKey(receiverPublicKey);
    return rsa.encrypt(sessionKey);
  }

  function signCiphertext(ciphertext, senderPrivateKey) {
    const digest = CryptoJS.SHA256(ciphertext).toString();
    const rsa = new JSEncrypt();
    rsa.setPrivateKey(senderPrivateKey);
    return rsa.sign(digest, CryptoJS.SHA256, 'sha256');
  }

  async function sendEncryptedMail(payload) {
    const response = await fetch('../backend/send_mail.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });

    return response.json();
  }

  const debounce = (fn, delay = 300) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  };

  async function searchUsers(term) {
    if (!term) {
      if (usersList) usersList.innerHTML = '';
      return;
    }

    try {
      const response = await fetch(`../backend/users.php?q=${encodeURIComponent(term)}`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      const result = await response.json();
      if (result.success && Array.isArray(result.users) && usersList) {
        usersList.innerHTML = result.users.map((u) => `<option value="${u}"></option>`).join('');
      }
    } catch (e) {
      // abaikan error autocomplete agar form tetap bisa dipakai
    }
  }

  const handleSearchUsers = debounce((value) => searchUsers(value), 250);

  if (receiverInput) {
    receiverInput.addEventListener('input', (e) => {
      const term = e.target.value.trim();
      handleSearchUsers(term);
    });
  }

  if (sendForm) {
    sendForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const receiverUsername = document.getElementById('receiver').value.trim();
      const message = document.getElementById('message').value;

      if (!receiverUsername || !message) {
        setStatus('Username penerima dan pesan wajib diisi.');
        return;
      }

      if (!userPrivateKey) {
        setStatus('Kunci privat tidak tersedia. Tidak bisa menandatangani pesan.');
        return;
      }

      try {
        setStatus('Mengambil public key penerima...');
        const publicKeyResponse = await fetchReceiverPublicKey(receiverUsername);
        if (!publicKeyResponse.success) {
          throw new Error(publicKeyResponse.message || 'Gagal mengambil public key penerima.');
        }

        const receiverPublicKey = publicKeyResponse.public_key;

        const sessionKey = generateSessionKey();
        const encryptedMessage = encryptMessage(message, sessionKey);
        const encryptedSessionKey = encryptSessionKey(sessionKey, receiverPublicKey);
        const signature = signCiphertext(encryptedMessage, userPrivateKey);

        if (!encryptedSessionKey) {
          throw new Error('Gagal mengenkripsi session key dengan RSA.');
        }

        if (!signature) {
          throw new Error('Gagal membuat tanda tangan digital.');
        }

        setStatus('Mengirim pesan terenkripsi...');
        const payload = {
          receiver_username: receiverUsername,
          encrypted_message: encryptedMessage,
          encrypted_session_key: encryptedSessionKey,
          signature: signature
        };

        const sendResponse = await sendEncryptedMail(payload);
        if (!sendResponse.success) {
          throw new Error(sendResponse.message || 'Pengiriman pesan gagal.');
        }

        setStatus('Pesan terenkripsi berhasil dikirim!', true);
        sendForm.reset();
      } catch (error) {
        setStatus(error.message || 'Terjadi kesalahan saat mengirim pesan.');
      }
    });
  }
})();
