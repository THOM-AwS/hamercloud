// function addWeatherToMap(map, lat, lon) {
//   const apiKey = "27dd553d3274c2f0760332bb947b1802";
//   const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}`;

//   fetch(url)
//     .then((response) => {
//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }
//       return response.json();
//     })
//     .then((data) => {
//       if (data && data.weather) {
//         const weather = data.weather[0];
//         const main = data.main;
//         const clouds = data.clouds;
//         const wind = data.wind;
//         const sys = data.sys;
//         const iconUrl =
//           "https://openweathermap.org/img/w/" + weather.icon + ".png";

//         const tempCelsius = (main.temp - 273.15).toFixed(1);
//         const feelsLikeCelsius = (main.feels_like - 273.15).toFixed(1);
//         const minTempCelsius = (main.temp_min - 273.15).toFixed(1);
//         const maxTempCelsius = (main.temp_max - 273.15).toFixed(1);

//         const infowindowContent = `
// 										<div style="color: black;">
// 											<h3 style="color: black;">${data.name} Weather</h3><br>
// 											<img src="${iconUrl}" alt="${weather.description}" /><br>
// 											<span style="color: black;">Condition: ${weather.main} (${
//           weather.description
//         })</span><br>
// 											<span style="color: black;">Temperature: ${tempCelsius} °C (Feels like: ${feelsLikeCelsius} °C)</span><br>
// 											<span style="color: black;">Min/Max Temp: ${minTempCelsius} °C / ${maxTempCelsius} °C</span><br>
// 											<span style="color: black;">Pressure: ${main.pressure} hPa</span><br>
// 											<span style="color: black;">Humidity: ${main.humidity}%</span><br>
// 											<span style="color: black;">Wind: ${(wind.speed * 3.6).toFixed(2)} km/h, ${
//           wind.deg
//         } degrees</span><br>
// 											<span style="color: black;">Cloudiness: ${clouds.all}%</span><br>
// 											<span style="color: black;">Sunrise: ${new Date(
//                         sys.sunrise * 1000
//                       ).toLocaleTimeString()}</span><br>
// 											<span style="color: black;">Sunset: ${new Date(
//                         sys.sunset * 1000
//                       ).toLocaleTimeString()}</span><br>
// 										</div>
// 									`;

//         const marker = new google.maps.Marker({
//           position: { lat, lng: lon },
//           map: map,
//           icon: {
//             url: iconUrl,
//             // Set the anchor to offset the icon vertically
//             anchor: new google.maps.Point(0, -35), // Adjust the second parameter to change vertical offset
//           },
//           title: weather.description,
//         });

//         const infowindow = new google.maps.InfoWindow({
//           content: infowindowContent,
//         });

//         marker.addListener("click", () => {
//           infowindow.open(map, marker);
//         });
//       } else {
//         console.error("Weather data is missing");
//       }
//     })
//     .catch((error) => console.error("Error fetching weather data:", error));
// }
