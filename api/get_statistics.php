<?php
include_once __DIR__ . "/lib/data_manager.php";

header("Content-Type: application/json");


$reference_year = isset($_GET['y']) ? intval($_GET['y']) : null;

$statistics = DataManager::getStatistics();


if ($reference_year === null) {
   echo json_encode($statistics);
   exit();
}

$selected_stats = [];

foreach ($statistics as $stat) {
    $reference_point = $stat->get_closest_point($reference_year);
  //  echo "Reference point for " . $stat->title . ": (" . $reference_point->x . ", " . $reference_point->y . ")\n";
    if ($reference_point === null) {
        continue;
    }
    $last_point = end($stat->data);
   // echo "Last point for " . $stat->title . ": (" . $last_point->x . ", " . $last_point->y . ")\n";
    
    if (($stat->positive_upward_trend && $reference_point->y < $last_point->y) ||
        (!$stat->positive_upward_trend && $reference_point->y > $last_point->y)) {
        array_push($selected_stats, $stat);
    }
}
echo json_encode($selected_stats);