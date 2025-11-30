const token = localStorage.getItem('token');
const privateKey = localStorage.getItem('privateKey');
const statusText = document.getElementById('status-text');
const sendForm = document.getElementById('send-form');
const inboxList = document.getElementById('inbox-list');
const refreshInboxButton = document.getElementById('refresh-inbox');
const showAllCheckbox = document.getElementById('show-all');

if (!token) {
    alert('Anda belum login. Silakan login terlebih dahulu.');
    window.location.href = 'login.html';
}

if (!privateKey) {
    alert('Kunci privat tidak ditemukan di perangkat ini. Silakan login ulang atau daftar ulang.');
}

const setStatus = (message, success = false) => {
    if (!statusText) {
        return;
    }
    statusText.textContent = message;
    statusText.style.color = success ? 'var(--success)' : 'var(--danger)';
};

async function fetchReceiverPublicKey(username) {
    const response = await fetch(`../backend/public_key.php?username=${encodeURIComponent(username)}`, {
        headers: {
            Authorization: `Bearer ${token}`
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

function signCiphertext(ciphertext, senderPrivateKey) {
    const digest = CryptoJS.SHA256(ciphertext).toString();
    const rsa = new JSEncrypt({ default_key_size: 2048 });
    rsa.setPrivateKey(senderPrivateKey);
    return rsa.sign(digest, CryptoJS.SHA256, 'sha256');
}

function verifySignature(ciphertext, signature, senderPublicKey) {
    const digest = CryptoJS.SHA256(ciphertext).toString();
    const rsa = new JSEncrypt({ default_key_size: 2048 });
    rsa.setPublicKey(senderPublicKey);
    return rsa.verify(digest, signature, CryptoJS.SHA256);
}

async function sendEncryptedMail(payload) {
    const response = await fetch('../backend/send_mail.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    return response.json();
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

        if (!privateKey) {
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
            const signature = signCiphertext(encryptedMessage, privateKey);

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

async function fetchInbox() {
    if (!inboxList) return;
    inboxList.innerHTML = '<p class="muted">Memuat inbox...</p>';

    try {
        const params = showAllCheckbox && showAllCheckbox.checked ? '?all=1' : '';
        const response = await fetch(`../backend/inboxes.php${params}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || 'Gagal memuat inbox.');
        }

        const messages = result.messages || [];

        if (!messages.length) {
            inboxList.innerHTML = '<p class="muted">Belum ada pesan.</p>';
            return;
        }

        inboxList.innerHTML = '';

        messages.forEach((msg) => {
            const item = document.createElement('div');
            item.className = 'inbox-item';

            // Verifikasi signature
            const signatureValid = verifySignature(
                msg.encrypted_message,
                msg.signature,
                msg.sender_public_key
            );

            // Dekripsi session key dengan private key penerima
            const rsa = new JSEncrypt({ default_key_size: 2048 });
            rsa.setPrivateKey(privateKey);
            const sessionKey = rsa.decrypt(msg.encrypted_session_key);

            let plaintext = '';
            let decryptError = null;

            if (!sessionKey) {
                decryptError = 'Gagal mendekripsi session key.';
            } else {
                try {
                    const bytes = CryptoJS.AES.decrypt(msg.encrypted_message, sessionKey);
                    plaintext = bytes.toString(CryptoJS.enc.Utf8);
                    if (!plaintext) {
                        decryptError = 'Gagal mendekripsi pesan.';
                    }
                } catch (e) {
                    decryptError = 'Gagal mendekripsi pesan.';
                }
            }

            const signatureBadge = signatureValid
                ? '<span class="badge">Signature OK</span>'
                : '<span class="badge" style="background:#dc3545">Signature FAIL</span>';

            const decryptBadge = !decryptError
                ? '<span class="badge" style="background:#28a745">Decrypted</span>'
                : '<span class="badge" style="background:#dc3545">Decrypt FAIL</span>';

            item.innerHTML = `
                <div>
                    ${signatureBadge}
                    ${decryptBadge}
                </div>
                <p><strong>Dari:</strong> ${msg.sender_username}</p>
                <p class="muted">Untuk: ${msg.receiver_username}</p>
                <p class="muted">Ciphertext:</p>
                <p class="cipher">${msg.encrypted_message}</p>
                <p class="muted">Session Key (encrypted):</p>
                <p class="cipher">${msg.encrypted_session_key}</p>
                <p class="muted">Signature:</p>
                <p class="cipher">${msg.signature}</p>
                <p class="muted">Pesan Terdekripsi:</p>
                <p class="plaintext">${decryptError ? decryptError : plaintext}</p>
            `;

            inboxList.appendChild(item);
        });
    } catch (error) {
        inboxList.innerHTML = `<p class="muted">Error: ${error.message || 'Tidak dapat memuat inbox.'}</p>`;
    }
}

if (refreshInboxButton) {
    refreshInboxButton.addEventListener('click', fetchInbox);
    // Muat awal
    fetchInbox();
}
