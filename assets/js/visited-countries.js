var visitedCountries = [
  //"Aruba",
  //"Afghanistan",
  //"Angola",
  //"Anguilla",
  //"Albania",
  //"Aland",
  //"Andorra",
  "United Arab Emirates",
  //"Argentina",
  //"Armenia",
  //"American Samoa",
  //"Antarctica",
  //"Ashmore and Cartier Islands",
  //"French Southern and Antarctic Lands",
  //"Antigua and Barbuda",
  "Australia",
  "Austria",
  //"Azerbaijan",
  //"Burundi",
  "Belgium",
  //"Benin",
  //"Burkina Faso",
  //"Bangladesh",
  //"Bulgaria",
  "Bahrain",
  //"The Bahamas",
  //"Bosnia and Herzegovina",
  //"Saint Barthelemy",
  //"Belarus",
  //"Belize",
  //"Bermuda",
  //"Bolivia",
  //"Brazil",
  //"Barbados",
  "Brunei",
  //"Bhutan",
  //"Botswana",
  //"Central African Republic",
  "Canada",
  "Switzerland",
  //"Chile",
  "China",
  //"Ivory Coast",
  //"Clipperton Island",
  //"Cameroon",
  //"Cyprus No Mans Area",
  "Democratic Republic of the Congo",
  //"Republic of the Congo",
  //"Cook Islands",
  //"Colombia",
  //"Comoros",
  //"Cape Verde",
  //"Costa Rica",
  //"Cuba",
  //"Curaçao",
  //"Cayman Islands",
  //"Northern Cyprus",
  //"Cyprus",
  "Czech Republic",
  "Germany",
  //"Djibouti",
  //"Dominica",
  "Denmark",
  //"Dominican Republic",
  //"Algeria",
  //"Ecuador",
  //"Egypt",
  //"Eritrea",
  "Spain",
  //"Estonia",
  //"Ethiopia",
  //"Finland",
  //"Fiji",
  //"Falkland Islands",
  "France",
  //"Faroe Islands",
  //"Federated States of Micronesia",
  //"Gabon",
  "United Kingdom",
  //"Georgia",
  //"Guernsey",
  //"Ghana",
  //"Gibraltar",
  //"Guinea",
  //"Gambia",
  //"Guinea Bissau",
  //"Equatorial Guinea",
  "England",
  //"Greece",
  //"Grenada",
  //"Greenland",
  //"Guatemala",
  //"Guam",
  //"Guyana",
  "Hong Kong S.A.R",
  //"Heard Island and McDonald Islands",
  //"Honduras",
  "Croatia",
  //"Haiti",
  "Hungary",
  //"Indonesia",
  //"Isle of Man",
  //"India",
  //"Indian Ocean Territories",
  "British Indian Ocean Territory",
  "Ireland",
  //"Iran",
  //"Iraq",
  //"Iceland",
  //"Israel",
  "Italy",
  //"Jamaica",
  //"Jersey",
  //"Jordan",
  "Japan",
  //"Kazakhstan",
  //"Kenya",
  //"Kyrgyzstan",
  "Cambodia",
  //"Kiribati",
  //"Saint Kitts and Nevis",
  //"South Korea Republic of Korea",
  //"Kosovo",
  //"Kuwait",
  "Laos",
  //"Lebanon",
  //"Liberia",
  //"Libya",
  //"Saint Lucia",
  "Liechtenstein",
  //"Sri Lanka",
  //"Lesotho",
  //"Lithuania",
  "Luxembourg",
  //"Latvia",
  //"Macao S.A.R",
  //"Saint Martin",
  //"Morocco",
  //"Monaco",
  //"Moldova",
  //"Madagascar",
  //"Maldives",
  //"Mexico",
  //"Marshall Islands",
  //"Macedonia",
  //"Mali",
  //"Malta",
  //"Myanmar",
  //"Montenegro",
  //"Mongolia",
  //"Northern Mariana Islands",
  //"Mozambique",
  //"Mauritania",
  //"Montserrat",
  //"Mauritius",
  //"Malawi",
  "Malaysia",
  //"Namibia",
  //"New Caledonia",
  //"Niger",
  //"Nigeria",
  //"Nicaragua",
  //"Niue",
  "Netherlands",
  "Norway",
  //"Nepal",
  //"Nauru",
  "New Zealand",
  "Oman",
  //"Pakistan",
  //"Panama",
  //"Pitcairn Islands",
  //"Peru",
  //"Spratly Islands",
  //"Philippines",
  //"Palau",
  //"Papua New Guinea",
  "Poland",
  //"Puerto Rico",
  //"North Korea",
  //"Portugal",
  //"Paraguay",
  //"Palestine",
  //"French Polynesia",
  //"Qatar",
  //"Romania",
  //"Russia",
  //"Rwanda",
  //"Western Sahara",
  //"Saudi Arabia",
  "Scotland",
  //"Sudan",
  //"South Sudan",
  //"Senegal",
  "Singapore",
  //"South Georgia and the South Sandwich Islands",
  //"Saint Helena",
  //"Solomon Islands",
  //"Sierra Leone",
  //"El Salvador",
  //"San Marino",
  //"Somaliland",
  //"Somalia",
  //"Saint Pierre and Miquelon",
  //"Republic of Serbia",
  //"Sao Tome and Principe",
  //"Suriname",
  "Slovakia",
  "Slovenia",
  "Sweden",
  //"Swaziland",
  //"Sint Maarten",
  //"Seychelles",
  //"Syria",
  //"Turks and Caicos Islands",
  //"Chad",
  //"Togo",
  "Thailand",
  //"Tajikistan",
  //"Turkmenistan",
  //"East Timor",
  //"Tonga",
  //"Trinidad and Tobago",
  //"Tunisia",
  "Turkey",
  //"Tuvalu",
  "Taiwan",
  //"United Republic of Tanzania",
  //"Uganda",
  //"Ukraine",
  //"United States Minor Outlying Islands",
  //"Uruguay",
  "United States of America",
  //"US Naval Base Guantanamo Bay",
  //"Uzbekistan",
  "Vatican",
  //"Saint Vincent and the Grenadines",
  //"Venezuela",
  //"British Virgin Islands",
  //"United States Virgin Islands",
  "Vietnam",
  //"Vanuatu",
  //"Wallis and Futuna",
  //"Samoa",
  //"Yemen",
  "South Africa",
  //"Zambia",
  //"Zimbabwe",
];

// Google Maps initialization
let map;
let countryPolygons = [];

function initMap() {
    // Initialize the map centered over Australia at equator
    map = new google.maps.Map(document.getElementById('worldMap'), {
        center: { lat: 0, lng: 134 }, // Australia longitude at equator
        zoom: 2,
        disableDefaultUI: true, // Remove all default controls
        gestureHandling: 'cooperative', // Better mobile experience
        styles: [
            {
                featureType: 'water',
                elementType: 'geometry',
                stylers: [{ visibility: 'on' }]
            },
            {
                featureType: 'landscape',
                elementType: 'geometry',
                stylers: [{ color: '#2c5aa0' }]
            },
            {
                featureType: 'road',
                stylers: [{ visibility: 'off' }]
            },
            {
                featureType: 'transit',
                stylers: [{ visibility: 'off' }]
            },
            {
                featureType: 'poi',
                stylers: [{ visibility: 'off' }]
            },
            {
                featureType: 'administrative',
                elementType: 'geometry.stroke',
                stylers: [{ color: '#4b6878', weight: 0.5 }]
            },
            {
                featureType: 'administrative',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            },
            {
                featureType: 'administrative.country',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            },
            {
                featureType: 'administrative.locality',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            }
        ]
    });

    // Load and color countries
    loadCountryBoundaries();
}

async function loadCountryBoundaries() {
    try {
        // Use Google Maps Data layer for country boundaries
        map.data.loadGeoJson('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson');
        
        map.data.setStyle(function(feature) {
            const countryName = feature.getProperty('name');
            const isVisited = visitedCountries.includes(countryName);
            
            return {
                fillColor: isVisited ? '#00ff00' : '#ff0000',
                fillOpacity: 0.6,
                strokeColor: '#ffffff',
                strokeWeight: 1
            };
        });

        // Add hover effects
        map.data.addListener('mouseover', function(event) {
            map.data.revertStyle();
            map.data.overrideStyle(event.feature, {
                fillOpacity: 0.8,
                strokeWeight: 2
            });
        });

        map.data.addListener('mouseout', function() {
            map.data.revertStyle();
        });

        // Add info window on click
        const infoWindow = new google.maps.InfoWindow();
        map.data.addListener('click', function(event) {
            const countryName = event.feature.getProperty('name');
            const isVisited = visitedCountries.includes(countryName);
            const status = isVisited ? 'Visited ✅' : 'Not visited yet ❌';
            
            infoWindow.setContent(`
                <div>
                    <h3>${countryName}</h3>
                    <p>${status}</p>
                </div>
            `);
            infoWindow.setPosition(event.latLng);
            infoWindow.open(map);
        });

    } catch (error) {
        console.error('Error loading country boundaries:', error);
        // Fallback: just show the count
        updateCountriesCount();
    }
}

function updateCountriesCount() {
    const visitedCount = visitedCountries.length;
    const totalCountries = 195; // Approximate number of countries
    const percentage = ((visitedCount / totalCountries) * 100).toFixed(1);
    
    document.getElementById('countriesCount').innerHTML = 
        `I have visited ${visitedCount} out of ${totalCountries} countries (${percentage}%)`;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    updateCountriesCount();
    
    // If Google Maps API hasn't loaded yet, the initMap will be called by the callback
    if (typeof google !== 'undefined' && google.maps) {
        initMap();
    }
});

// Make sure initMap is available globally for Google Maps callback
window.initMap = initMap;
