const token = localStorage.getItem('token');

if (!token) {
    alert('You are not logged in! Redirecting to login page.');
    window.location.href = 'login.html';
}

