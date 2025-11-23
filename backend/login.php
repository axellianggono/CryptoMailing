<?php

require '../vendor/autoload.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

require 'env.php';
require 'database.php';


if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        $username = $data['username'];
        $password = $data['password'];
        $hashedPassword = null;

        // Ambil data user dari database
        $stmt = $conn->prepare("SELECT id, password FROM users WHERE username = ?");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $stmt->store_result();

        if ($stmt->num_rows == 0) {
            header('Content-Type: application/json');
            echo json_encode(["success" => false, "message" => "Username atau password salah."]);
            exit;
        }
        
        $stmt->bind_result($userId, $hashedPassword);
        $stmt->fetch();
        $stmt->close();

        // Verifikasi password
        if (!password_verify($password, $hashedPassword)) {
            header('Content-Type: application/json');
            echo json_encode(["success" => false, "message" => "Username atau password salah."]);
            exit;
        }

        $payload = [
            'iat' => time(),
            'nbf' => time(),
            'exp' => time() + (60 * 60), // Token berlaku selama 1 jam
            'data' => [
                'id' => $userId,
                'username' => $username
            ]
        ];

        $jwt = JWT::encode($payload, $appKey, 'HS256');

        header('Content-Type: application/json');
        echo json_encode(["success" => true, "token" => $jwt]);
    } catch (Exception $e) {
        header('Content-Type: application/json');
        echo json_encode(["success" => false, "message" => "Error: " . $e->getMessage()]);
    }
} else {
    header('Content-Type: application/json');
    echo json_encode(["success" => false, "message" => "Invalid request method."]);
}

$conn->close();
