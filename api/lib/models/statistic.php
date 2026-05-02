<?php

class Statistic {
    public string $id;
    public string $title;
    public string $description;
    public string $source;
    public string $unit;
    public bool $positive_upward_trend;
    public array $data;



    public function __construct(string $id, string $title, string $source, string $unit, string $description, bool $positive_upward_trend, array $data) {
        $this->id = $id;
        $this->title = $title;
        $this->source = $source;
        $this->unit = $unit;
        $this->positive_upward_trend = $positive_upward_trend;
        foreach ($data as $point) {
            if (!$point instanceof DataPoint) {
                throw new InvalidArgumentException("Data must be an array of DataPoint objects");
            }
        }
        $this->data = $data;
        $this->description = $description;
    }

    public function get_closest_point(int $year): ?DataPoint {
        $closest_point = null;
        foreach ($this->data as $point) {
            if ($closest_point === null || abs($point->x - $year) < abs($closest_point->x - $year)) {
                $closest_point = $point;
            }
        }
        return $closest_point;
    }
}