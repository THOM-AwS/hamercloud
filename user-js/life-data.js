function calculateLifeTime() {
  const birthDate = new Date("1983-05-23");
  const averageLifespan = 83; // in years

  // Function to update time
  const updateTime = () => {
    const currentDate = new Date();

    // Calculate milliseconds lived and left
    const millisecondsLived = currentDate - birthDate;
    const totalLifespanMilliseconds =
      averageLifespan * 365.25 * 24 * 60 * 60 * 1000; // accounts for leap years
    const millisecondsLeft = totalLifespanMilliseconds - millisecondsLived;

    // Convert and update
    document.getElementById("timeLived").textContent = formatTime(
      convertMilliseconds(millisecondsLived)
    );
    document.getElementById("timeLeft").textContent = formatTime(
      convertMilliseconds(millisecondsLeft)
    );
  };

  // Initial update
  updateTime();

  // Update every second (1000 milliseconds)
  setInterval(updateTime, 1000);
}

function convertMilliseconds(milliseconds) {
  let seconds = Math.floor(milliseconds / 1000);
  let minutes = Math.floor(seconds / 60);
  let hours = Math.floor(minutes / 60);
  let days = Math.floor(hours / 24);
  let years = Math.floor(days / 365.25);

  days %= 365.25;
  hours %= 24;
  minutes %= 60;
  seconds %= 60;

  return { years, days, hours, minutes, seconds };
}

function formatTime(time) {
  return `${time.years} years, ${time.days} days, ${time.hours} hours, ${time.minutes} minutes, and ${time.seconds} seconds`;
}

// Call the function on page load
window.onload = calculateLifeTime;
