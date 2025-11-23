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

$headers = function_exists('getallheaders') ? getallheaders() : [];
$authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;

if (!$authHeader || stripos($authHeader, 'Bearer ') !== 0) {
    echo json_encode(["success" => false, "message" => "Authorization header missing or invalid."]);
    exit;
}

$jwt = trim(substr($authHeader, 7));

try {
    $decoded = JWT::decode($jwt, new Key($appKey, 'HS256'));
    $userId = $decoded->data->id ?? null;
} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => "Invalid token: " . $e->getMessage()]);
    exit;
}

if (!$userId) {
    echo json_encode(["success" => false, "message" => "User id missing in token."]);
    exit;
}

$messageId = isset($_GET['id']) ? intval($_GET['id']) : 0;
$fetchAll = isset($_GET['all']) && $_GET['all'] === '1';

if ($messageId <= 0) {
    echo json_encode(["success" => false, "message" => "Message id is required."]);
    exit;
}

if ($fetchAll) {
    $stmt = $conn->prepare("
        SELECT m.id,
               sender.username AS sender_username,
               sender.public_key AS sender_public_key,
               receiver.username AS receiver_username,
               m.message,
               m.session_key,
               m.signature,
               m.receiver_id
        FROM mails m
        JOIN users sender ON sender.id = m.sender_id
        JOIN users receiver ON receiver.id = m.receiver_id
        WHERE m.id = ?
        LIMIT 1
    ");
    $stmt->bind_param("i", $messageId);
} else {
    $stmt = $conn->prepare("
        SELECT m.id,
               sender.username AS sender_username,
               sender.public_key AS sender_public_key,
               receiver.username AS receiver_username,
               m.message,
               m.session_key,
               m.signature,
               m.receiver_id
        FROM mails m
        JOIN users sender ON sender.id = m.sender_id
        JOIN users receiver ON receiver.id = m.receiver_id
        WHERE m.id = ? AND m.receiver_id = ?
        LIMIT 1
    ");
    $stmt->bind_param("ii", $messageId, $userId);
}

$stmt->execute();
$result = $stmt->get_result();
$message = $result->fetch_assoc();
$stmt->close();

if (!$message) {
    echo json_encode(["success" => false, "message" => "Message not found or not authorized."]);
    exit;
}

echo json_encode([
    "success" => true,
    "message" => [
        "id" => $message['id'],
        "sender_username" => $message['sender_username'],
        "sender_public_key" => $message['sender_public_key'],
        "receiver_username" => $message['receiver_username'],
        "encrypted_message" => $message['message'],
        "encrypted_session_key" => $message['session_key'],
        "signature" => $message['signature']
    ]
]);
