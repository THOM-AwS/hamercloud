async function fetchFitbitData() {
  try {
    const response = await fetch("https://api.hamer.cloud/fitbit");
    if (!response.ok) {
      if (response.status === 429) {
        // Specific handling for rate limit errors
        return { error: "API requests limited" };
      }
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching Fitbit data:", error);
    return { error: error.message };
  }
}

function processHeartRate(heartRateData) {
  const labels = heartRateData.map((item) => {
    const date = new Date(item.dateTime);
    return date.getDate().toString(); // Extracts just the day of the month
  });
  const values = heartRateData.map((item) => item.value.restingHeartRate);

  return { labels, values };
}

function processIntradayHeartRate(intradayData) {
  const labels = intradayData["activities-heart-intraday"].dataset.map(
    (item) => item.time
  );
  const values = intradayData["activities-heart-intraday"].dataset.map(
    (item) => item.value
  );

  return { labels, values };
}

function processSteps(stepsData) {
  const labels = stepsData.map((item) => {
    const date = new Date(item.dateTime);
    return date.getDate(); // Extracts the day of the month
  });
  const values = stepsData.map((item) => parseInt(item.value, 10));

  return { labels, values };
}

function createChart(containerId, data, label, includeAnnotations = false) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  document.getElementById(containerId).appendChild(canvas);

  const annotations = includeAnnotations
    ? {
        annotations: {
          line1: {
            type: "line",
            yMin: 7500,
            yMax: 7500,
            borderColor: "rgba(255, 193, 7, 0.2)", // Amber color
            borderWidth: 1,
            label: {
              content: "Minor Goal",
              enabled: true,
              position: "end",
              backgroundColor: "rgba(255, 193, 7, 0.2)", // Semi-transparent amber
            },
          },
          line2: {
            type: "line",
            yMin: 12500,
            yMax: 12500,
            borderColor: "rgba(0, 128, 0, 0.2)", // Green color
            borderWidth: 1,
            label: {
              content: "Major Goal",
              enabled: true,
              position: "end",
              backgroundColor: "rgba(0, 128, 0, 0.2)", // Semi-transparent green
            },
          },
        },
      }
    : {};

  new Chart(ctx, {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: label,
          data: data.values,
          borderColor: "rgb(75, 192, 192)",
          backgroundColor: "rgba(75, 192, 192, 0.5)", // Line fill color (not typically visible in line charts)
          pointBackgroundColor: "rgb(75, 192, 192)", // Point background color
          pointBorderColor: "rgb(75, 192, 192)", // Point border color
          pointHoverBackgroundColor: "rgba(255, 99, 132, 0.5)", // Hover background color for points
          pointHoverBorderColor: "rgb(255, 99, 132)", // Hover border color for points
          tension: 0.2,
        },
      ],
    },
    options: {
      scales: { y: { beginAtZero: true } },
      animations: {
        tension: {
          duration: 1000,
          easing: "easeOutBounce",
          from: 0.5,
          to: 0.2,
          loop: true,
        },
      },
      hover: { mode: "nearest", intersect: true, animationDuration: 400 },
      tooltips: { mode: "nearest", intersect: true, animationDuration: 400 },
      responsive: true,
      legend: { display: true, position: "top" },
      plugins: { annotation: annotations },
    },
  });
}

function processFitbitData(apiResponse) {
  const rateLimitExceeded = apiResponse.some(
    (responseItem) => responseItem.statusCode === 429
  );
  if (rateLimitExceeded) {
    displayErrorMessage("429: API requests limited by Fitbit...");
    return;
  }
  apiResponse.forEach((responseItem) => {
    if (responseItem.statusCode === 200) {
      if (responseItem.body["activities-steps"]) {
        const stepsData = responseItem.body["activities-steps"];
        const chartData = processSteps(stepsData);
        const shouldIncludeAnnotations = true;
        createChart(
          "chartsContainer",
          chartData,
          "Daily Steps",
          shouldIncludeAnnotations
        );
      }
      if (responseItem.body["activities-heart"]) {
        console.log("HR");
        const heartRateData = responseItem.body["activities-heart"].map(
          (item) => item
        );
        const heartChartData = processHeartRate(heartRateData);

        // Check if intraday data is also available
        // if (responseItem.body["activities-heart-intraday"]) {
        //   console.log("intraday");
        //   const intradayData = responseItem.body["activities-heart"];
        //   const intradayChartData = processIntradayHeartRate(intradayData);

        //   // Here you can decide how to combine or overlay the data
        //   // For example, adding intraday data as another dataset
        //   heartChartData.values.push(...intradayChartData.values);
        //   heartChartData.labels.push(...intradayChartData.labels);
        // }
        console.log(heartChartData);
        createChart(
          "chartsContainer",
          heartChartData,
          "Resting Heart Rate",
          false
        );
      }
    }
  });
}

function displayErrorMessage(message) {
  const container = document.getElementById("chartsContainer"); // Update with your container ID
  container.innerHTML = `<p class="error-message">${message}</p>`; // Display the error message
}

async function init() {
  const fitbitApiResponse = await fetchFitbitData();
  console.log(fitbitApiResponse);
  if (fitbitApiResponse) {
    processFitbitData(fitbitApiResponse);
  }
}

window.onload = init();
