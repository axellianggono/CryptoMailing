const loginButton = document.getElementById("login-button");

async function loginUser() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const payload = {
    username: username,
    password: password,
  };

  const response = await fetch("../backend/login.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();

  if (result["success"]) {
    alert("Login successful!");
    localStorage.setItem("token", result["token"]);
    window.location.href = "index.html";
  }
}

loginButton.addEventListener("click", async function (event) {
  event.preventDefault();
  await loginUser();
});
