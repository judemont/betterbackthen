<?php
include_once __DIR__ . "/lib/data_manager.php";

header("Content-Type: application/json");

$id = isset($_GET['id']) ? $_GET['id'] : null;

if ($id === null) {
    http_response_code(400);
    echo json_encode(["error" => "Missing 'id' parameter"]);
    exit();
}

$statistics = DataManager::getStatistics();

$selected_stat = null;
foreach ($statistics as $stat) {
    if ($stat->id === $id) {
        $selected_stat = $stat;
        break;
    }
}
if ($selected_stat === null) {
    http_response_code(404);
    echo json_encode(["error" => "Statistic not found"]);
    exit();
}
echo json_encode($selected_stat);