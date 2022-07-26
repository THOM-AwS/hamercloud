var city;
var ip;
var network;
var provider;
var country;
var ulat;
var ulon;
var acc;

var fillInPage = (function () {
    var updateCityText = function (geoipResponse) {
        city = geoipResponse.city.names.en;
        ip = geoipResponse.traits.ip_address;
        network = geoipResponse.traits.network;
        provider = geoipResponse.traits.autonomous_system_organization;
        state = geoipResponse.subdivisions[0].names.en;
        country = geoipResponse.country.names.en;
        ulat = geoipResponse.location.latitude;
        ulon = geoipResponse.location.longitude;
        acc = geoipResponse.location.accuracy_radius;
        document.getElementById('user').innerHTML = "Your public IP address is: " + ip + "<br>Your location is: " + city + ", " + state + ", " + country + ". <br>Your ISP is: " + provider;
    };

    var onSuccess = function (geoipResponse) {
        updateCityText(geoipResponse);
    };

    // If we get an error, we will display an error message
    var onError = function (error) {
        document.getElementById('user').innerHTML = 'an error!  Please try again..'
    };

    return function () {
        if (typeof geoip2 !== 'undefined') {
            geoip2.city(onSuccess, onError);
        } else {
            document.getElementById('user').innerHTML = 'a browser that blocks GeoIP2 requests'
        }
    };
}());

fillInPage();