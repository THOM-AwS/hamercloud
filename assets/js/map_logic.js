let animationFrameId;
let linePath;
let infoWindowCircle;

function fetchDataAndUpdateMap(map) {
  const interval = 30000; // 30 seconds
  let isFirstLoad = true;

  const fetchData = () => {
    fetch("https://api.hamer.cloud/data")
      .then((response) => response.json()) // parse JSON from request
      .then((data) => {
        if (data.length > 0) {
          let currentCenter, currentZoom;
          const currentTime = Date.now();
          let previousPosition = null;
          let previousTimestamp = null;
          if (Array.isArray(data)) {
            data.sort((a, b) => a.timestamp - b.timestamp);
          }
          if (isFirstLoad) {
            currentCenter = new google.maps.LatLng(
              data[data.length - 1].lat,
              data[data.length - 1].lon
            );
            currentZoom = 15;
            isFirstLoad = false;
          } else {
            currentCenter = map.getCenter();
            currentZoom = map.getZoom();
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
          adjustMapCenterAndZoom(map, currentCenter, currentZoom);
        } else {
          console.error("No data available to update the map.");
        }
      })
      .catch((error) => console.error("Error fetching data:", error));
  };
  fetchData();
  setInterval(fetchData, interval);
}

function processEachDataPoint(item, isLatestPoint, position, currentTime, map) {
  const content = generateInfoWindowContent(item);
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
  circleOptionsArray.forEach((circleOptions, index) => {
    const circle = new google.maps.Circle(circleOptions);
    circle.setMap(map);
    if (index === 0) {
      infoWindowCircle = circle;
    }
  });
  if (item.bearing !== "N/A" && item.bearing != null) {
    addDirectionMarker(map, position, item.bearing, map.getZoom(), content);
  }
  // Add weather to the newest point api limit met.
  // if (isLatestPoint) {
  //   addWeatherToMap(map, item.lat, item.lng);
  // }
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
    strokeOpacity: 1,
    strokeWeight: 4,
    fillColor: "#4285F4",
    fillOpacity: 0.2,
    radius: 1000, //accuracyRadius,
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
        strokeWeight: 2,
        strokeOpacity: 0.9,
        fillOpacity: 0.2,
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

function adjustMapCenterAndZoom(map, currentCenter, currentZoom) {
  map.setCenter(currentCenter);
  map.setZoom(currentZoom);
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
