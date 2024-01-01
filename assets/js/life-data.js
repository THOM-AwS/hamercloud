function calculateLifeTime() {
  const birthDate = new Date("1983-05-23");
  const averageLifespan = 83; // in years

  // Function to update time
  const updateTime = () => {
    const currentDate = new Date();

    // Calculate milliseconds lived and left
    const millisecondsLived = currentDate.getTime() - birthDate.getTime();
    const totalLifespanMilliseconds =
      averageLifespan * 365.25 * 24 * 60 * 60 * 1000; // accounts for leap years
    const millisecondsLeft = totalLifespanMilliseconds - millisecondsLived;

    // Convert and update
    document.getElementById("timeLived").textContent = formatTime(
      convertMilliseconds(millisecondsLived, birthDate)
    );
    document.getElementById("timeLeft").textContent = formatTime(
      convertMilliseconds(millisecondsLeft, currentDate)
    );
  };

  // Initial update
  updateTime();

  // Update every second (1000 milliseconds)
  setInterval(updateTime, 1000);
}

function convertMilliseconds(milliseconds, startDate) {
  let endDate = new Date(startDate.getTime() + milliseconds);
  let years = endDate.getUTCFullYear() - startDate.getUTCFullYear();
  let months = endDate.getUTCMonth() - startDate.getUTCMonth();
  let days = endDate.getUTCDate() - startDate.getUTCDate();
  let hours = endDate.getUTCHours() - startDate.getUTCHours();
  let minutes = endDate.getUTCMinutes() - startDate.getUTCMinutes();
  let seconds = endDate.getUTCSeconds() - startDate.getUTCSeconds();

  if (seconds < 0) {
    seconds += 60;
    minutes--;
  }
  if (minutes < 0) {
    minutes += 60;
    hours--;
  }
  if (hours < 0) {
    hours += 24;
    days--;
  }
  if (days < 0) {
    months--;
    // Get the number of days in the previous month
    let daysInPreviousMonth = new Date(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      0
    ).getUTCDate();
    days += daysInPreviousMonth;
  }
  if (months < 0) {
    months += 12;
    years--;
  }

  return { years, months, days, hours, minutes, seconds };
}

function formatTime(time) {
  return `${time.years} years, ${time.months} months, ${time.days} days, ${time.hours} hours, ${time.minutes} minutes, and ${time.seconds} seconds`;
}

// Call the function on page load
window.onload = calculateLifeTime;
