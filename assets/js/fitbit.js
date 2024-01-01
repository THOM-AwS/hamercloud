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
    // Process Heart Rate Intraday Data
    if (
      response.statusCode === 200 &&
      response.body["activities-heart-intraday"]
    ) {
      const heartRateData = response.body["activities-heart-intraday"].dataset;
      const heartRateChartData = processDataset(
        heartRateData,
        "Heart Rate Intraday"
      );
      createChart(
        "chartsContainer",
        heartRateChartData,
        `Chart for Heart Rate Intraday`
      );
    }

    // Process Activity Calories Data
    if (
      response.statusCode === 200 &&
      response.body["activities-activityCalories"]
    ) {
      const activityCaloriesData = response.body["activities-activityCalories"];
      const activityCaloriesChartData = processDataset(
        activityCaloriesData,
        "Activity Calories"
      );
      createChart(
        "chartsContainer",
        activityCaloriesChartData,
        `Chart for Activity Calories`
      );
    }

    // Process Activity Steps Data
    if (response.statusCode === 200 && response.body["activities-steps"]) {
      const activitySteps = response.body["activities-steps"];
      const activityStepsChartData = processDataset(
        activitySteps,
        "Activity Steps"
      );
      createChart(
        "chartsContainer",
        activityStepsChartData,
        `Chart for Activity Steps`
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
