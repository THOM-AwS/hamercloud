import json
import boto3
import decimal
import logging
import time
from json import JSONEncoder

class DecimalEncoder(JSONEncoder):
    def default(self, obj):
        if isinstance(obj, decimal.Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

def handler(event, context):
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table('genericDataTable')

    try:
        response = table.scan()
        items = response.get('Items', [])
        # logger.info("Items retrieved: %s", items)
    except Exception as e:
        logger.error("Error during DynamoDB scan: %s", e)
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'message': 'Internal Server Error'})
        }

    

    # Fallback item if no items are found
    if len(items) < 1:
        current_timestamp = int(time.time())
        for i, item in enumerate(items):
            item['timestamp'] = (current_timestamp - 15) + i
            
        items = [
            {
                "lat": -33.87076,
                "lon": 151.20219,
                "alt": 20,
                "acc": 10.0,
                "bat": 100,
                "sat": 0,
                "useragent": "Bot",
                "speed": 1,
                "bearing": 270.0,
                "timestamp": current_timestamp
            },
            {
                "lat": -33.87070,
                "lon": 151.20140,
                "alt": 20,
                "acc": 10.0,
                "bat": 100,
                "sat": 0,
                "useragent": "Bot",
                "speed": 1,
                "bearing": 270.0,
                "timestamp": current_timestamp
            },
            {
                "lat": -33.87045,
                "lon": 151.19999,
                "alt": 20,
                "acc": 10.0,
                "bat": 100,
                "sat": 0,
                "useragent": "Bot",
                "speed": 1,
                "bearing": 270.0,
                "timestamp": current_timestamp
            },
            {
                "lat": -33.87022,
                "lon": 151.19917,
                "alt": 20,
                "acc": 10.0,
                "bat": 100,
                "sat": 270,
                "useragent": "Bot",
                "speed": 1,
                "bearing": 180.0,
                "timestamp": current_timestamp
            },
            {
                "lat": -33.87105,
                "lon": 151.19921,
                "alt": 20,
                "acc": 10.0,
                "bat": 100,
                "sat": 0,
                "useragent": "Bot",
                "speed": 1,
                "bearing": 120.0,
                "timestamp": current_timestamp
            },
            {
                "lat": -33.871271,
                "lon": 151.199504,
                "alt": 20,
                "acc": 10.0,
                "bat": 100,
                "sat": 0,
                "useragent": "Bot",
                "speed": 1,
                "bearing": 180.0,
                "timestamp": current_timestamp
            },
            {
                "lat": -33.87220,
                "lon": 151.19944,
                "alt": 20,
                "acc": 10.0,
                "bat": 100,
                "sat": 0,
                "useragent": "Bot",
                "speed": 1,
                "bearing": 180.0,
                "timestamp": current_timestamp
            },
            
            {
                "lat": -33.87310,
                "lon": 151.20000,
                "alt": 20,
                "acc": 10.0,
                "bat": 100,
                "sat": 0,
                "useragent": "Bot",
                "speed": 1,
                "bearing": 180.0,
                "timestamp": current_timestamp
            },
            
            {
                "lat": -33.87350,
                "lon": 151.20000,
                "alt": 20,
                "acc": 10.0,
                "bat": 100,
                "sat": 120,
                "useragent": "Bot",
                "speed": 1,
                "bearing": 120.0,
                "timestamp": current_timestamp
            },
            
            {
                "lat": -33.87349,
                "lon": 151.20050,
                "alt": 20,
                "acc": 10.0,
                "bat": 100,
                "sat": 0,
                "useragent": "Bot",
                "speed": 1,
                "bearing": 90.0,
                "timestamp": current_timestamp
            },
            {
                "lat": -33.873310,
                "lon": 151.2012261,
                "alt": 20,
                "acc": 10.0,
                "bat": 100,
                "sat": 0,
                "useragent": "Bot",
                "speed": 1,
                "bearing": 70.0,
                "timestamp": current_timestamp
            },
            
            {
                "lat": -33.87317,
                "lon": 151.20187,
                "alt": 20,
                "acc": 10.0,
                "bat": 100,
                "sat": 0,
                "useragent": "Bot",
                "speed": 1,
                "bearing": 1.0,
                "timestamp": current_timestamp
            },
            {
                "lat": -33.87215,
                "lon": 151.20190,
                "alt": 20,
                "acc": 10.0,
                "bat": 100,
                "sat": 0,
                "useragent": "Bot",
                "speed": 1,
                "bearing": 1.0,
                "timestamp": current_timestamp
            },
            {
                "lat": -33.8713138,
                "lon": 151.2020507,
                "alt": 20,
                "acc": 10.0,
                "bat": 100,
                "sat": 0,
                "useragent": "Bot",
                "speed": 1,
                "bearing": 1.0,
                "timestamp": current_timestamp
            },
            {
                "lat": -33.87076,
                "lon": 151.20219,
                "alt": 20,
                "acc": 10.0,
                "bat": 100,
                "sat": 0,
                "useragent": "Bot",
                "timestamp": current_timestamp
            },
        ]

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(items, cls=DecimalEncoder)
    }
