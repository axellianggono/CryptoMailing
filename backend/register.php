<?php

require 'database.php';

function registerUser($username, $password, $publicKey) {
    global $conn;

    // Cek apakah username sudah ada
    $stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows > 0) {
        return ["success" => false, "message" => "Username sudah terdaftar."];
    }

    $stmt->close();

    // Hash password sebelum disimpan
    $hashedPassword = password_hash($password, PASSWORD_BCRYPT);

    // Simpan user baru ke database
    $stmt = $conn->prepare("INSERT INTO users (username, password, public_key) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $username, $hashedPassword, $publicKey);

    if ($stmt->execute()) {
        return ["success" => true, "message" => "Registrasi berhasil."];
    } else {
        return ["success" => false, "message" => "Terjadi kesalahan saat registrasi."];
    }
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        $username = $data['username'];
        $password = $data['password'];
        $publicKey = $data['public_key'];

        $result = registerUser($username, $password, $publicKey);
        header('Content-Type: application/json');
        echo json_encode($result);
    } catch (Exception $e) {
        header('Content-Type: application/json');
        echo json_encode(["success" => false, "message" => "Error: " . $e->getMessage()]);
    }
} else {
    header('Content-Type: application/json');
    echo json_encode(["success" => false, "message" => "Invalid request method."]);
}