let animationFrameId;
let linePath;
let infoWindowCircle;
const circles = [];
let isFirstLoad = true;
let currentCenter; // Add this variable to store the current map center
let currentZoom; // Add this variable to store the current map zoom

function fetchDataAndUpdateMap(map) {
  const interval = 30000; // 30 seconds

  const fetchData = () => {
    clearMap(map);
    fetch("https://api.hamer.cloud/data")
      .then((response) => response.json())
      .then((data) => {
        if (data.length > 0) {
          const currentTime = Date.now();
          let previousPosition = null;
          let previousTimestamp = null;
          if (Array.isArray(data)) {
            data.sort((a, b) => a.timestamp - b.timestamp);
          }
          let initialCenter;
          let initialZoom;
          if (isFirstLoad || !currentCenter) {
            // Use initial center and zoom if it's the first load or user hasn't moved the map
            initialCenter = new google.maps.LatLng(
              data[data.length - 1].lat,
              data[data.length - 1].lon
            );
            initialZoom = 15;
            isFirstLoad = false;
          }
          data.forEach((item, index) => {
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

          if (initialCenter && initialZoom) {
            // During the initial load, use initialCenter and initialZoom
            adjustMapCenterAndZoom(map, initialCenter, initialZoom, data);
          } else {
            // For subsequent updates, use the stored currentCenter and currentZoom
            adjustMapCenterAndZoom(map, currentCenter, currentZoom, data);
          }
        } else {
          console.error("No data available to update the map.");
        }
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  // Add a listener to store the current map center and zoom
  google.maps.event.addListener(map, "idle", function () {
    currentCenter = map.getCenter();
    currentZoom = map.getZoom();
  });

  fetchData();
  setInterval(fetchData, interval);
}

function processEachDataPoint(item, isLatestPoint, position, currentTime, map) {
  const content = generateInfoWindowContent(item);
  const ageHours = (currentTime - item.timestamp * 1000) / (1000 * 60 * 60);
  let infoWindowCircle;
  let opacity = Math.min(Math.max(1 - ageHours / 4, 0), 0.6);
  const circleOptionsArray = getCircleOptions(
    isLatestPoint,
    position,
    item,
    opacity,
    map
  );
  circleOptionsArray.forEach((circleOptions, index) => {
    const circle = new google.maps.Circle(circleOptions);
    circle.setMap(map);
    if (index === 0) {
      infoWindowCircle = circle;
    }
    circles.push(circle);
  });
  if (item.bearing !== "N/A" && item.bearing != null) {
    addDirectionMarker(map, position, item.bearing, map.getZoom(), content);
  }
  if (infoWindowCircle) {
    const content = generateInfoWindowContent(item);
    addInfoWindowToCircle(infoWindowCircle, position, map, content);
  }

  if (item.bearing !== "N/A" && item.bearing != null) {
    addDirectionMarker(map, position, item.bearing, map.getZoom(), content);
  }

  if (isLatestPoint) {
    addWeatherToMap(map, item.lat, item.lon);
  }
}

function getCircleOptions(isLatestPoint, position, item, opacity, map) {
  const accuracyRadius = parseFloat(item.acc) || 20;
  const baseOptions = {
    strokeColor: "#4285F4", //blue
    strokeOpacity: opacity,
    strokeWeight: 4,
    fillColor: "#4285F4",
    fillOpacity: opacity,
    radius: accuracyRadius,
    map: map,
    center: position,
  };
  if (isLatestPoint) {
    // Define options for two circles - inner and outer
    return [
      {
        // Inner circle
        ...baseOptions,
        strokeColor: "#26de51",
        strokeWeight: 2,
        strokeOpacity: 1,
        radius: accuracyRadius,
      },
      {
        // Outer circle
        ...baseOptions,
        strokeColor: "#26de51",
        strokeWeight: 2,
        strokeOpacity: 1,
        fillOpacity: 0,
        radius: 100000,
      },
    ];
  } else {
    return [
      {
        ...baseOptions,
        strokeColor: "#FFC0CB",
        strokeWeight: 1,
      },
    ];
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

function adjustMapCenterAndZoom(map, currentCenter, currentZoom, data) {
  map.setCenter(currentCenter);
  map.setZoom(currentZoom);

  // Create a LatLngBounds object to encompass all map points
  const bounds = new google.maps.LatLngBounds();

  // Iterate through the data and extend the bounds for each point
  for (const item of data) {
    const position = new google.maps.LatLng(item.lat, item.lon);
    bounds.extend(position);
  }

  // Fit the map to the bounds, adjusting zoom as needed
  map.fitBounds(bounds);

  // Limit the maximum zoom level to avoid over-zooming
  const maxZoom = 15;
  if (map.getZoom() > maxZoom) {
    map.setZoom(maxZoom);
  }
}

function calculateScaleForZoom(zoom) {
  return 0.5 + zoom / 10;
}

function animatePolyline(map, pathData) {
  pathData.sort((a, b) => a.timestamp - b.timestamp);
  const pathCoordinates = pathData
    .map((data) => {
      // is a lat and lng
      const latitude = parseFloat(data.lat());
      const longitude = parseFloat(data.lng());

      // Check if latitude and longitude are valid numbers
      if (!isNaN(latitude) && !isNaN(longitude)) {
        return new google.maps.LatLng(latitude, longitude);
      } else {
        console.error(`Invalid coordinates: lat=${data.lat}, lng=${data.lng}`);
        return null; // Return null for invalid coordinates
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
      zIndex: 5,
    });
  }

  let step = 0;
  const numSteps = pathCoordinates.length;
  let lastTime = performance.now();

  function drawLine(timestamp) {
    const progress = timestamp - lastTime;
    if (progress >= 200) {
      if (step < numSteps) {
        linePath.getPath().push(pathCoordinates[step]);
        step++;
      } else {
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

function clearMap(map) {
  // Clear all circles
  for (const circle of circles) {
    circle.setMap(null);
  }

  // Clear the polyline
  if (linePath) {
    linePath.setMap(null);
  }
}
