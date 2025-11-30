(() => {
  const authToken = window.authToken;
  const userPrivateKey = window.userPrivateKey;
  const statusText = document.getElementById('status-text');
  const sendForm = document.getElementById('send-form');
  const receiverInput = document.getElementById('receiver');
  const suggestionBox = document.getElementById('user-suggestions');

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
    const rsa = new JSEncrypt({ default_key_size: 2048 });
    rsa.setPublicKey(receiverPublicKey);
    return rsa.encrypt(sessionKey);
  }

  function signMessage(message, attachmentBase64, senderPrivateKey) {
    const combined = `${message}||${attachmentBase64 || ''}`;
    const rsa = new JSEncrypt({ default_key_size: 2048 });
    rsa.setPrivateKey(senderPrivateKey);
    return rsa.sign(combined, CryptoJS.SHA256, 'sha256');
  }

  function encryptAttachment(base64Data, sessionKey) {
    if (!base64Data) return '';
    return CryptoJS.AES.encrypt(base64Data, sessionKey).toString();
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        // result in data:*;base64,xxx
        const base64 = typeof result === 'string' ? result.split(',')[1] : '';
        resolve(base64 || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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

  const clearSuggestions = () => {
    if (!suggestionBox) return;
    suggestionBox.innerHTML = '';
    suggestionBox.classList.remove('show');
  };

  const renderSuggestions = (users) => {
    if (!suggestionBox) return;
    if (!users.length) {
      if (suggestionBox) {
        suggestionBox.innerHTML = '<div class="list-group-item text-muted small">Tidak ada user ditemukan.</div>';
        suggestionBox.classList.add('show');
      }
      return;
    }

    suggestionBox.innerHTML = users
      .map(
        (u) =>
          `<button type="button" class="list-group-item list-group-item-action suggestion-item" data-username="${u}">${u}</button>`
      )
      .join('');
    suggestionBox.classList.add('show');
  };

  const showLoadingSuggestions = () => {
    if (!suggestionBox) return;
    suggestionBox.innerHTML = '<div class="list-group-item text-muted small">Mencari...</div>';
    suggestionBox.classList.add('show');
  };

  async function searchUsers(term) {
    if (!term) {
      clearSuggestions();
      return;
    }

    try {
      showLoadingSuggestions();
      const response = await fetch(`../backend/users.php?q=${encodeURIComponent(term)}`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      const result = await response.json();
      if (result.success && Array.isArray(result.users)) {
        renderSuggestions(result.users);
      } else {
        clearSuggestions();
      }
    } catch (e) {
      // abaikan error autocomplete agar form tetap bisa dipakai
      clearSuggestions();
    }
  }

  const handleSearchUsers = debounce((value) => searchUsers(value), 250);

  if (receiverInput) {
    receiverInput.addEventListener('input', (e) => {
      const term = e.target.value.trim();
      handleSearchUsers(term);
    });

    receiverInput.addEventListener('focus', () => {
      const term = receiverInput.value.trim();
      handleSearchUsers(term);
    });

    receiverInput.addEventListener('blur', () => {
      // beri sedikit delay agar klik pada suggestion tetap terdaftar
      setTimeout(clearSuggestions, 1);
    });

    document.addEventListener('click', (e) => {
      if (suggestionBox && !suggestionBox.contains(e.target) && e.target !== receiverInput) {
        clearSuggestions();
      }
    });
  }

  if (suggestionBox) {
    suggestionBox.addEventListener('mousedown', (e) => {
      const target = e.target.closest('.suggestion-item');
      if (target && receiverInput) {
        receiverInput.value = target.dataset.username || target.textContent.trim();
        clearSuggestions();
        // cegah blur sebelum klik selesai
        e.preventDefault();
      }
    });

    suggestionBox.addEventListener('click', (e) => {
      const target = e.target.closest('.suggestion-item');
      if (target && receiverInput) {
        receiverInput.value = target.dataset.username || target.textContent.trim();
        clearSuggestions();
        receiverInput.focus();
      }
    });
  }

  if (sendForm) {
    sendForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const receiverUsername = document.getElementById('receiver').value.trim();
      const message = document.getElementById('message').value;
      const attachmentFile = document.getElementById('attachment')?.files?.[0] || null;

      if (!receiverUsername || !message) {
        setStatus('Username penerima dan pesan wajib diisi.');
        return;
      }

      if (!userPrivateKey) {
        setStatus('Kunci privat tidak tersedia. Tidak bisa menandatangani pesan.');
        return;
      }

      try {
        let attachmentBase64 = '';
        if (attachmentFile) {
          setStatus('Membaca lampiran...');
          attachmentBase64 = await readFileAsBase64(attachmentFile);
        }

        setStatus('Mengambil public key penerima...');
        const publicKeyResponse = await fetchReceiverPublicKey(receiverUsername);
        if (!publicKeyResponse.success) {
          throw new Error(publicKeyResponse.message || 'Gagal mengambil public key penerima.');
        }

        const receiverPublicKey = publicKeyResponse.public_key;

        const sessionKey = generateSessionKey();
        const encryptedMessage = encryptMessage(message, sessionKey);
        const encryptedSessionKey = encryptSessionKey(sessionKey, receiverPublicKey);
        const encryptedAttachment = encryptAttachment(attachmentBase64, sessionKey);
        const signature = signMessage(message, attachmentBase64, userPrivateKey);

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
          encrypted_attachment: encryptedAttachment,
          signature: signature
        };

        const sendResponse = await sendEncryptedMail(payload);
        if (!sendResponse.success) {
          throw new Error(sendResponse.message || 'Pengiriman pesan gagal.');
        }

        setStatus('Pesan terenkripsi berhasil dikirim!', true);
        sendForm.reset();
        clearSuggestions();
      } catch (error) {
        setStatus(error.message || 'Terjadi kesalahan saat mengirim pesan.');
      }
    });
  }
})();
