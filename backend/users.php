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
    $userId = $decoded->data->id ?? 0;
} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => "Invalid token: " . $e->getMessage()]);
    exit;
}

$q = $_GET['q'] ?? '';
$like = '%' . $q . '%';

$stmt = $conn->prepare("
    SELECT username
    FROM users
    WHERE username LIKE ? AND id != ?
    ORDER BY username ASC
    LIMIT 10
");
$stmt->bind_param("si", $like, $userId);
$stmt->execute();
$result = $stmt->get_result();

$users = [];
while ($row = $result->fetch_assoc()) {
    $users[] = $row['username'];
}
$stmt->close();

echo json_encode([
    "success" => true,
    "users" => $users
]);
