import boto3
import json
import logging
import time
import urllib.parse
from decimal import Decimal
from json import JSONEncoder


class DecimalEncoder(JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)


logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    logger.info("Received event: %s", json.dumps(event, indent=2))

    # Parse the URL-encoded body
    parsed_body = urllib.parse.parse_qs(event["body"])

    # Extract and convert all fields
    try:
        lat = (
            Decimal(parsed_body.get("lat", [None])[0]).quantize(Decimal("0.00001"))
            if parsed_body.get("lat")
            else None
        )
        lon = (
            Decimal(parsed_body.get("lon", [None])[0]).quantize(Decimal("0.00001"))
            if parsed_body.get("lon")
            else None
        )
        alt = (
            Decimal(parsed_body.get("alt", [None])[0]).quantize(Decimal("0.01"))
            if parsed_body.get("alt")
            else None
        )
        acc = (
            Decimal(parsed_body.get("acc", [None])[0]).to_integral_value()
            if parsed_body.get("acc")
            else None
        )
        bat = (
            Decimal(parsed_body.get("bat", [None])[0]).to_integral_value()
            if parsed_body.get("bat")
            else None
        )
        sat = int(parsed_body.get("sat", [None])[0]) if parsed_body.get("sat") else None
        speed = (
            Decimal(parsed_body.get("speed", [None])[0]).quantize(Decimal("0.1"))
            if parsed_body.get("speed")
            else None
        )
        bearing = (
            Decimal(parsed_body.get("bearing", [None])[0]).quantize(Decimal("0.01"))
            if parsed_body.get("bearing")
            else None
        )
        useragent = parsed_body.get("useragent", [None])[0]
        timestamp = str(parsed_body.get("timestamp", [None])[0])
    except (ValueError, TypeError) as e:
        logger.error("Invalid data types in payload: %s", e)
        return {
            "statusCode": 400,
            "body": json.dumps({"message": "Invalid data types in payload"}),
        }

    if not all([lat, lon, timestamp]):
        logger.error("Missing required fields (lat, lon, timestamp) in the event")
        return {
            "statusCode": 400,
            "body": json.dumps({"message": "Missing required fields"}),
        }

    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table("genericDataTable")

    # Calculate TTL (3 hours from now)
    ttl = int(time.time()) + 10800  # three hours

    # Construct the item with all fields
    item = {
        "timestamp": timestamp,
        "lat": lat,
        "lon": lon,
        "alt": alt,
        "acc": acc,
        "bat": bat,
        "sat": sat,
        "speed": speed,
        "bearing": bearing,
        "useragent": useragent,
        "ttl": ttl,
    }

    # Remove any None values from the item
    item = {k: v for k, v in item.items() if v is not None}

    try:
        table.put_item(Item=item)
        logger.info("Logged payload: %s", json.dumps(item, cls=DecimalEncoder))
    except Exception as e:
        logger.error("Error putting item in DynamoDB: %s", e)
        return {
            "statusCode": 500,
            "body": json.dumps({"message": "Error putting item in DynamoDB"}),
        }

    # Use DecimalEncoder for serializing the response
    return {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps(
            {
                "message": "Payload logged successfully!",
                "formattedOutput": item,
            },
            cls=DecimalEncoder,
        ),
    }
