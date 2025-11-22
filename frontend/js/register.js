const registerButton = document.getElementById('register-button');

function generateKeyPair() {
    const rsa = new JSEncrypt({ default_key_size: 2048 });
    rsa.getKey();
    const publicKey = rsa.getPublicKey();
    const privateKey = rsa.getPrivateKey();

    return { publicKey, privateKey };
}

async function registerUser() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const { publicKey, privateKey } = generateKeyPair();

    const payload = {
        username: username,
        password: password,
        public_key: publicKey
    }

    console.log('Registering user with payload:', payload);

    const response = await fetch('../backend/register.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result['success']) {
        alert('Registration successful!');
        localStorage.setItem('privateKey', privateKey);
        window.location.href = 'login.html';
    } else {
        alert('Registration failed: ' + result.message);
    }
}

registerButton.addEventListener('click', function(event) {
    event.preventDefault();
    registerUser();
});