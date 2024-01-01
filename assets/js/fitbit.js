async function fetchFitbitData() {
  try {
    const response = await fetch("https://api.hamer.cloud/fitbit");
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching Fitbit data:", error);
    return null;
  }
}

function createChart(containerId, data, label) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  document.getElementById(containerId).appendChild(canvas);

  new Chart(ctx, {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: label,
          data: data.values,
          borderColor: "rgb(75, 192, 192)",
          tension: 0.1,
        },
      ],
    },
    options: { scales: { y: { beginAtZero: false } } },
  });
}

function processDataset(dataset, label) {
  const labels = dataset.map((item) => item.time || item.dateTime);
  const values = dataset.map((item) => item.value);
  return { labels, values, label };
}

function processFitbitData(apiResponse) {
  apiResponse.forEach((response) => {
    if (
      response.statusCode === 200 &&
      response.body["activities-heart-intraday"]
    ) {
      const intradayData = response.body["activities-heart-intraday"].dataset;
      const chartData = processDataset(intradayData, "Heart Rate Intraday");
      createChart(
        "chartsContainer",
        chartData,
        `Chart for Heart Rate Intraday`
      );
    }
  });
}

async function init() {
  const fitbitApiResponse = await fetchFitbitData();
  if (fitbitApiResponse) {
    processFitbitData(fitbitApiResponse);
  }
}

window.onload = init();
