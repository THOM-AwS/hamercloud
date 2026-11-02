import json
import logging
from datetime import datetime, timedelta
from decimal import Decimal

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TABLE_NAME = "fitbitData"
ALLOWED_ORIGINS = {"https://hamer.cloud", "https://www.hamer.cloud"}


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def get_cors_headers(event):
    origin = ""
    headers = event.get("headers") or {}
    for key, value in headers.items():
        if key.lower() == "origin":
            origin = value
            break
    allowed = origin if origin in ALLOWED_ORIGINS else "https://hamer.cloud"
    return {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }


def lambda_handler(event, context):
    cors = get_cors_headers(event)

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors, "body": ""}

    dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
    table = dynamodb.Table(TABLE_NAME)

    cutoff = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

    try:
        response = table.scan()
        items = response.get("Items", [])
    except Exception as e:
        logger.error("DynamoDB scan failed: %s", e)
        return {
            "statusCode": 500,
            "headers": cors,
            "body": json.dumps({"error": "Failed to read health data"}),
        }

    filtered = [item for item in items if item.get("date", "") >= cutoff]
    filtered.sort(key=lambda x: x.get("date", ""))

    for item in filtered:
        item.pop("ttl", None)
        item.pop("fetched_at", None)

    return {
        "statusCode": 200,
        "headers": {**cors, "Content-Type": "application/json"},
        "body": json.dumps(filtered, cls=DecimalEncoder),
    }
