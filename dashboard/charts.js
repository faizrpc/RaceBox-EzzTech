/**
 * RaceBox EzzTech Chart Manager
 * Handles all Chart.js rendering for the dashboard.
 */

const Charts = (() => {
  const COLORS = [
    '#e94560', '#0ea5e9', '#22c55e', '#f59e0b',
    '#a855f7', '#14b8a6', '#f97316', '#ec4899',
  ];

  const chartInstances = {};

  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#a0a0b0', font: { size: 12 } }
      },
      tooltip: {
        backgroundColor: '#1a1a2e',
        titleColor: '#eaeaea',
        bodyColor: '#a0a0b0',
        borderColor: '#2a2a3e',
        borderWidth: 1,
        cornerRadius: 8,
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(42, 42, 62, 0.5)' },
        ticks: { color: '#6a6a7a' }
      },
      y: {
        grid: { color: 'rgba(42, 42, 62, 0.5)' },
        ticks: { color: '#6a6a7a' }
      }
    }
  };

  function destroyChart(id) {
    if (chartInstances[id]) {
      chartInstances[id].destroy();
      delete chartInstances[id];
    }
  }

  function createChart(canvasId, config) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    // Ensure parent has height
    ctx.parentElement.style.position = 'relative';
    ctx.parentElement.style.minHeight = '300px';

    chartInstances[canvasId] = new Chart(ctx, config);
    return chartInstances[canvasId];
  }

  /**
   * Render a speed vs time chart for a single run.
   */
  function renderLatestRun(canvasId, run) {
    if (!run || !run.trace || run.trace.length === 0) {
      renderEmptyChart(canvasId, 'No trace data available');
      return;
    }

    // Downsample for performance
    const trace = downsample(run.trace, 200);

    createChart(canvasId, {
      type: 'line',
      data: {
        labels: trace.map(p => p.elapsed.toFixed(1) + 's'),
        datasets: [{
          label: 'Speed (km/h)',
          data: trace.map(p => p.speed),
          borderColor: COLORS[0],
          backgroundColor: 'rgba(233, 69, 96, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        }]
      },
      options: {
        ...defaultOptions,
        plugins: {
          ...defaultOptions.plugins,
          annotation: addMilestoneAnnotations(run),
        },
        scales: {
          ...defaultOptions.scales,
          x: {
            ...defaultOptions.scales.x,
            title: { display: true, text: 'Time (s)', color: '#6a6a7a' },
            ticks: {
              ...defaultOptions.scales.x.ticks,
              maxTicksLimit: 15,
            }
          },
          y: {
            ...defaultOptions.scales.y,
            title: { display: true, text: 'Speed (km/h)', color: '#6a6a7a' },
            beginAtZero: true,
          }
        }
      }
    });
  }

  /**
   * Render personal bests as a bar chart.
   */
  function renderPersonalBests(canvasId, runs) {
    const metrics = [
      { key: 'time_0_30', label: '0-30', unit: 's', lower: true },
      { key: 'time_0_60', label: '0-60', unit: 's', lower: true },
      { key: 'time_0_100', label: '0-100', unit: 's', lower: true },
      { key: 'time_201m', label: '201m', unit: 's', lower: true },
      { key: 'time_402m', label: '402m', unit: 's', lower: true },
      { key: 'top_speed', label: 'Top Speed', unit: 'km/h', lower: false },
    ];

    const labels = [];
    const values = [];
    const colors = [];

    metrics.forEach((m, i) => {
      const validRuns = runs.filter(r => r[m.key] !== null && r[m.key] !== undefined);
      if (validRuns.length === 0) return;

      const best = m.lower
        ? Math.min(...validRuns.map(r => r[m.key]))
        : Math.max(...validRuns.map(r => r[m.key]));

      labels.push(m.label);
      values.push(best);
      colors.push(COLORS[i % COLORS.length]);
    });

    if (labels.length === 0) {
      renderEmptyChart(canvasId, 'No data available');
      return;
    }

    createChart(canvasId, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Personal Best',
          data: values,
          backgroundColor: colors.map(c => c + '80'),
          borderColor: colors,
          borderWidth: 2,
          borderRadius: 6,
        }]
      },
      options: {
        ...defaultOptions,
        plugins: {
          ...defaultOptions.plugins,
          legend: { display: false },
          tooltip: {
            ...defaultOptions.plugins.tooltip,
            callbacks: {
              label: (ctx) => {
                const m = metrics.find(m => m.label === ctx.label);
                return `${ctx.formattedValue} ${m ? m.unit : ''}`;
              }
            }
          }
        },
        scales: {
          ...defaultOptions.scales,
          y: {
            ...defaultOptions.scales.y,
            beginAtZero: true,
          }
        }
      }
    });
  }

  /**
   * Render speed vs time overlay for multiple runs.
   */
  function renderCompareSpeed(canvasId, runs) {
    if (!runs || runs.length === 0) {
      renderEmptyChart(canvasId, 'Select runs to compare');
      return;
    }

    const datasets = runs.map((run, i) => {
      const color = COLORS[i % COLORS.length];
      const label = formatRunLabel(run);

      if (run.trace && run.trace.length > 0) {
        const trace = downsample(run.trace, 150);
        return {
          label: label,
          data: trace.map(p => ({ x: p.elapsed, y: p.speed })),
          borderColor: color,
          backgroundColor: color + '20',
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        };
      } else {
        // Build points from summary data
        const points = [{ x: 0, y: 0 }];
        if (run.time_0_30) points.push({ x: run.time_0_30, y: 30 });
        if (run.time_0_60) points.push({ x: run.time_0_60, y: 60 });
        if (run.time_0_100) points.push({ x: run.time_0_100, y: 100 });
        return {
          label: label,
          data: points,
          borderColor: color,
          fill: false,
          tension: 0.3,
          pointRadius: 4,
          borderWidth: 2,
        };
      }
    });

    createChart(canvasId, {
      type: 'line',
      data: { datasets },
      options: {
        ...defaultOptions,
        scales: {
          x: {
            ...defaultOptions.scales.x,
            type: 'linear',
            title: { display: true, text: 'Time (s)', color: '#6a6a7a' },
            ticks: { ...defaultOptions.scales.x.ticks, maxTicksLimit: 15 },
          },
          y: {
            ...defaultOptions.scales.y,
            title: { display: true, text: 'Speed (km/h)', color: '#6a6a7a' },
            beginAtZero: true,
          }
        }
      }
    });
  }

  /**
   * Render acceleration milestone comparison as grouped bars.
   */
  function renderCompareAccel(canvasId, runs) {
    if (!runs || runs.length === 0) {
      renderEmptyChart(canvasId, 'Select runs to compare');
      return;
    }

    const milestones = [
      { key: 'time_0_30', label: '0-30' },
      { key: 'time_0_60', label: '0-60' },
      { key: 'time_0_100', label: '0-100' },
      { key: 'time_201m', label: '201m' },
      { key: 'time_402m', label: '402m' },
    ];

    const labels = milestones.map(m => m.label);

    const datasets = runs.map((run, i) => ({
      label: formatRunLabel(run),
      data: milestones.map(m => run[m.key] || null),
      backgroundColor: COLORS[i % COLORS.length] + '80',
      borderColor: COLORS[i % COLORS.length],
      borderWidth: 2,
      borderRadius: 4,
    }));

    createChart(canvasId, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        ...defaultOptions,
        scales: {
          ...defaultOptions.scales,
          y: {
            ...defaultOptions.scales.y,
            title: { display: true, text: 'Time (s)', color: '#6a6a7a' },
            beginAtZero: true,
          }
        }
      }
    });
  }

  /**
   * Render a trend line for a specific metric over time.
   */
  function renderTrend(canvasId, runs, metricKey, title) {
    const validRuns = runs
      .filter(r => r[metricKey] !== null && r[metricKey] !== undefined && r.date)
      .sort((a, b) => a.date - b.date);

    if (validRuns.length === 0) {
      renderEmptyChart(canvasId, 'No data for this metric');
      return;
    }

    const labels = validRuns.map(r => formatDate(r.date));
    const values = validRuns.map(r => r[metricKey]);

    // Calculate moving average (window of 3)
    const movingAvg = values.map((v, i) => {
      const start = Math.max(0, i - 1);
      const end = Math.min(values.length, i + 2);
      const window = values.slice(start, end);
      return window.reduce((a, b) => a + b, 0) / window.length;
    });

    createChart(canvasId, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: title || metricKey,
            data: values,
            borderColor: COLORS[0],
            backgroundColor: COLORS[0] + '20',
            fill: true,
            tension: 0.2,
            pointRadius: 4,
            pointBackgroundColor: COLORS[0],
            borderWidth: 2,
          },
          {
            label: 'Trend (3-run avg)',
            data: movingAvg,
            borderColor: COLORS[1],
            borderDash: [5, 5],
            fill: false,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2,
          }
        ]
      },
      options: {
        ...defaultOptions,
        scales: {
          ...defaultOptions.scales,
          x: {
            ...defaultOptions.scales.x,
            title: { display: true, text: 'Date', color: '#6a6a7a' },
          },
          y: {
            ...defaultOptions.scales.y,
            title: { display: true, text: getMetricUnit(metricKey), color: '#6a6a7a' },
          }
        }
      }
    });
  }

  function renderEmptyChart(canvasId, message) {
    createChart(canvasId, {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {
        ...defaultOptions,
        plugins: {
          ...defaultOptions.plugins,
          title: {
            display: true,
            text: message,
            color: '#6a6a7a',
            font: { size: 14 },
          }
        }
      }
    });
  }

  // Helpers

  function downsample(data, maxPoints) {
    if (data.length <= maxPoints) return data;
    const step = Math.ceil(data.length / maxPoints);
    return data.filter((_, i) => i % step === 0);
  }

  function formatRunLabel(run) {
    const date = run.date ? formatDate(run.date) : 'Unknown';
    const tags = run.tags && run.tags.length > 0 ? ' [' + run.tags.join(', ') + ']' : '';
    return date + tags;
  }

  function formatDate(date) {
    if (!date) return '—';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  function getMetricUnit(key) {
    if (key === 'top_speed') return 'km/h';
    return 'Time (s)';
  }

  function addMilestoneAnnotations(run) {
    return {};
  }

  return {
    renderLatestRun,
    renderPersonalBests,
    renderCompareSpeed,
    renderCompareAccel,
    renderTrend,
    COLORS,
  };
})();
