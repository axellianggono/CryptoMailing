<?php

require '../vendor/autoload.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

require 'env.php';
require 'database.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(["success" => false, "message" => "Invalid request method."]);
    exit;
}

// Ambil token dari header Authorization: Bearer <token>
$headers = function_exists('getallheaders') ? getallheaders() : [];
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;

if (!$authHeader || stripos($authHeader, 'Bearer ') !== 0) {
    echo json_encode(["success" => false, "message" => "Authorization header missing or invalid."]);
    exit;
}

$jwt = trim(substr($authHeader, 7));

try {
    $decoded = JWT::decode($jwt, new Key($appKey, 'HS256'));
} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => "Invalid token: " . $e->getMessage()]);
    exit;
}

$username = $_GET['username'] ?? '';

if ($username === '') {
    echo json_encode(["success" => false, "message" => "Username is required."]);
    exit;
}

$stmt = $conn->prepare("SELECT id, public_key FROM users WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows === 0) {
    $stmt->close();
    echo json_encode(["success" => false, "message" => "User not found."]);
    exit;
}

$stmt->bind_result($userId, $publicKey);
$stmt->fetch();
$stmt->close();

echo json_encode([
    "success" => true,
    "receiver_id" => $userId,
    "public_key" => $publicKey
]);
