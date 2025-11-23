(() => {
  const authToken = window.authToken;
  const userPrivateKey = window.userPrivateKey;
  const messageBody = document.getElementById('message-body');

  const badgeSigOk = document.getElementById('badge-signature');
  const badgeSigFail = document.getElementById('badge-signature-fail');
  const badgeDecOk = document.getElementById('badge-decrypt');
  const badgeDecFail = document.getElementById('badge-decrypt-fail');
  const messageInfoToggle = document.getElementById('message-info');
  const messageInfoDetail = document.getElementById('message-info-detail');
  const encryptedMessageElem = document.getElementById('encrypted-message');
  const encryptedSessionElem = document.getElementById('encrypted-session');
  const messageSignatureElem = document.getElementById('message-signature');

  if (!authToken) {
    alert('Anda belum login. Silakan login terlebih dahulu.');
    window.location.href = 'login.html';
    return;
  }

  function getParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }

  const verifySignature = (ciphertext, signature, senderPublicKey) => {
    const digest = CryptoJS.SHA256(ciphertext).toString();
    const rsa = new JSEncrypt();
    rsa.setPublicKey(senderPublicKey);
    return rsa.verify(digest, signature, CryptoJS.SHA256);
  };

  const decryptPayload = (encryptedSessionKey, encryptedMessage) => {
    if (!userPrivateKey) {
      return { plaintext: '', error: 'Kunci privat tidak ditemukan di perangkat ini.' };
    }

    const rsa = new JSEncrypt();
    rsa.setPrivateKey(userPrivateKey);
    const sessionKey = rsa.decrypt(encryptedSessionKey);

    if (!sessionKey) {
      return { plaintext: '', error: 'Gagal mendekripsi session key.' };
    }

    try {
      const bytes = CryptoJS.AES.decrypt(encryptedMessage, sessionKey);
      const plaintext = bytes.toString(CryptoJS.enc.Utf8);
      if (!plaintext) {
        return { plaintext: '', error: 'Gagal mendekripsi pesan.' };
      }
      return { plaintext };
    } catch (e) {
      return { plaintext: '', error: 'Gagal mendekripsi pesan.' };
    }
  };

  async function fetchMessage() {
    if (!messageBody) return;
    messageBody.innerHTML = '<p class="text-muted mb-0">Memuat pesan...</p>';

    const id = getParam('id');

    if (!id) {
      messageBody.innerHTML = '<p class="text-danger mb-0">ID pesan tidak ditemukan.</p>';
      return;
    }

    try {
      const url = `../backend/message.php?id=${encodeURIComponent(id)}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Gagal memuat pesan.');
      }

      const msg = result.message;

      // Tampilkan detail pesan terenkripsi
      encryptedMessageElem.textContent = `${msg.encrypted_message}`;
      encryptedSessionElem.textContent = `${msg.encrypted_session_key}`;
      messageSignatureElem.textContent = `${msg.signature}`;

      const signatureValid = verifySignature(msg.encrypted_message, msg.signature, msg.sender_public_key);
      const { plaintext, error } = decryptPayload(msg.encrypted_session_key, msg.encrypted_message);

      if (badgeSigOk && signatureValid) badgeSigOk.classList.remove('d-none');
      if (badgeSigFail && !signatureValid) badgeSigFail.classList.remove('d-none');
      if (badgeDecOk && !error) badgeDecOk.classList.remove('d-none');
      if (badgeDecFail && error) badgeDecFail.classList.remove('d-none');

      messageBody.innerHTML = `
        <p><strong>Pengirim:</strong> ${msg.sender_username}</p>
        <p><strong>Penerima:</strong> ${msg.receiver_username}</p>
        <p class="text-muted small mb-1">Pesan Terdekripsi:</p>
        <div class="p-3 bg-white border rounded" style="white-space: pre-wrap;">${error ? error : plaintext}</div>
      `;
    } catch (error) {
      messageBody.innerHTML = `<p class="text-danger mb-0">Error: ${error.message || 'Tidak dapat memuat pesan.'}</p>`;
    }
  }

  fetchMessage();

  if (messageInfoToggle && messageInfoDetail) {
    messageInfoToggle.addEventListener('click', () => {
      if (messageInfoDetail.style.display === 'none' || !messageInfoDetail.style.display) {
        messageInfoDetail.style.display = 'block';
      } else {
        messageInfoDetail.style.display = 'none';
      }
    });
  }
})();
