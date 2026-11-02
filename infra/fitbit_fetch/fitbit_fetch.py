import os
import json
import time
import logging
import base64
from datetime import datetime, timedelta
from decimal import Decimal
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from urllib.error import HTTPError

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Fitbit app credentials live in SSM, read at call time so they are never in
# the function configuration or Terraform state.
CLIENT_ID_PARAM = "fitbit_client_id"
CLIENT_SECRET_PARAM = "fitbit_client_secret"
TABLE_NAME = os.environ.get("TABLE_NAME", "fitbitData")
BASE_URL = "https://api.fitbit.com"

ssm = boto3.client("ssm", region_name="us-east-1")
dynamodb = boto3.resource("dynamodb", region_name="us-east-1")


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def get_ssm_param(name):
    # WithDecryption is a no-op for String and required once these become SecureString.
    return ssm.get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"]


def put_ssm_param(name, value):
    ssm.put_parameter(Name=name, Value=value, Type="String", Overwrite=True)


def fitbit_get(access_token, endpoint):
    url = f"{BASE_URL}{endpoint}"
    req = Request(url, headers={"Authorization": f"Bearer {access_token}"})
    with urlopen(req) as resp:
        return json.loads(resp.read().decode())


def refresh_tokens():
    refresh_token = get_ssm_param("refresh_token")
    client_id = get_ssm_param(CLIENT_ID_PARAM)
    client_secret = get_ssm_param(CLIENT_SECRET_PARAM)
    auth = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    data = urlencode({
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }).encode()
    req = Request(
        f"{BASE_URL}/oauth2/token",
        data=data,
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    with urlopen(req) as resp:
        tokens = json.loads(resp.read().decode())
    put_ssm_param("access_token", tokens["access_token"])
    put_ssm_param("refresh_token", tokens["refresh_token"])
    logger.info("Tokens refreshed successfully")
    return tokens["access_token"]


def fetch_with_retry(access_token, endpoint):
    try:
        return fitbit_get(access_token, endpoint)
    except HTTPError as e:
        if e.code == 401:
            logger.info("Access token expired, refreshing...")
            new_token = refresh_tokens()
            return fitbit_get(new_token, endpoint)
        raise


def parse_activity_series(data, key):
    result = {}
    for item in data.get(key, []):
        date = item["dateTime"]
        value = item["value"]
        try:
            if "." in str(value):
                result[date] = Decimal(str(value)).quantize(Decimal("0.01"))
            else:
                result[date] = int(value)
        except (ValueError, TypeError):
            pass
    return result


def parse_heart_rate(data):
    result = {}
    for day in data.get("activities-heart", []):
        date = day.get("dateTime")
        value = day.get("value", {})
        entry = {}
        rhr = value.get("restingHeartRate")
        if rhr is not None:
            entry["resting_hr"] = int(rhr)
        zones = {}
        for zone in value.get("heartRateZones", []):
            name = zone["name"].lower().replace(" ", "_")
            zones[name] = {
                "minutes": int(zone.get("minutes", 0)),
                "calories": int(zone.get("caloriesOut", 0)),
            }
        if zones:
            entry["hr_zones"] = zones
        if entry:
            result[date] = entry
    return result


def parse_sleep(data):
    result = {}
    for record in data.get("sleep", []):
        date = record.get("dateOfSleep")
        if not date or not record.get("isMainSleep"):
            continue
        levels = record.get("levels", {}).get("summary", {})
        entry = {
            "sleep_efficiency": record.get("efficiency"),
        }
        if levels.get("deep"):
            entry["sleep_deep_min"] = levels["deep"].get("minutes", 0)
        if levels.get("light"):
            entry["sleep_light_min"] = levels["light"].get("minutes", 0)
        if levels.get("rem"):
            entry["sleep_rem_min"] = levels["rem"].get("minutes", 0)
        if levels.get("wake"):
            entry["sleep_wake_min"] = levels["wake"].get("minutes", 0)
        result[date] = entry
    return result


def lambda_handler(event, context):
    logger.info("Fitbit fetch started")
    access_token = get_ssm_param("access_token")
    table = dynamodb.Table(TABLE_NAME)

    today = datetime.now().strftime("%Y-%m-%d")
    thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

    try:
        steps_data = fetch_with_retry(
            access_token, "/1/user/-/activities/steps/date/today/30d.json"
        )
        hr_data = fetch_with_retry(
            access_token, "/1/user/-/activities/heart/date/today/30d.json"
        )
        fairly_data = fetch_with_retry(
            access_token,
            "/1/user/-/activities/minutesFairlyActive/date/today/30d.json",
        )
        very_data = fetch_with_retry(
            access_token,
            "/1/user/-/activities/minutesVeryActive/date/today/30d.json",
        )
        sleep_data = fetch_with_retry(
            access_token,
            f"/1.2/user/-/sleep/date/{thirty_days_ago}/{today}.json",
        )
        distance_data = fetch_with_retry(
            access_token, "/1/user/-/activities/distance/date/today/30d.json"
        )
        weight_data = fetch_with_retry(
            access_token, "/1/user/-/body/weight/date/today/30d.json"
        )
    except Exception as e:
        logger.error("Failed to fetch Fitbit data: %s", e)
        try:
            boto3.client("cloudwatch", region_name="us-east-1").put_metric_data(
                Namespace="FitbitDashboard",
                MetricData=[{
                    "MetricName": "FitbitTokenRefreshFailure",
                    "Value": 1,
                    "Unit": "Count",
                }],
            )
        except Exception:
            pass
        raise

    steps = parse_activity_series(steps_data, "activities-steps")
    fairly = parse_activity_series(fairly_data, "activities-minutesFairlyActive")
    very = parse_activity_series(very_data, "activities-minutesVeryActive")
    distance = parse_activity_series(distance_data, "activities-distance")
    weight = parse_activity_series(weight_data, "body-weight")
    heart = parse_heart_rate(hr_data)
    sleep = parse_sleep(sleep_data)

    all_dates = set(steps.keys()) | set(heart.keys()) | set(fairly.keys())
    ttl_value = int(time.time()) + (365 * 24 * 3600)
    now_iso = datetime.utcnow().isoformat() + "Z"
    items_written = 0

    for date in sorted(all_dates):
        item = {
            "date": date,
            "ttl": ttl_value,
            "fetched_at": now_iso,
        }
        if date in steps:
            item["steps"] = steps[date]
        if date in distance:
            item["distance"] = distance[date]
        if date in heart:
            item.update(heart[date])
        if date in fairly:
            item["active_minutes_fairly"] = fairly[date]
        if date in very:
            item["active_minutes_very"] = very[date]
        if date in sleep:
            item.update(sleep[date])
        if date in weight:
            item["weight"] = weight[date]

        table.put_item(Item=item)
        items_written += 1

    logger.info("Wrote %d items to %s", items_written, TABLE_NAME)
    return {"statusCode": 200, "body": json.dumps({"items_written": items_written})}
