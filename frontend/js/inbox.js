(() => {
  const authToken = window.authToken;
  const userPrivateKey = window.userPrivateKey;
  const inboxList = document.getElementById('inbox-list');
  const refreshInboxButton = document.getElementById('refresh-inbox');
  const inboxCount = document.getElementById('inbox-count');

  if (!authToken) {
    alert('Anda belum login. Silakan login terlebih dahulu.');
    window.location.href = 'login.html';
    return;
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

  async function fetchInbox() {
    if (!inboxList) return;
    inboxList.innerHTML = `
      <div class="list-group-item text-center text-muted small">
        Memuat inbox...
      </div>
    `;

    try {
      const response = await fetch(`../backend/inboxes.php`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Gagal memuat inbox.');
      }

      const messages = result.messages || [];
      if (inboxCount) {
        inboxCount.textContent = messages.length;
      }

      if (!messages.length) {
        inboxList.innerHTML = `
          <div class="list-group-item text-center text-muted small">
            Belum ada pesan.
          </div>
        `;
        return;
      }

      inboxList.innerHTML = '';
      messages.forEach((msg) => {
        const signatureValid = verifySignature(msg.encrypted_message, msg.signature, msg.sender_public_key);
        const { plaintext, error } = decryptPayload(msg.encrypted_session_key, msg.encrypted_message);
        const detailLink = `message.html?id=${encodeURIComponent(msg.id)}`;

        const item = document.createElement('a');
        item.className = 'list-group-item list-group-item-action';
        item.href = detailLink;

        item.innerHTML = `
          <div class="d-flex w-100 justify-content-between">
            <h6 class="mb-1 text-truncate">${plaintext || '(Tidak bisa mendekripsi pesan)'}</h6>
            <small class="text-muted">ID: ${msg.id}</small>
          </div>
          <p class="mb-1 small text-muted">
            ${msg.sender_username} &#8594; ${msg.receiver_username}
          </p>
          <div class="small">
            ${signatureValid ? '<span class="badge badge-success">Signature OK</span>' : '<span class="badge badge-danger">Signature FAIL</span>'}
            ${error ? '<span class="badge badge-danger ml-1">Decrypt FAIL</span>' : '<span class="badge badge-success ml-1">Decrypted</span>'}
          </div>
        `;

        inboxList.appendChild(item);
      });
    } catch (error) {
      inboxList.innerHTML = `
        <div class="list-group-item text-center text-muted small">
          Error: ${error.message || 'Tidak dapat memuat inbox.'}
        </div>
      `;
    }
  }

  if (refreshInboxButton) {
    refreshInboxButton.addEventListener('click', fetchInbox);
  }

  fetchInbox();
})();
