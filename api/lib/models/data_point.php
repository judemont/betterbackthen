<?php

class DataPoint {
    public int $x;
    public float $y;

    public function __construct(int $x, float $y) {
        $this->x = $x;
        $this->y = $y;
    }
}