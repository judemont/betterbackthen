const API_BASE = './api';
const DEFAULT_YEAR = 1980;

const yearForm = document.getElementById('year-form');
const yearInput = document.getElementById('year-input');
const shareButton = document.getElementById('share-button');
const resultsCountEl = document.getElementById('results-count');
const statsGrid = document.getElementById('stats-grid');
const cardTemplate = document.getElementById('stat-card-template');
const MIN_YEAR = 1700;
const MAX_YEAR = new Date().getFullYear() - 1;

yearInput.min = String(MIN_YEAR);
yearInput.max = String(MAX_YEAR);

function getInitialYear() {
  const url = new URL(window.location.href);
  const requestedYear = url.searchParams.get('year') ?? url.searchParams.get('y');
  return clampYear(requestedYear ?? DEFAULT_YEAR);
}

function formatNumber(value, unit = '') {
  const formatter = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 2,
  });
  return `${formatter.format(value)}${unit ? ` ${unit}` : ''}`;
}

function getOptimalDecimals(minValue, maxValue) {
  const range = Math.abs(maxValue - minValue);
  
  // If range is very small, keep 2 decimals for precision
  if (range < 1) return 2;
  
  // If range is small, keep 1 decimal
  if (range < 10) return 1;
  
  // Otherwise, use whole numbers
  return 0;
}

function formatAxisLabel(value, unit = '', decimals = 0) {
  const formatter = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${formatter.format(value)}${unit ? ` ${unit}` : ''}`;
}

function clampYear(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_YEAR;
  }
  return Math.min(MAX_YEAR, Math.max(MIN_YEAR, parsed));
}

function shuffleArray(array) {
  // Fisher-Yates shuffle
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function clearGrid() {
  statsGrid.innerHTML = '';
}

function updateShareUrl(year) {
  const url = new URL(window.location.href);
  url.searchParams.set('year', String(year));
  url.searchParams.delete('y');
  window.history.replaceState({}, '', `${url.pathname}?year=${encodeURIComponent(String(year))}${url.hash}`);
}

async function copyShareLink(year) {
  const url = new URL(window.location.href);
  url.searchParams.set('year', String(year));
  url.searchParams.delete('y');
  const shareUrl = url.toString();

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(shareUrl);
      shareButton.textContent = 'Link copied';
      window.setTimeout(() => {
        shareButton.textContent = 'Share link';
      }, 1400);
      return;
    }
  } catch {
    // Fall through to the prompt fallback.
  }

  window.prompt('Copy this link:', shareUrl);
}

function createLinePath(points, width, height, padding) {
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const minX = points[0].x;
  const maxX = points[points.length - 1].x;
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const xRange = Math.max(1, maxX - minX);
  const yRange = Math.max(1e-9, maxY - minY);

  return points.map((point, index) => {
    const x = padding.left + ((point.x - minX) / xRange) * plotWidth;
    const y = padding.top + (1 - (point.y - minY) / yRange) * plotHeight;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

function createFilledPath(points, width, height, padding) {
  const linePath = createLinePath(points, width, height, padding);
  const minX = points[0].x;
  const maxX = points[points.length - 1].x;
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const yRange = Math.max(1e-9, maxY - minY);
  const leftX = padding.left;
  const rightX = width - padding.right;
  const bottomY = height - padding.bottom;
  const zeroY = padding.top + (1 - (0 - minY) / yRange) * (height - padding.top - padding.bottom);
  const baselineY = Number.isFinite(zeroY) ? Math.max(bottomY, zeroY) : bottomY;

  return `${linePath} L ${rightX.toFixed(2)} ${baselineY.toFixed(2)} L ${leftX.toFixed(2)} ${baselineY.toFixed(2)} Z`;
}

function interpolatePoint(leftPoint, rightPoint, year) {
  const span = rightPoint.x - leftPoint.x;
  if (span <= 0) {
    return { x: year, y: leftPoint.y };
  }

  const ratio = (year - leftPoint.x) / span;
  return {
    x: year,
    y: leftPoint.y + ((rightPoint.y - leftPoint.y) * ratio),
  };
}

function trimSeriesFromYear(points, selectedYear) {
  if (!Number.isFinite(selectedYear)) {
    return points;
  }

  if (selectedYear <= points[0].x) {
    return points;
  }

  const exactIndex = points.findIndex((point) => point.x === selectedYear);
  if (exactIndex !== -1) {
    return points.slice(exactIndex);
  }

  const rightIndex = points.findIndex((point) => point.x > selectedYear);
  if (rightIndex === -1) {
    return [points[points.length - 1]];
  }

  const leftPoint = points[rightIndex - 1];
  const rightPoint = points[rightIndex];
  const startPoint = interpolatePoint(leftPoint, rightPoint, selectedYear);
  return [startPoint, ...points.slice(rightIndex)];
}

function getClosestPoint(points, targetYear) {
  return points.reduce((closest, point) => {
    const pointDistance = Math.abs(point.x - targetYear);
    const closestDistance = Math.abs(closest.x - targetYear);

    if (pointDistance < closestDistance) {
      return point;
    }

    if (pointDistance === closestDistance && point.x < closest.x) {
      return point;
    }

    return closest;
  });
}

function renderChart(svg, data, selectedYear, unit) {
  const width = 640;
  const height = 220;
  const padding = { top: 22, right: 22, bottom: 30, left: 80 };
  const points = data.slice().sort((a, b) => a.x - b.x);
  const chartPoints = trimSeriesFromYear(points, selectedYear);
  const minY = Math.min(...chartPoints.map((point) => point.y));
  const maxY = Math.max(...chartPoints.map((point) => point.y));
  const minX = chartPoints[0].x;
  const maxX = chartPoints[chartPoints.length - 1].x;
  const wrap = svg.parentElement;
  const tooltip = wrap.querySelector('.chart-tooltip');

  svg.innerHTML = '';

  const decimals = getOptimalDecimals(minY, maxY);
  const gridLines = 4;
  for (let index = 0; index <= gridLines; index += 1) {
    const y = padding.top + ((height - padding.top - padding.bottom) / gridLines) * index;
    const ratio = index / gridLines;
    const value = maxY - (ratio * (maxY - minY));
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(padding.left));
    line.setAttribute('x2', String(width - padding.right));
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    line.setAttribute('class', 'chart-grid');
    svg.appendChild(line);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(padding.left - 10));
    label.setAttribute('y', String(y + 4));
    label.setAttribute('class', 'chart-axis-label chart-axis-label--y');
    label.setAttribute('text-anchor', 'end');
    label.textContent = formatAxisLabel(value, unit, decimals);
    svg.appendChild(label);
  }

  const baseline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  baseline.setAttribute('x1', String(padding.left));
  baseline.setAttribute('x2', String(width - padding.right));
  baseline.setAttribute('y1', String(height - padding.bottom));
  baseline.setAttribute('y2', String(height - padding.bottom));
  baseline.setAttribute('class', 'chart-axis');
  svg.appendChild(baseline);

  const firstYearLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  firstYearLabel.setAttribute('x', String(padding.left));
  firstYearLabel.setAttribute('y', String(height - 8));
  firstYearLabel.setAttribute('class', 'chart-axis-label chart-axis-label--x');
  firstYearLabel.setAttribute('text-anchor', 'start');
  firstYearLabel.textContent = String(chartPoints[0].x);
  svg.appendChild(firstYearLabel);

  const lastYearLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  lastYearLabel.setAttribute('x', String(width - padding.right));
  lastYearLabel.setAttribute('y', String(height - 8));
  lastYearLabel.setAttribute('class', 'chart-axis-label chart-axis-label--x');
  lastYearLabel.setAttribute('text-anchor', 'end');
  lastYearLabel.textContent = String(chartPoints[chartPoints.length - 1].x);
  svg.appendChild(lastYearLabel);

  const fill = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  fill.setAttribute('d', createFilledPath(chartPoints, width, height, padding));
  fill.setAttribute('class', 'chart-fill');
  svg.appendChild(fill);

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', createLinePath(chartPoints, width, height, padding));
  path.setAttribute('class', 'chart-line');
  svg.appendChild(path);

  const xRange = Math.max(1, maxX - minX);
  const yRange = Math.max(1e-9, maxY - minY);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const hoverLayer = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  hoverLayer.setAttribute('x', '0');
  hoverLayer.setAttribute('y', '0');
  hoverLayer.setAttribute('width', String(width));
  hoverLayer.setAttribute('height', String(height));
  hoverLayer.setAttribute('fill', 'transparent');
  hoverLayer.setAttribute('class', 'chart-hover-layer');
  svg.appendChild(hoverLayer);

  const hoverLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  hoverLine.setAttribute('y1', String(padding.top));
  hoverLine.setAttribute('y2', String(height - padding.bottom));
  hoverLine.setAttribute('class', 'chart-hover-line');
  hoverLine.style.display = 'none';
  svg.appendChild(hoverLine);

  const minChartX = padding.left;
  const maxChartX = width - padding.right;

  const hideTooltip = () => {
    tooltip.classList.remove('is-visible');
    hoverLine.style.display = 'none';
  };

  const showTooltip = (clientX, clientY) => {
    const wrapRect = wrap.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();

    // Convert screen coordinates to SVG coordinates (0-640)
    const svgX = ((clientX - svgRect.left) / svgRect.width) * width;

    const chartX = Math.max(minChartX, Math.min(maxChartX, svgX));
    const xScale = (maxX - minX) / Math.max(1, maxChartX - minChartX);
    const hoveredYear = minX + (chartX - minChartX) * xScale;
    const nearestPoint = getClosestPoint(chartPoints, hoveredYear);

    const nearestX = padding.left + ((nearestPoint.x - minX) / xRange) * plotWidth;
    const nearestY = padding.top + (1 - (nearestPoint.y - minY) / yRange) * plotHeight;

    tooltip.textContent = `${nearestPoint.x}: ${formatNumber(nearestPoint.y, unit)}`;
    tooltip.classList.add('is-visible');

    hoverLine.setAttribute('x1', String(nearestX));
    hoverLine.setAttribute('x2', String(nearestX));
    hoverLine.style.display = 'block';

    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;

    // Convert SVG coordinates to pixel coordinates relative to .chart-wrap container
    const tooltipPixelX = (nearestX / width) * svgRect.width;
    const tooltipPixelY = (nearestY / height) * svgRect.height;

    const tooltipX = (tooltipPixelX + svgRect.left) - wrapRect.left - tooltipWidth / 2;
    const tooltipY = (tooltipPixelY + svgRect.top) - wrapRect.top - tooltipHeight - 8;
    tooltip.style.left = `${Math.max(12, Math.min(tooltipX, wrapRect.width - tooltipWidth - 12))}px`;
    tooltip.style.top = `${Math.max(12, Math.min(tooltipY, wrapRect.height - tooltipHeight - 12))}px`;
  };

  hoverLayer.addEventListener('mousemove', (event) => {
    showTooltip(event.clientX, event.clientY);
  });

  hoverLayer.addEventListener('mouseenter', (event) => {
    showTooltip(event.clientX, event.clientY);
  });

  hoverLayer.addEventListener('mouseleave', hideTooltip);
}

function renderError(message) {
  clearGrid();
  const empty = document.createElement('div');
  empty.className = 'error-state';
  empty.textContent = message;
  statsGrid.appendChild(empty);
}

function renderEmpty(message) {
  clearGrid();
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.textContent = message;
  statsGrid.appendChild(empty);
}

function makeCard(stat, year) {
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  const referencePoint = getClosestPoint(stat.data, year);
  const latestPoint = stat.data.reduce((latest, point) => (point.x > latest.x ? point : latest));
  const improvement = stat.positive_upward_trend
    ? latestPoint.y - referencePoint.y
    : referencePoint.y - latestPoint.y;
  const referenceYear = referencePoint.x;

  card.querySelector('.stat-title').textContent = stat.title;
  card.querySelector('.stat-description').textContent = stat.description || '';
  card.querySelector('.stat-badge').textContent = `Improved since ${referenceYear}`;
  card.querySelector('.metric-reference').textContent = formatNumber(referencePoint.y, stat.unit);
  card.querySelector('.metric-latest').textContent = formatNumber(latestPoint.y, stat.unit);
  card.querySelector('.stat-badge').title = improvement >= 0 ? 'Improved value' : 'Lower value';

  // Update the reference year label
  const metricLabels = card.querySelectorAll('.metric-label');
  metricLabels[0].textContent = `In ${referenceYear}`;

  const sourceButton = card.querySelector('.stat-source');
  const sourceText = card.querySelector('.stat-source__text');
  sourceText.textContent = '';
  sourceButton.title = stat.source;
  sourceButton.setAttribute('aria-label', `Source: ${stat.source}`);

  const svg = card.querySelector('.chart');
  renderChart(svg, stat.data, year, stat.unit);
  return card;
}

async function loadStatistics(year) {
  const normalizedYear = clampYear(year);
  yearInput.value = String(normalizedYear);
  updateShareUrl(normalizedYear);
  resultsCountEl.textContent = '';
  clearGrid();

  try {
    const listResponse = await fetch(`${API_BASE}/get_statistics.php?y=${encodeURIComponent(normalizedYear)}`);
    if (!listResponse.ok) {
      throw new Error('Unable to load the statistics list.');
    }

    const selectedStats = await listResponse.json();
    if (!Array.isArray(selectedStats) || selectedStats.length === 0) {
      resultsCountEl.textContent = '0 statistics shown.';
      renderEmpty('Maybe yes..');
      return;
    }

    const details = await Promise.all(
      selectedStats.map(async (stat) => {
        const response = await fetch(`${API_BASE}/get_statistic.php?id=${encodeURIComponent(stat.id)}`);
        if (!response.ok) {
          throw new Error(`Unable to load ${stat.title}.`);
        }
        return response.json();
      }),
    );

    // Randomize order before rendering
    shuffleArray(details);

    resultsCountEl.textContent = `${details.length} statistic${details.length > 1 ? 's' : ''} shown.`;
    clearGrid();
    details.forEach((stat) => {
      statsGrid.appendChild(makeCard(stat, normalizedYear));
    });
  } catch (error) {
    resultsCountEl.textContent = '';
    renderError(error.message || 'Something went wrong.');
  }
}

yearForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!yearInput.reportValidity()) {
    return;
  }
  loadStatistics(yearInput.value);
});

yearInput.addEventListener('change', () => {
  loadStatistics(yearInput.value);
});

shareButton.addEventListener('click', () => {
  if (!yearInput.reportValidity()) {
    return;
  }

  copyShareLink(clampYear(yearInput.value));
});

loadStatistics(getInitialYear());