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
    $receiverId = $decoded->data->id ?? null;
} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => "Invalid token: " . $e->getMessage()]);
    exit;
}

if (!$receiverId) {
    echo json_encode(["success" => false, "message" => "Receiver id missing in token."]);
    exit;
}

// Ambil pesan yang diterima beserta username dan public key pengirim
$stmt = $conn->prepare("
    SELECT m.id, u.username AS sender_username, u.public_key AS sender_public_key, m.message, m.session_key, m.signature
    FROM mails m
    JOIN users u ON u.id = m.sender_id
    WHERE m.receiver_id = ?
    ORDER BY m.id DESC
");
$stmt->bind_param("i", $receiverId);
$stmt->execute();
$result = $stmt->get_result();

$messages = [];
while ($row = $result->fetch_assoc()) {
    $messages[] = [
        "id" => $row['id'],
        "sender_username" => $row['sender_username'],
        "sender_public_key" => $row['sender_public_key'],
        "encrypted_message" => $row['message'],
        "encrypted_session_key" => $row['session_key'],
        "signature" => $row['signature']
    ];
}

$stmt->close();

echo json_encode([
    "success" => true,
    "messages" => $messages
]);
