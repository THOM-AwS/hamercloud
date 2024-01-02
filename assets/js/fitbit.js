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

function processSteps(stepsData) {
  const labels = stepsData.map((item) => {
    const date = new Date(item.dateTime);
    return date.getDate(); // Extracts the day of the month
  });
  const values = stepsData.map((item) => parseInt(item.value, 10));

  return { labels, values };
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
      animation: { duration: 5000, easing: "easeInOutElastic", y: { from: 0 } },
      hover: { mode: "nearest", intersect: true, animationDuration: 400 },
      tooltips: { mode: "nearest", intersect: true, animationDuration: 400 },
      responsive: true,
      legend: { display: true, position: "top" },
    },
  });
}

function processFitbitData(apiResponse) {
  apiResponse.forEach((responseItem) => {
    if (responseItem.statusCode === 200) {
      if (responseItem.body["activities-steps"]) {
        const stepsData = responseItem.body["activities-steps"];
        const chartData = processSteps(stepsData);
        createChart("chartsContainer", chartData, "Daily Steps");
      }
    }
  });
}

async function init() {
  const fitbitApiResponse = await fetchFitbitData();
  console.log(fitbitApiResponse);
  if (fitbitApiResponse) {
    processFitbitData(fitbitApiResponse);
  }
}

window.onload = init();
