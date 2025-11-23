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

$fetchAll = isset($_GET['all']) && $_GET['all'] === '1';

// Ambil pesan. Jika all=1, ambil semua pesan di database (mis. untuk admin/cek data),
// jika tidak, hanya pesan yang ditujukan ke user ini.
if ($fetchAll) {
    $stmt = $conn->prepare("
        SELECT m.id,
               sender.username AS sender_username,
               sender.public_key AS sender_public_key,
               receiver.username AS receiver_username,
               m.message,
               m.session_key,
               m.signature
        FROM mails m
        JOIN users sender ON sender.id = m.sender_id
        JOIN users receiver ON receiver.id = m.receiver_id
        ORDER BY m.id DESC
    ");
} else {
    $stmt = $conn->prepare("
        SELECT m.id,
               sender.username AS sender_username,
               sender.public_key AS sender_public_key,
               receiver.username AS receiver_username,
               m.message,
               m.session_key,
               m.signature
        FROM mails m
        JOIN users sender ON sender.id = m.sender_id
        JOIN users receiver ON receiver.id = m.receiver_id
        WHERE m.receiver_id = ?
        ORDER BY m.id DESC
    ");
    $stmt->bind_param("i", $receiverId);
}
$stmt->execute();
$result = $stmt->get_result();

$messages = [];
while ($row = $result->fetch_assoc()) {
    $messages[] = [
        "id" => $row['id'],
        "sender_username" => $row['sender_username'],
        "sender_public_key" => $row['sender_public_key'],
        "receiver_username" => $row['receiver_username'],
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
