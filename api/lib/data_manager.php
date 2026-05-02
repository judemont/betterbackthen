<?php
include_once __DIR__ . "/models/statistic.php";
include_once __DIR__ . "/models/data_point.php";

class DataManager
{
    /**
     * @return Statistic[]
     */
    static public function getStatistics()
    {
        $DATA_DIR = __DIR__ . "/../data";
        $dirs = scandir($DATA_DIR);
        $statistics = [];

        foreach ($dirs as $dir) {
            $files = scandir($DATA_DIR . "/" . $dir);
            $got_metadata = false;
            $got_data = false;
            foreach ($files as $file) {
                // Get metadata from JSON file
                if (pathinfo($file, PATHINFO_EXTENSION) === "json") {
                    $json = file_get_contents($DATA_DIR . "/" . $dir . "/" . $file);
                    $data = json_decode($json, true);

                    $title = $data['title'] ?? "Unknown";
                    $source = $data['source'] ?? "Unknown";
                    $yAxisLabel = $data['unit'] ?? "";
                    $description = $data['description'] ?? "";
                    $positive_upward_trend = $data['positive_upward_trend'] ?? false;
                    $got_metadata = true;
                }

                // Get data points from CSV file
                if (pathinfo($file, PATHINFO_EXTENSION) === "csv") {
                    $csv = file_get_contents($DATA_DIR . "/" . $dir . "/" . $file);
                    $lines = explode("\n", $csv);
                    $dataPoints = [];
                    foreach (array_slice($lines, 1) as $line) {
                        $parts = str_getcsv($line);
                        if (count($parts) >= 2) {
                            $year = intval($parts[0]);
                            $value = floatval($parts[1]);
                            $dataPoints[] = new DataPoint($year, $value);
                        }
                    }
                    $got_data = true;
                }
            }
            if ($got_metadata && $got_data) {
                $id = base64_encode($title);
                $statistics[] = new Statistic($id, $title, $source, $yAxisLabel, $description, $positive_upward_trend, $dataPoints);
            }
        }
        return $statistics;
    }
}
