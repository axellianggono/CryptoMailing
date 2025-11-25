<?php

require '../vendor/autoload.php';

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

require 'env.php';
require 'database.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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
    $senderId = $decoded->data->id ?? null;
} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => "Invalid token: " . $e->getMessage()]);
    exit;
}

if (!$senderId) {
    echo json_encode(["success" => false, "message" => "Sender id missing in token."]);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

$receiverUsername = $data['receiver_username'] ?? '';
$encryptedMessage = $data['encrypted_message'] ?? '';
$encryptedSessionKey = $data['encrypted_session_key'] ?? '';
$encryptedAttachment = $data['encrypted_attachment'] ?? null;
$signature = $data['signature'] ?? '';

if (
    $receiverUsername === '' ||
    $encryptedMessage === '' ||
    $encryptedSessionKey === '' ||
    $signature === ''
) {
    echo json_encode(["success" => false, "message" => "Missing required fields."]);
    exit;
}

// Cari receiver id
$stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
$stmt->bind_param("s", $receiverUsername);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows === 0) {
    $stmt->close();
    echo json_encode(["success" => false, "message" => "Receiver not found."]);
    exit;
}

$stmt->bind_result($receiverId);
$stmt->fetch();
$stmt->close();

$stmt = $conn->prepare("INSERT INTO mails (sender_id, receiver_id, message, session_key, attachment, signature) VALUES (?, ?, ?, ?, ?, ?)");
$stmt->bind_param("iissss", $senderId, $receiverId, $encryptedMessage, $encryptedSessionKey, $encryptedAttachment, $signature);

if ($stmt->execute()) {
    echo json_encode(["success" => true, "message" => "Encrypted mail stored successfully."]);
} else {
    echo json_encode(["success" => false, "message" => "Failed to store encrypted mail."]);
}

$stmt->close();
