// function getFeatureBounds(geometry) {
//   const bounds = new google.maps.LatLngBounds();

//   if (geometry instanceof google.maps.Data.Polygon) {
//     geometry.getArray().forEach((linearRing) => {
//       linearRing.getArray().forEach((latLng) => {
//         bounds.extend(latLng);
//       });
//     });
//   } else if (geometry instanceof google.maps.Data.MultiPolygon) {
//     geometry.getArray().forEach((polygon) => {
//       polygon.getArray().forEach((linearRing) => {
//         linearRing.getArray().forEach((latLng) => {
//           bounds.extend(latLng);
//         });
//       });
//     });
//   } else if (geometry instanceof google.maps.Data.Point) {
//     bounds.extend(geometry.get());
//   } else if (geometry instanceof google.maps.Data.LineString) {
//     geometry.getArray().forEach((latLng) => {
//       bounds.extend(latLng);
//     });
//   } else if (geometry instanceof google.maps.Data.MultiLineString) {
//     geometry.getArray().forEach((lineString) => {
//       lineString.getArray().forEach((latLng) => {
//         bounds.extend(latLng);
//       });
//     });
//   } else {
//     console.error("Unsupported geometry type:", geometry.getType());
//   }

//   return bounds;
// }

// function getCentroid(geometry) {
//   var lat = 0;
//   var lng = 0;
//   var numPoints = 0;

//   // Process each geometry in the GeoJSON GeometryCollection
//   geometry.forEachLatLng(function (latlng) {
//     lat += latlng.lat();
//     lng += latlng.lng();
//     numPoints++;
//   });

//   // Calculate the average coordinates
//   lat = lat / numPoints;
//   lng = lng / numPoints;

//   return { lat: lat, lng: lng };
// }

// function renderPolylines(map, pathCoordinates) {
//   let bounds = map.getBounds();

//   pathCoordinates.forEach((path) => {
//     // Check if the path is within the map bounds
//     if (bounds.contains(path)) {
//       new google.maps.Polyline({
//         path: path,
//         geodesic: true,
//         strokeColor: "#FF0000",
//         strokeOpacity: 1.0,
//         strokeWeight: 2,
//         map: map,
//       });
//     }
//   });
// }

// function drawGeoJsonPolygons(map, features, visitedCountries) {
//   // Clear existing polygons
//   map.data.forEach(function (feature) {
//     map.data.remove(feature);
//   });

//   // Filter and add only the features within the current map bounds
//   features.forEach((feature) => {
//     var countryName = feature.properties.ADMIN;
//     var isInBounds = map.getBounds().contains(getCentroid(feature.geometry));
//     var isVisited = visitedCountries.includes(countryName);

//     if (isInBounds) {
//       map.data.addGeoJson(feature);

//       // Set the style of the polygon
//       map.data.setStyle(function (feature) {
//         var color = isVisited ? "green" : "red";
//         return {
//           fillColor: color,
//           strokeWeight: 1,
//         };
//       });
//     }
//   });
// }

// function updateVisiblePolys(map) {
//   // console.log("Updating visible polygons...");
//   const bounds = map.getBounds();

//   map.data.forEach((feature) => {
//     const featureBounds = getFeatureBounds(feature.getGeometry());

//     // Set the visibility of the feature depending on whether its bounds intersect with the viewport.
//     const isVisible = bounds.intersects(featureBounds);
//     // console.log(`Feature ${feature.getProperty('ADMIN')} visibility: ${isVisible}`);
//     map.data.overrideStyle(feature, { visible: isVisible });
//   });
// }
