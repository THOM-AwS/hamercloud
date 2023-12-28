let animationFrameId;
let linePath;
let infoWindowCircle;
const circles = [];
let isFirstLoad = true;
let Center;
let Zoom;
const polylineSegments = [];
let currentAnimationStep = 0;

function fetchDataAndUpdateMap(map) {
  // const interval = 30000; // 30 seconds

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
          if (isFirstLoad) {
            // Calculate bounds for all data points on the first load
            const bounds = new google.maps.LatLngBounds();
            data.forEach((item) => {
              bounds.extend(new google.maps.LatLng(item.lat, item.lon));
            });
            Center = bounds.getCenter();
            Zoom = map.getZoom() - 1;
            isFirstLoad = false;
          } else {
            Center = map.getCenter();
            Zoom = map.getZoom();
          }

          data.forEach((item, index) => {
            const position = new google.maps.LatLng(item.lat, item.lon);
            data.sort((a, b) => a.timestamp - b.timestamp);
            const isLatestPoint = index === data.length - 1;

            processEachDataPoint(
              item,
              isLatestPoint,
              position,
              currentTime,
              map
            );

            if (previousPosition && previousTimestamp) {
              const segment = createPolylineSegment(
                previousPosition,
                position,
                item,
                previousTimestamp,
                currentTime,
                map
              );
              polylineSegments.push(segment);
            }
            previousPosition = position;
            previousTimestamp = item.timestamp;
          });
          map.setCenter(Center);
          map.setZoom(Zoom);
          handlePolylineAnimation(data, map);
        } else {
          console.error("No data available to update the map.");
        }
      })
      .catch((error) => console.error("Error fetching data:", error));
  };
  fetchData();
  // setInterval(fetchData, interval);
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
  return lineSegment; // Return the segment to add to the segments array
}

function handlePolylineAnimation(data, map) {
  if (data.length > 1) {
    const pathCoordinates = data.map(
      (item) => new google.maps.LatLng(item.lat, item.lon)
    );

    // Cancel any existing animation
    cancelAnimation();

    // Start a new animation
    animatePolyline(map, pathCoordinates);
  } else {
    console.log("Not enough data points for polyline animation.");
  }
}

function cancelAnimation() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (linePath) {
    linePath.setPath([]);
  }
}

function calculateScaleForZoom(zoom) {
  return 0.5 + zoom / 10;
}

function animatePolyline(map, pathCoordinates) {
  pathCoordinates.sort((a, b) => a.timestamp - b.timestamp);

  if (!linePath) {
    // Initialize linePath if it does not exist
    linePath = new google.maps.Polyline({
      geodesic: true,
      strokeColor: "#FF0000",
      strokeOpacity: 0.8,
      strokeWeight: 2,
      map: map,
      zIndex: 5,
    });
  }

  let step = currentAnimationStep; // Start from the current step
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
  currentAnimationStep = step; // Update the current step
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
