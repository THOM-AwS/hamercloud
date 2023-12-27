let directionMarkers = [];
let pathCoordinates = [];

function initMap() {
  // console.log("Initializing map...");
  const map = new google.maps.Map(document.getElementById("map"), {
    zoom: 15,
    mapTypeId: "satellite",
    disableDefaultUI: true,
    gestureHandling: "greedy",
  });

  map.addListener("zoom_changed", function () {
    let zoom = map.getZoom();
    directionMarkers.forEach((marker) => {
      let newScale = calculateScaleForZoom(zoom);
      let newIcon = marker.getIcon();
      newIcon.scale = newScale;
      // Keep the anchor the same
      newIcon.anchor = new google.maps.Point(0, 2);
      marker.setIcon(newIcon);
    });
  });

  // listener for updating map polys
  const geoJsonUrl =
    "https://datahub.io/core/geo-countries/r/countries.geojson";
  google.maps.event.addListener(map, "bounds_changed", function () {
    // Call your render function
    renderPolylines(map, pathCoordinates);
  });

  function updateCountriesCount() {
    let count = visitedCountries.length;
    document.getElementById("countriesCount").textContent = count;
  }
  // Call the function to update the count
  updateCountriesCount();

  fetch(geoJsonUrl)
    .then((response) => response.json())
    .then((data) => {
      // console.log("GeoJSON data loaded:", data);
      map.data.addGeoJson(data, { idPropertyName: "ADMIN" });
      map.data.setStyle(function (feature) {
        var countryName = feature.getProperty("ADMIN");
        var color = visitedCountries.includes(countryName) ? "green" : "red"; // Green for visited
        return {
          fillColor: color,
          strokeWeight: 1,
          visible: false, // Set features to invisible by default
        };
      });

      map.data.forEach(function (feature) {
        var centroid = getCentroid(feature.getGeometry());
        var countryName = feature.getProperty("ADMIN"); // Use 'ADMIN' to get the country name

        // Check if countryName is defined and is a string
        if (typeof countryName === "string") {
          // Create a marker for the label
          var marker = new google.maps.Marker({
            position: centroid,
            map: map,
            label: {
              text: countryName, // Use countryName as label text
              color: "black", // Adjust label style as needed
              fontSize: "12px",
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillOpacity: 0,
              strokeOpacity: 0,
              scale: 0, // to create an invisible icon
            },
          });
        }
      });
    })
    .catch((error) => console.error("Error loading GeoJSON data:", error));
  fetchDataAndUpdateMap(map);
  map.addListener("bounds_changed", () => {
    // console.log("Bounds changed event triggered.");
    // console.time("updateVisiblePolys");
    updateVisiblePolys(map);

    // console.timeEnd("updateVisiblePolys");
  });
}
