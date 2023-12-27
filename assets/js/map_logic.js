let animationFrameId;
let linePath;
let circles = [];

// Custom logic to check if two bounds intersect
function getFeatureBounds(geometry) {
  const bounds = new google.maps.LatLngBounds();

  if (geometry instanceof google.maps.Data.Polygon) {
    geometry.getArray().forEach((linearRing) => {
      linearRing.getArray().forEach((latLng) => {
        bounds.extend(latLng);
      });
    });
  } else if (geometry instanceof google.maps.Data.MultiPolygon) {
    geometry.getArray().forEach((polygon) => {
      polygon.getArray().forEach((linearRing) => {
        linearRing.getArray().forEach((latLng) => {
          bounds.extend(latLng);
        });
      });
    });
  } else if (geometry instanceof google.maps.Data.Point) {
    bounds.extend(geometry.get());
  } else if (geometry instanceof google.maps.Data.LineString) {
    geometry.getArray().forEach((latLng) => {
      bounds.extend(latLng);
    });
  } else if (geometry instanceof google.maps.Data.MultiLineString) {
    geometry.getArray().forEach((lineString) => {
      lineString.getArray().forEach((latLng) => {
        bounds.extend(latLng);
      });
    });
  } else {
    console.error("Unsupported geometry type:", geometry.getType());
  }

  return bounds;
}

function generateInfoWindowContent(item) {
  return `
							<div>
								<span style="color: black;">Time: ${new Date(
                  item.timestamp * 1000
                ).toLocaleString()}</span><br>
								<span style="color: black;">Latitude: ${item.lat}</span><br>
								<span style="color: black;">Longitude: ${item.lon}</span><br>
								<span style="color: black;">Altitude: ${
                  item.alt ? item.alt + " meters" : "N/A"
                }</span><br>
								<span style="color: black;">Accuracy: ${
                  item.acc ? item.acc + " meters" : "N/A"
                }</span><br>
								<span style="color: black;">Battery: ${
                  item.bat ? item.bat + "%" : "N/A"
                }</span><br>
								<span style="color: black;">Satellites: ${
                  item.sat ? item.sat : "N/A"
                }</span><br>
								<span style="color: black;">User Agent: ${
                  item.useragent ? item.useragent : "N/A"
                }</span><br>
								<span style="color: black;">Speed: ${
                  item.speed ? (item.speed * 3.6).toFixed(2) + " km/h" : "N/A"
                }</span><br>
								<span style="color: black;">Bearing: ${
                  item.bearing ? item.bearing + "°" : "N/A"
                }</span>
							</div>
						`;
}

// Function to calculate the centroid of a geometry
function getCentroid(geometry) {
  var lat = 0;
  var lng = 0;
  var numPoints = 0;

  // Process each geometry in the GeoJSON GeometryCollection
  geometry.forEachLatLng(function (latlng) {
    lat += latlng.lat();
    lng += latlng.lng();
    numPoints++;
  });

  // Calculate the average coordinates
  lat = lat / numPoints;
  lng = lng / numPoints;

  return { lat: lat, lng: lng };
}

function fetchDataAndUpdateMap(map) {
  const interval = 30000; // 30 seconds
  let isFirstLoad = true;

  const fetchData = () => {
    fetch("https://api.hamer.cloud/data")
      .then((response) => response.json())
      .then((data) => {
        console.log("Fetched data:", data); // Log the raw fetched data
        const validData = data.map((item) => ({
          lat: parseFloat(item.lat), // Ensure latitude is a float
          lon: parseFloat(item.lon), // Ensure longitude is a float
          timestamp: parseInt(item.timestamp, 10), // Ensure timestamp is an integer
        }));
        // console.log("Validated data:", validData);
        validData.sort((a, b) => a.timestamp - b.timestamp);
        console.log("Sorted data:", validData);

        if (data.length > 0) {
          let currentCenter, currentZoom;

          if (isFirstLoad) {
            // On first load, set center and zoom based on the last data point
            currentCenter = new google.maps.LatLng(
              data[data.length - 1].lat,
              data[data.length - 1].lon
            );
            currentZoom = 15; // Set a default zoom level, or adjust based on your data
            isFirstLoad = false;
          } else {
            // On subsequent loads, use the current map center and zoom
            currentCenter = map.getCenter();
            currentZoom = map.getZoom();
          }

          const currentTime = Date.now();
          data.sort((a, b) => a.timestamp - b.timestamp);

          let previousPosition = null;
          let previousTimestamp = null;

          console.log("data", data);
          data.forEach((item, index) => {
            console.log("In for each: ", item, index);
            const position = new google.maps.LatLng(item.lat, item.lon);
            const isLatestPoint = index === data.length - 1;

            processEachDataPoint(
              item,
              isLatestPoint,
              position,
              currentTime,
              map
            );

            if (previousPosition && previousTimestamp) {
              createPolylineSegment(
                previousPosition,
                position,
                item,
                previousTimestamp,
                currentTime,
                map
              );
            }

            previousPosition = position;
            previousTimestamp = item.timestamp;
          });

          handlePolylineAnimation(data, map);
          adjustMapCenterAndZoom(map, currentCenter, currentZoom);
        } else {
          console.error("No data available to update the map.");
        }
      })
      .catch((error) => console.error("Error fetching data:", error));
  };
  fetchData();
  console.log("first fetch.");
  setInterval(fetchData, interval);
}

function processEachDataPoint(item, isLatestPoint, position, currentTime, map) {
  console.log(
    "Entering processEachDataPoint",
    item,
    isLatestPoint,
    position,
    currentTime
  );
  // console.log(`Processing data point - Latest: ${isLatestPoint}, Position: ${position.toString()}, Time: ${currentTime}`);
  const ageHours = (currentTime - item.timestamp * 1000) / (1000 * 60 * 60);
  let infoWindowCircle;
  let opacity = Math.max(1 - ageHours / 4, 0);

  const circleOptionsArray = getCircleOptions(
    isLatestPoint,
    position,
    item,
    opacity,
    map
  );
  console.log("circleOptionsArray", circleOptionsArray);

  circles.forEach((circle) => circle.setMap(null));
  circles = [];

  circleOptionsArray.forEach((circleOptions, index) => {
    const circle = new google.maps.Circle(circleOptions);
    circle.setMap(map);
    circles.push(circle);

    if (index === 0) {
      infoWindowCircle = circle;
    }
  });

  const content = generateInfoWindowContent(item);

  if (infoWindowCircle) {
    const content = generateInfoWindowContent(item);
    addInfoWindowToCircle(infoWindowCircle, position, map, content);
  }

  // Check if bearing is available and add a direction marker
  if (item.bearing !== "N/A" && item.bearing != null) {
    addDirectionMarker(map, position, item.bearing, map.getZoom(), content);
  }

  // Add weather to the newest point
  if (isLatestPoint) {
    addWeatherToMap(map, item.lat, item.lon);
  }
}

function getCircleOptions(isLatestPoint, position, item, opacity, map) {
  const baseOptions = {
    strokeColor: "#4285F4", //blue
    strokeOpacity: opacity,
    strokeWeight: 4,
    fillColor: "#4285F4",
    fillOpacity: 1,
    radius: item.acc,
    map: map,
    center: position,
    zIndex: 5,
    visible: true,
  };
  if (isLatestPoint) {
    // Define options for two circles - inner and outer
    return [
      [
        // Inner circle
        Object.assign({}, baseOptions, {
          strokeColor: "#26de51",
          strokeWeight: 2,
          strokeOpacity: 0.5,
          radius: 50,
        }),
        // Outer circle
        Object.assign({}, baseOptions, {
          strokeColor: "#26de51",
          strokeWeight: 2,
          strokeOpacity: 0.5,
          fillOpacity: 0,
          radius: 200000,
        }),
      ],
    ];
  } else {
    return [Object.assign({}, baseOptions, { radius: item.acc })];
  }
}

function addInfoWindowToCircle(circle, position, map, content) {
  const infowindow = new google.maps.InfoWindow({
    content: content,
    position: position,
  });

  circle.addListener("click", () => {
    infowindow.open(map);
  });
}

function createPolylineSegment(
  previousPosition,
  position,
  item,
  previousTimestamp,
  currentTime,
  map
) {
  const segmentAgeHours =
    (currentTime - ((item.timestamp + previousTimestamp) / 2) * 1000) /
    (1000 * 60 * 60);
  let segmentOpacity = Math.max(1 - segmentAgeHours / 3, 0);

  const lineSegment = new google.maps.Polyline({
    path: [previousPosition, position],
    geodesic: true,
    strokeColor: "#4285F4",
    strokeOpacity: segmentOpacity,
    strokeWeight: 3,
    zIndex: 1,
  });

  lineSegment.setMap(map);
}

function handlePolylineAnimation(data, map) {
  if (data.length > 1) {
    const pathCoordinates = data.map(
      (item) => new google.maps.LatLng(item.lat, item.lon)
    );
    animatePolyline(map, pathCoordinates);
  } else {
    console.log("Not enough data points for polyline animation.");
  }
}

function adjustMapCenterAndZoom(map, currentCenter, currentZoom) {
  map.setCenter(currentCenter);
  map.setZoom(currentZoom);
}

function calculateScaleForZoom(zoom) {
  return 0.5 + zoom / 10;
}

function animatePolyline(map, pathData) {
  // console.log("Received path data for animation", pathData);

  // Sort pathData by timestamp
  pathData.sort((a, b) => a.timestamp - b.timestamp);

  // Extract the sorted coordinates from the pathData
  const pathCoordinates = pathData
    .map((data) => {
      let latitude, longitude;

      if (typeof data.lat === "function") {
        latitude = data.lat();
      } else {
        latitude = data.lat;
      }

      if (typeof data.lon === "function" || typeof data.lng === "function") {
        longitude = data.lon ? data.lon() : data.lng();
      } else {
        longitude = data.lon || data.lng;
      }

      // Validate the extracted values
      if (typeof latitude === "number" && typeof longitude === "number") {
        return new google.maps.LatLng(latitude, longitude);
      } else {
        console.error("Invalid data point:", data);
        return null;
      }
    })
    .filter((coord) => coord !== null);

  if (linePath) {
    linePath.setPath(pathCoordinates);
    // If there's an existing animation, cancel it
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  } else {
    // Initialize linePath if it does not exist
    linePath = new google.maps.Polyline({
      path: pathCoordinates,
      geodesic: true,
      strokeColor: "#FF0000",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      map: map,
      zIndex: 2,
    });
  }

  let step = 0;
  const numSteps = pathCoordinates.length;
  let lastTime = performance.now();

  function drawLine(timestamp) {
    const progress = timestamp - lastTime;
    if (progress >= 200) {
      if (step < numSteps) {
        // console.log(`Drawing step ${step} at timestamp ${pathData[step].timestamp}:`, pathCoordinates[step]);
        linePath.getPath().push(pathCoordinates[step]);
        step++;
      } else {
        // console.log("Completed drawing all steps. Resetting animation.");
        step = 0;
        linePath.setPath([]);
      }
      lastTime = timestamp;
    }
    animationFrameId = requestAnimationFrame(drawLine);
  }

  animationFrameId = requestAnimationFrame(drawLine);
}

function addDirectionMarker(map, position, bearing, zoom, content) {
  const scale = calculateScaleForZoom(zoom);
  const iconAnchor = new google.maps.Point(0, scale * 10);

  const icon = {
    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
    scale: scale,
    strokeColor: "#0000FF",
    rotation: bearing,
    anchor: new google.maps.Point(0, 2),
    zIndex: 1,
  };

  const marker = new google.maps.Marker({
    position: position,
    map: map,
    icon: icon,
    zIndex: 1,
  });

  const infowindow = new google.maps.InfoWindow({
    content: content,
  });

  marker.addListener("click", () => {
    infowindow.open(map, marker);
  });

  directionMarkers.push(marker);
}

function addWeatherToMap(map, lat, lon) {
  const apiKey = "27dd553d3274c2f0760332bb947b1802";
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}`;

  fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (data && data.weather) {
        const weather = data.weather[0];
        const main = data.main;
        const clouds = data.clouds;
        const wind = data.wind;
        const sys = data.sys;
        const iconUrl =
          "https://openweathermap.org/img/w/" + weather.icon + ".png";

        const tempCelsius = (main.temp - 273.15).toFixed(1);
        const feelsLikeCelsius = (main.feels_like - 273.15).toFixed(1);
        const minTempCelsius = (main.temp_min - 273.15).toFixed(1);
        const maxTempCelsius = (main.temp_max - 273.15).toFixed(1);

        const infowindowContent = `
										<div style="color: black;">
											<h3 style="color: black;">${data.name} Weather</h3><br>
											<img src="${iconUrl}" alt="${weather.description}" /><br>
											<span style="color: black;">Condition: ${weather.main} (${
          weather.description
        })</span><br>
											<span style="color: black;">Temperature: ${tempCelsius} °C (Feels like: ${feelsLikeCelsius} °C)</span><br>
											<span style="color: black;">Min/Max Temp: ${minTempCelsius} °C / ${maxTempCelsius} °C</span><br>
											<span style="color: black;">Pressure: ${main.pressure} hPa</span><br>
											<span style="color: black;">Humidity: ${main.humidity}%</span><br>
											<span style="color: black;">Wind: ${(wind.speed * 3.6).toFixed(2)} km/h, ${
          wind.deg
        } degrees</span><br>
											<span style="color: black;">Cloudiness: ${clouds.all}%</span><br>
											<span style="color: black;">Sunrise: ${new Date(
                        sys.sunrise * 1000
                      ).toLocaleTimeString()}</span><br>
											<span style="color: black;">Sunset: ${new Date(
                        sys.sunset * 1000
                      ).toLocaleTimeString()}</span><br>
										</div>
									`;

        const marker = new google.maps.Marker({
          position: { lat, lng: lon },
          map: map,
          icon: {
            url: iconUrl,
            // Set the anchor to offset the icon vertically
            anchor: new google.maps.Point(0, -35), // Adjust the second parameter to change vertical offset
          },
          title: weather.description,
        });

        const infowindow = new google.maps.InfoWindow({
          content: infowindowContent,
        });

        marker.addListener("click", () => {
          infowindow.open(map, marker);
        });
      } else {
        console.error("Weather data is missing");
      }
    })
    .catch((error) => console.error("Error fetching weather data:", error));
}

function renderPolylines(map, pathCoordinates) {
  let bounds = map.getBounds();

  pathCoordinates.forEach((path) => {
    // Check if the path is within the map bounds
    if (bounds.contains(path)) {
      new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: "#FF0000",
        strokeOpacity: 1.0,
        strokeWeight: 2,
        map: map,
      });
    }
  });
}

// Function to draw polygons from GeoJSON features
function drawGeoJsonPolygons(map, features, visitedCountries) {
  // Clear existing polygons
  map.data.forEach(function (feature) {
    map.data.remove(feature);
  });

  // Filter and add only the features within the current map bounds
  features.forEach((feature) => {
    var countryName = feature.properties.ADMIN;
    var isInBounds = map.getBounds().contains(getCentroid(feature.geometry));
    var isVisited = visitedCountries.includes(countryName);

    if (isInBounds) {
      map.data.addGeoJson(feature);

      // Set the style of the polygon
      map.data.setStyle(function (feature) {
        var color = isVisited ? "green" : "red";
        return {
          fillColor: color,
          strokeWeight: 1,
        };
      });
    }
  });
}

function updateVisiblePolys(map) {
  // console.log("Updating visible polygons...");
  const bounds = map.getBounds();

  map.data.forEach((feature) => {
    const featureBounds = getFeatureBounds(feature.getGeometry());

    // Set the visibility of the feature depending on whether its bounds intersect with the viewport.
    const isVisible = bounds.intersects(featureBounds);
    // console.log(`Feature ${feature.getProperty('ADMIN')} visibility: ${isVisible}`);
    map.data.overrideStyle(feature, { visible: isVisible });
  });
}
