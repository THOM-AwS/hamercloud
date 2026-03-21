(function() {
  'use strict';

  var API_URL = 'https://api.hamer.cloud/fitbit';

  var COLORS = {
    steps: '#4FC3F7',
    hr: '#EF5350',
    fairlyActive: '#FFB74D',
    veryActive: '#FF7043',
    sleepDeep: '#5C6BC0',
    sleepLight: '#7986CB',
    sleepRem: '#9FA8DA',
    sleepWake: '#E0E0E0',
    distance: '#66BB6A',
    weight: '#AB47BC',
    grid: 'rgba(255,255,255,0.1)',
    text: 'rgba(255,255,255,0.7)',
    textBright: 'rgba(255,255,255,0.9)'
  };

  var CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        cornerRadius: 4
      }
    },
    scales: {
      x: {
        ticks: { color: COLORS.text, maxRotation: 0, maxTicksLimit: 7 },
        grid: { color: COLORS.grid }
      },
      y: {
        ticks: { color: COLORS.text },
        grid: { color: COLORS.grid }
      }
    }
  };

  function formatDate(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  }

  function avg(arr) {
    var valid = arr.filter(function(v) { return v != null && v > 0; });
    if (valid.length === 0) return 0;
    return Math.round(valid.reduce(function(a, b) { return a + b; }, 0) / valid.length);
  }

  function last(arr) {
    for (var i = arr.length - 1; i >= 0; i--) {
      if (arr[i] != null && arr[i] > 0) return arr[i];
    }
    return null;
  }

  function deepMerge(target, source) {
    var result = {};
    var key;
    for (key in target) {
      if (target.hasOwnProperty(key)) {
        if (typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key]) &&
            source.hasOwnProperty(key) && typeof source[key] === 'object' && source[key] !== null) {
          result[key] = deepMerge(target[key], source[key]);
        } else {
          result[key] = target[key];
        }
      }
    }
    for (key in source) {
      if (source.hasOwnProperty(key) && !result.hasOwnProperty(key)) {
        result[key] = source[key];
      }
    }
    return result;
  }

  function renderSteps(data) {
    var labels = data.map(function(d) { return formatDate(d.date); });
    var values = data.map(function(d) { return d.steps || 0; });
    var todaySteps = last(values) || 0;
    var avgSteps = avg(values);

    document.getElementById('fitbit-steps-today').textContent = todaySteps.toLocaleString();
    document.getElementById('fitbit-steps-avg').textContent = avgSteps.toLocaleString();

    new Chart(document.getElementById('fitbit-steps-chart'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: COLORS.steps + '99',
          borderColor: COLORS.steps,
          borderWidth: 1,
          borderRadius: 2
        }]
      },
      options: CHART_DEFAULTS
    });
  }

  function renderHeartRate(data) {
    var labels = data.map(function(d) { return formatDate(d.date); });
    var values = data.map(function(d) { return d.resting_hr || null; });
    var latestHr = last(values);
    var avgHr = avg(values);

    document.getElementById('fitbit-hr-latest').textContent = latestHr ? latestHr + ' bpm' : '--';
    document.getElementById('fitbit-hr-avg').textContent = avgHr ? avgHr + ' bpm' : '--';

    new Chart(document.getElementById('fitbit-hr-chart'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          borderColor: COLORS.hr,
          backgroundColor: COLORS.hr + '33',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 5,
          spanGaps: true
        }]
      },
      options: CHART_DEFAULTS
    });
  }

  function renderActiveMinutes(data) {
    var labels = data.map(function(d) { return formatDate(d.date); });
    var fairly = data.map(function(d) { return d.active_minutes_fairly || 0; });
    var very = data.map(function(d) { return d.active_minutes_very || 0; });
    var todayTotal = (last(fairly) || 0) + (last(very) || 0);

    document.getElementById('fitbit-active-today').textContent = todayTotal + ' min';

    new Chart(document.getElementById('fitbit-active-chart'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Very Active',
            data: very,
            backgroundColor: COLORS.veryActive + '99',
            borderColor: COLORS.veryActive,
            borderWidth: 1,
            borderRadius: 2
          },
          {
            label: 'Fairly Active',
            data: fairly,
            backgroundColor: COLORS.fairlyActive + '99',
            borderColor: COLORS.fairlyActive,
            borderWidth: 1,
            borderRadius: 2
          }
        ]
      },
      options: deepMerge(CHART_DEFAULTS, {
        plugins: { legend: { display: true, labels: { color: COLORS.text, boxWidth: 12 } } },
        scales: { x: { stacked: true }, y: { stacked: true } }
      })
    });
  }

  function renderSleep(data) {
    var sleepDays = data.filter(function(d) { return d.sleep_deep_min != null; });
    if (sleepDays.length === 0) {
      document.getElementById('fitbit-sleep-last').textContent = 'No data';
      return;
    }

    var labels = sleepDays.map(function(d) { return formatDate(d.date); });
    var deep = sleepDays.map(function(d) { return (d.sleep_deep_min || 0) / 60; });
    var light = sleepDays.map(function(d) { return (d.sleep_light_min || 0) / 60; });
    var rem = sleepDays.map(function(d) { return (d.sleep_rem_min || 0) / 60; });
    var wake = sleepDays.map(function(d) { return (d.sleep_wake_min || 0) / 60; });

    var lastSleep = sleepDays[sleepDays.length - 1];
    var totalMin = (lastSleep.sleep_deep_min || 0) + (lastSleep.sleep_light_min || 0) +
                   (lastSleep.sleep_rem_min || 0) + (lastSleep.sleep_wake_min || 0);
    var hours = Math.floor(totalMin / 60);
    var mins = totalMin % 60;
    document.getElementById('fitbit-sleep-last').textContent = hours + 'h ' + mins + 'm';

    new Chart(document.getElementById('fitbit-sleep-chart'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Deep', data: deep, backgroundColor: COLORS.sleepDeep, borderRadius: 2 },
          { label: 'Light', data: light, backgroundColor: COLORS.sleepLight, borderRadius: 2 },
          { label: 'REM', data: rem, backgroundColor: COLORS.sleepRem, borderRadius: 2 },
          { label: 'Awake', data: wake, backgroundColor: COLORS.sleepWake, borderRadius: 2 }
        ]
      },
      options: deepMerge(CHART_DEFAULTS, {
        plugins: {
          legend: { display: true, labels: { color: COLORS.text, boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return ctx.dataset.label + ': ' + Math.round(ctx.raw * 60) + ' min';
              }
            }
          }
        },
        scales: {
          x: { stacked: true },
          y: {
            stacked: true,
            title: { display: true, text: 'Hours', color: COLORS.text }
          }
        }
      })
    });
  }

  function renderDistanceWeight(data) {
    var labels = data.map(function(d) { return formatDate(d.date); });
    var distance = data.map(function(d) { return d.distance || 0; });
    var weight = data.map(function(d) { return d.weight || null; });

    var todayDist = last(distance) || 0;
    var latestWeight = last(weight);
    document.getElementById('fitbit-dist-today').textContent = todayDist.toFixed(1) + ' km';
    document.getElementById('fitbit-weight-latest').textContent = latestWeight ? latestWeight.toFixed(1) + ' kg' : '--';

    new Chart(document.getElementById('fitbit-dw-chart'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Distance (km)',
            data: distance,
            borderColor: COLORS.distance,
            backgroundColor: COLORS.distance + '33',
            fill: true,
            tension: 0.3,
            pointRadius: 2,
            yAxisID: 'y'
          },
          {
            label: 'Weight (kg)',
            data: weight,
            borderColor: COLORS.weight,
            borderDash: [5, 5],
            tension: 0.3,
            pointRadius: 3,
            spanGaps: true,
            yAxisID: 'y1'
          }
        ]
      },
      options: deepMerge(CHART_DEFAULTS, {
        plugins: { legend: { display: true, labels: { color: COLORS.text, boxWidth: 12 } } },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            ticks: { color: COLORS.distance },
            grid: { color: COLORS.grid },
            title: { display: true, text: 'km', color: COLORS.distance }
          },
          y1: {
            type: 'linear',
            position: 'right',
            ticks: { color: COLORS.weight },
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'kg', color: COLORS.weight }
          }
        }
      })
    });
  }

  function renderDashboard(data) {
    if (!data || data.length === 0) {
      document.getElementById('fitbit-loading').textContent = 'Health data temporarily unavailable';
      return;
    }

    document.getElementById('fitbit-loading').style.display = 'none';
    document.getElementById('fitbit-charts').style.display = 'block';

    var lastItem = data[data.length - 1];
    if (lastItem && lastItem.date) {
      var d = new Date(lastItem.date + 'T00:00:00');
      document.getElementById('fitbit-updated').textContent =
        'Last data: ' + d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    renderSteps(data);
    renderHeartRate(data);
    renderActiveMinutes(data);
    renderSleep(data);
    renderDistanceWeight(data);
  }

  function init() {
    var container = document.getElementById('fitbit-dashboard');
    if (!container) return;

    fetch(API_URL)
      .then(function(res) { return res.json(); })
      .then(renderDashboard)
      .catch(function(err) {
        console.error('[Fitbit Dashboard] Error:', err);
        document.getElementById('fitbit-loading').textContent = 'Health data temporarily unavailable';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
