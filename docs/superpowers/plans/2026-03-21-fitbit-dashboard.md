# Fitbit Health Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a comprehensive Fitbit health dashboard to hamer.cloud's Personal section with scheduled data fetching and 12-month retention.

**Architecture:** EventBridge triggers a fetch lambda every 4 hours to pull 30 days of Fitbit data (steps, HR, sleep, active mins, distance, weight) into a dedicated DynamoDB table. A separate API lambda serves cached data to the frontend via API Gateway. Chart.js renders 5 chart panels in the Personal section.

**Tech Stack:** Python 3.11 (Lambda), DynamoDB (PAY_PER_REQUEST), EventBridge, API Gateway, Terraform, Chart.js, HTML/JS

**Spec:** `docs/superpowers/specs/2026-03-21-fitbit-dashboard-design.md`

---

## File Structure

### Backend (Terraform + Lambda) — `/Users/thomashamer/source/mytf/websites/`

| File | Action | Responsibility |
|------|--------|---------------|
| `fitbit_fetch/fitbit_fetch.py` | Create | Scheduled lambda: fetches Fitbit API, writes to DDB, refreshes tokens |
| `fitbit_api/fitbit_api.py` | Create | API lambda: reads DDB, returns JSON with CORS |
| `ddb.tf` | Modify | Add `fitbitData` table |
| `apig_data_fitbit.tf` | Modify | Replace old lambda with two new ones, add OPTIONS, add EventBridge |
| `iam.tf` | Modify | Add `fitbit_fetch_role` and `fitbit_api_role` |

### Frontend — `/Users/thomashamer/source/hamercloud/`

| File | Action | Responsibility |
|------|--------|---------------|
| `assets/js/fitbit-dashboard.js` | Create | Fetch API data, render Chart.js charts |
| `index.html` | Modify | Add Health & Fitness section + script tags in Personal article |

---

### Task 1: Create DynamoDB table for Fitbit data

**Files:**
- Modify: `/Users/thomashamer/source/mytf/websites/ddb.tf`

- [ ] **Step 1: Add fitbitData table to ddb.tf**

Append to end of file:

```hcl
resource "aws_dynamodb_table" "fitbit_data" {
  name         = "fitbitData"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "date"

  attribute {
    name = "date"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Stack = "hamer.cloud"
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/thomashamer/source/mytf/websites
git add ddb.tf
git commit -m "feat: add fitbitData DynamoDB table for health dashboard"
```

---

### Task 2: Create Fitbit Fetch Lambda

**Files:**
- Create: `/Users/thomashamer/source/mytf/websites/fitbit_fetch/fitbit_fetch.py`

- [ ] **Step 1: Create fitbit_fetch directory**

```bash
mkdir -p /Users/thomashamer/source/mytf/websites/fitbit_fetch
```

- [ ] **Step 2: Write fitbit_fetch.py**

Create `/Users/thomashamer/source/mytf/websites/fitbit_fetch/fitbit_fetch.py`:

```python
import os
import json
import time
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from urllib.error import HTTPError

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

FITBIT_CLIENT_ID = os.environ.get("FITBIT_CLIENT_ID")
FITBIT_CLIENT_SECRET = os.environ.get("FITBIT_CLIENT_SECRET")
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
    return ssm.get_parameter(Name=name)["Parameter"]["Value"]


def put_ssm_param(name, value):
    ssm.put_parameter(Name=name, Value=value, Type="String", Overwrite=True)


def fitbit_get(access_token, endpoint):
    url = f"{BASE_URL}{endpoint}"
    req = Request(url, headers={"Authorization": f"Bearer {access_token}"})
    with urlopen(req) as resp:
        return json.loads(resp.read().decode())


def refresh_tokens():
    refresh_token = get_ssm_param("refresh_token")
    import base64
    auth = base64.b64encode(f"{FITBIT_CLIENT_ID}:{FITBIT_CLIENT_SECRET}".encode()).decode()
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
        steps_data = fetch_with_retry(access_token, "/1/user/-/activities/steps/date/today/30d.json")
        hr_data = fetch_with_retry(access_token, "/1/user/-/activities/heart/date/today/30d.json")
        fairly_data = fetch_with_retry(access_token, "/1/user/-/activities/minutesFairlyActive/date/today/30d.json")
        very_data = fetch_with_retry(access_token, "/1/user/-/activities/minutesVeryActive/date/today/30d.json")
        sleep_data = fetch_with_retry(access_token, f"/1.2/user/-/sleep/date/{thirty_days_ago}/{today}.json")
        distance_data = fetch_with_retry(access_token, "/1/user/-/activities/distance/date/today/30d.json")
        weight_data = fetch_with_retry(access_token, "/1/user/-/body/weight/date/today/30d.json")
    except Exception as e:
        logger.error("Failed to fetch Fitbit data: %s", e)
        try:
            boto3.client("cloudwatch", region_name="us-east-1").put_metric_data(
                Namespace="FitbitDashboard",
                MetricData=[{"MetricName": "FitbitTokenRefreshFailure", "Value": 1, "Unit": "Count"}],
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
```

- [ ] **Step 3: Copy requests library into fitbit_fetch (not needed — uses urllib)**

The lambda uses only `urllib.request` (stdlib) and `boto3` (available in Lambda runtime). No external dependencies needed.

- [ ] **Step 4: Commit**

```bash
cd /Users/thomashamer/source/mytf/websites
git add fitbit_fetch/
git commit -m "feat: add fitbit_fetch lambda for scheduled Fitbit data collection"
```

---

### Task 3: Create Fitbit API Lambda

**Files:**
- Create: `/Users/thomashamer/source/mytf/websites/fitbit_api/fitbit_api.py`

- [ ] **Step 1: Create fitbit_api directory**

```bash
mkdir -p /Users/thomashamer/source/mytf/websites/fitbit_api
```

- [ ] **Step 2: Write fitbit_api.py**

Create `/Users/thomashamer/source/mytf/websites/fitbit_api/fitbit_api.py`:

```python
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
```

- [ ] **Step 3: Commit**

```bash
cd /Users/thomashamer/source/mytf/websites
git add fitbit_api/
git commit -m "feat: add fitbit_api lambda to serve cached Fitbit data"
```

---

### Task 4: Update Terraform — IAM, Lambdas, EventBridge, API Gateway

**Files:**
- Modify: `/Users/thomashamer/source/mytf/websites/iam.tf`
- Modify: `/Users/thomashamer/source/mytf/websites/apig_data_fitbit.tf`

- [ ] **Step 1: Add new IAM roles to iam.tf**

Append to end of `iam.tf`:

```hcl
# Fitbit Fetch Lambda Role (SSM + DDB write + CloudWatch metrics)
resource "aws_iam_role" "fitbit_fetch_role" {
  name = "fitbit_fetch_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_policy" "fitbit_fetch_policy" {
  name = "fitbit_fetch_policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:PutParameter"]
        Resource = "arn:aws:ssm:us-east-1:${data.aws_caller_identity.current.account_id}:parameter/*"
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:Scan"]
        Resource = aws_dynamodb_table.fitbit_data.arn
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect   = "Allow"
        Action   = ["cloudwatch:PutMetricData"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "fitbit_fetch_attach" {
  policy_arn = aws_iam_policy.fitbit_fetch_policy.arn
  role       = aws_iam_role.fitbit_fetch_role.name
}

# Fitbit API Lambda Role (DDB read only)
resource "aws_iam_role" "fitbit_api_role" {
  name = "fitbit_api_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = ["lambda.amazonaws.com", "apigateway.amazonaws.com"] }
    }]
  })
}

resource "aws_iam_policy" "fitbit_api_policy" {
  name = "fitbit_api_policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:Scan"]
        Resource = aws_dynamodb_table.fitbit_data.arn
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "fitbit_api_attach" {
  policy_arn = aws_iam_policy.fitbit_api_policy.arn
  role       = aws_iam_role.fitbit_api_role.name
}
```

- [ ] **Step 2: Rewrite apig_data_fitbit.tf**

Replace entire contents of `apig_data_fitbit.tf` with:

```hcl
# --- Fitbit Client Secret SSM ---
data "aws_ssm_parameter" "client_id" {
  name = "fitbit_client_id"
}

data "aws_ssm_parameter" "client_secret" {
  name = "fitbit_client_secret"
}

# --- Zip Lambdas ---
resource "null_resource" "zip_fitbit_fetch" {
  triggers = {
    checksum = filemd5("fitbit_fetch/fitbit_fetch.py")
  }
  provisioner "local-exec" {
    command = "cd fitbit_fetch && zip -r ../fitbit_fetch.zip fitbit_fetch.py"
  }
}

resource "null_resource" "zip_fitbit_api" {
  triggers = {
    checksum = filemd5("fitbit_api/fitbit_api.py")
  }
  provisioner "local-exec" {
    command = "cd fitbit_api && zip -r ../fitbit_api.zip fitbit_api.py"
  }
}

# --- Fitbit Fetch Lambda (scheduled) ---
resource "aws_lambda_function" "fitbit_fetch" {
  depends_on       = [null_resource.zip_fitbit_fetch]
  filename         = "fitbit_fetch.zip"
  function_name    = "fitbit_fetch"
  role             = aws_iam_role.fitbit_fetch_role.arn
  handler          = "fitbit_fetch.lambda_handler"
  runtime          = "python3.11"
  timeout          = 120
  source_code_hash = filebase64sha256("fitbit_fetch.zip")
  environment {
    variables = {
      FITBIT_CLIENT_ID     = data.aws_ssm_parameter.client_id.value
      FITBIT_CLIENT_SECRET = data.aws_ssm_parameter.client_secret.value
      TABLE_NAME           = aws_dynamodb_table.fitbit_data.name
    }
  }
  tags = { Stack = "hamer.cloud" }
}

# --- EventBridge Schedule (every 4 hours) ---
resource "aws_cloudwatch_event_rule" "fitbit_schedule" {
  name                = "fitbit-fetch-schedule"
  description         = "Fetch Fitbit data every 4 hours"
  schedule_expression = "rate(4 hours)"
  tags                = { Stack = "hamer.cloud" }
}

resource "aws_cloudwatch_event_target" "fitbit_schedule_target" {
  rule = aws_cloudwatch_event_rule.fitbit_schedule.name
  arn  = aws_lambda_function.fitbit_fetch.arn
}

resource "aws_lambda_permission" "fitbit_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fitbit_fetch.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.fitbit_schedule.arn
}

# --- Fitbit API Lambda (API Gateway) ---
resource "aws_lambda_function" "fitbit_api" {
  depends_on       = [null_resource.zip_fitbit_api]
  filename         = "fitbit_api.zip"
  function_name    = "fitbit_api"
  role             = aws_iam_role.fitbit_api_role.arn
  handler          = "fitbit_api.lambda_handler"
  runtime          = "python3.11"
  timeout          = 30
  source_code_hash = filebase64sha256("fitbit_api.zip")
  tags             = { Stack = "hamer.cloud" }
}

resource "aws_lambda_permission" "fitbit_api_apigw" {
  statement_id  = "AllowAPIGatewayInvokeFitbitApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fitbit_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.generic_api.execution_arn}/*/*/*"
}

# --- API Gateway: GET /fitbit ---
resource "aws_api_gateway_method" "fitbit_get" {
  rest_api_id   = aws_api_gateway_rest_api.generic_api.id
  resource_id   = aws_api_gateway_resource.fitbit_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "fitbit_api_integration" {
  rest_api_id             = aws_api_gateway_rest_api.generic_api.id
  resource_id             = aws_api_gateway_resource.fitbit_resource.id
  http_method             = aws_api_gateway_method.fitbit_get.http_method
  integration_http_method = "POST"
  uri                     = "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/${aws_lambda_function.fitbit_api.arn}/invocations"
  type                    = "AWS_PROXY"
  credentials             = aws_iam_role.fitbit_api_role.arn
}

resource "aws_api_gateway_method_response" "fitbit_get_200" {
  rest_api_id = aws_api_gateway_rest_api.generic_api.id
  resource_id = aws_api_gateway_resource.fitbit_resource.id
  http_method = aws_api_gateway_method.fitbit_get.http_method
  status_code = "200"
}

# --- API Gateway: OPTIONS /fitbit (CORS preflight) ---
resource "aws_api_gateway_method" "fitbit_options" {
  rest_api_id   = aws_api_gateway_rest_api.generic_api.id
  resource_id   = aws_api_gateway_resource.fitbit_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "fitbit_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.generic_api.id
  resource_id = aws_api_gateway_resource.fitbit_resource.id
  http_method = aws_api_gateway_method.fitbit_options.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "fitbit_options_200" {
  rest_api_id = aws_api_gateway_rest_api.generic_api.id
  resource_id = aws_api_gateway_resource.fitbit_resource.id
  http_method = aws_api_gateway_method.fitbit_options.http_method
  status_code = "200"
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "fitbit_options_response" {
  rest_api_id = aws_api_gateway_rest_api.generic_api.id
  resource_id = aws_api_gateway_resource.fitbit_resource.id
  http_method = aws_api_gateway_method.fitbit_options.http_method
  status_code = aws_api_gateway_method_response.fitbit_options_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'https://hamer.cloud'"
  }
}

# --- CloudWatch Alarm for token refresh failures ---
resource "aws_cloudwatch_metric_alarm" "fitbit_token_failure" {
  alarm_name          = "fitbit-token-refresh-failure"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "FitbitTokenRefreshFailure"
  namespace           = "FitbitDashboard"
  period              = 86400
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Fitbit OAuth token refresh failed - re-authorization required"
  treat_missing_data  = "notBreaching"
  tags                = { Stack = "hamer.cloud" }
}
```

- [ ] **Step 3: Store Fitbit client secret in SSM** (one-time manual step)

```bash
/opt/homebrew/bin/aws ssm put-parameter \
  --name "fitbit_client_secret" \
  --value "d26f4f480f035127efb5efcfffa6c0b8" \
  --type String \
  --overwrite \
  --profile hamer \
  --region us-east-1
```

- [ ] **Step 4: Commit**

```bash
cd /Users/thomashamer/source/mytf/websites
git add iam.tf apig_data_fitbit.tf
git commit -m "feat: terraform for fitbit fetch/api lambdas, eventbridge, CORS, alarm"
```

---

### Task 5: Deploy Infrastructure with Terraform

**Files:** None (Terraform apply)

- [ ] **Step 1: Create zip files for both lambdas**

```bash
cd /Users/thomashamer/source/mytf/websites
cd fitbit_fetch && zip -r ../fitbit_fetch.zip fitbit_fetch.py && cd ..
cd fitbit_api && zip -r ../fitbit_api.zip fitbit_api.py && cd ..
```

- [ ] **Step 2: Terraform init and plan**

```bash
cd /Users/thomashamer/source/mytf/websites
AWS_PROFILE=hamer terraform init
AWS_PROFILE=hamer terraform plan -out=tfplan
```

Expected: New resources for `fitbit_fetch`, `fitbit_api`, `fitbitData` table, EventBridge rule, IAM roles, OPTIONS method. Old `fitbit_lambda` resources will be destroyed.

- [ ] **Step 3: Terraform apply**

```bash
AWS_PROFILE=hamer terraform apply "tfplan"
```

Wait for completion (CloudFront may take 2-5 minutes).

- [ ] **Step 4: Manually invoke fitbit_fetch to populate initial data**

```bash
/opt/homebrew/bin/aws lambda invoke \
  --function-name fitbit_fetch \
  --profile hamer \
  --region us-east-1 \
  /tmp/fitbit_fetch_output.json && cat /tmp/fitbit_fetch_output.json
```

Expected: `{"statusCode": 200, "body": "{\"items_written\": 30}"}`

- [ ] **Step 5: Verify data in DynamoDB**

```bash
/opt/homebrew/bin/aws dynamodb scan \
  --table-name fitbitData \
  --profile hamer \
  --region us-east-1 \
  --max-items 3 | python3 -m json.tool | head -30
```

Expected: Items with `date`, `steps`, `resting_hr`, etc.

- [ ] **Step 6: Verify API endpoint**

```bash
curl -s "https://api.hamer.cloud/fitbit" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d), 'items'); print(json.dumps(d[0], indent=2))" 2>&1 | head -20
```

Note: May need to create a new API Gateway deployment after Terraform changes:

```bash
/opt/homebrew/bin/aws apigateway create-deployment \
  --rest-api-id nnsw0xovm4 \
  --stage-name prod \
  --profile hamer \
  --region us-east-1
```

- [ ] **Step 7: Commit any generated files**

```bash
cd /Users/thomashamer/source/mytf/websites
git add -A
git commit -m "chore: add generated zip files for fitbit lambdas"
```

---

### Task 6: Create Frontend — Chart.js Dashboard

**Files:**
- Create: `/Users/thomashamer/source/hamercloud/assets/js/fitbit-dashboard.js`

- [ ] **Step 1: Write fitbit-dashboard.js**

Create `/Users/thomashamer/source/hamercloud/assets/js/fitbit-dashboard.js`:

```javascript
(function() {
  'use strict';

  var API_URL = 'https://api.hamer.cloud/fitbit';

  var COLORS = {
    steps: '#4FC3F7',
    hr: '#EF5350',
    fairlyActive: '#FFB74D',
    veryActive: '#FF7043',
    sleepDeep: '#5C6BC0',
    sleepLight: '#7986CB',
    sleepRem: '#9FA8DA',
    sleepWake: '#E0E0E0',
    distance: '#66BB6A',
    weight: '#AB47BC',
    grid: 'rgba(255,255,255,0.1)',
    text: 'rgba(255,255,255,0.7)',
    textBright: 'rgba(255,255,255,0.9)'
  };

  var CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        cornerRadius: 4
      }
    },
    scales: {
      x: {
        ticks: { color: COLORS.text, maxRotation: 0, maxTicksLimit: 7 },
        grid: { color: COLORS.grid }
      },
      y: {
        ticks: { color: COLORS.text },
        grid: { color: COLORS.grid }
      }
    }
  };

  function formatDate(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  }

  function avg(arr) {
    var valid = arr.filter(function(v) { return v != null; });
    if (valid.length === 0) return 0;
    return Math.round(valid.reduce(function(a, b) { return a + b; }, 0) / valid.length);
  }

  function last(arr) {
    for (var i = arr.length - 1; i >= 0; i--) {
      if (arr[i] != null) return arr[i];
    }
    return null;
  }

  function createChart(canvasId, config) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    return new Chart(canvas, config);
  }

  function renderSteps(data) {
    var labels = data.map(function(d) { return formatDate(d.date); });
    var values = data.map(function(d) { return d.steps || 0; });
    var todaySteps = last(values) || 0;
    var avgSteps = avg(values);

    document.getElementById('fitbit-steps-today').textContent = todaySteps.toLocaleString();
    document.getElementById('fitbit-steps-avg').textContent = avgSteps.toLocaleString();

    createChart('fitbit-steps-chart', {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: COLORS.steps + '99',
          borderColor: COLORS.steps,
          borderWidth: 1,
          borderRadius: 2
        }]
      },
      options: CHART_DEFAULTS
    });
  }

  function renderHeartRate(data) {
    var labels = data.map(function(d) { return formatDate(d.date); });
    var values = data.map(function(d) { return d.resting_hr || null; });
    var latestHr = last(values);
    var avgHr = avg(values);

    document.getElementById('fitbit-hr-latest').textContent = latestHr ? latestHr + ' bpm' : '--';
    document.getElementById('fitbit-hr-avg').textContent = avgHr ? avgHr + ' bpm' : '--';

    createChart('fitbit-hr-chart', {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          borderColor: COLORS.hr,
          backgroundColor: COLORS.hr + '33',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 5,
          spanGaps: true
        }]
      },
      options: CHART_DEFAULTS
    });
  }

  function renderActiveMinutes(data) {
    var labels = data.map(function(d) { return formatDate(d.date); });
    var fairly = data.map(function(d) { return d.active_minutes_fairly || 0; });
    var very = data.map(function(d) { return d.active_minutes_very || 0; });
    var todayTotal = (last(fairly) || 0) + (last(very) || 0);

    document.getElementById('fitbit-active-today').textContent = todayTotal + ' min';

    createChart('fitbit-active-chart', {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Very Active',
            data: very,
            backgroundColor: COLORS.veryActive + '99',
            borderColor: COLORS.veryActive,
            borderWidth: 1,
            borderRadius: 2
          },
          {
            label: 'Fairly Active',
            data: fairly,
            backgroundColor: COLORS.fairlyActive + '99',
            borderColor: COLORS.fairlyActive,
            borderWidth: 1,
            borderRadius: 2
          }
        ]
      },
      options: Object.assign({}, CHART_DEFAULTS, {
        plugins: Object.assign({}, CHART_DEFAULTS.plugins, {
          legend: { display: true, labels: { color: COLORS.text, boxWidth: 12 } }
        }),
        scales: Object.assign({}, CHART_DEFAULTS.scales, {
          x: Object.assign({}, CHART_DEFAULTS.scales.x, { stacked: true }),
          y: Object.assign({}, CHART_DEFAULTS.scales.y, { stacked: true })
        })
      })
    });
  }

  function renderSleep(data) {
    var sleepDays = data.filter(function(d) { return d.sleep_deep_min != null; });
    if (sleepDays.length === 0) {
      document.getElementById('fitbit-sleep-last').textContent = 'No data';
      return;
    }

    var labels = sleepDays.map(function(d) { return formatDate(d.date); });
    var deep = sleepDays.map(function(d) { return (d.sleep_deep_min || 0) / 60; });
    var light = sleepDays.map(function(d) { return (d.sleep_light_min || 0) / 60; });
    var rem = sleepDays.map(function(d) { return (d.sleep_rem_min || 0) / 60; });
    var wake = sleepDays.map(function(d) { return (d.sleep_wake_min || 0) / 60; });

    var lastSleep = sleepDays[sleepDays.length - 1];
    var totalMin = (lastSleep.sleep_deep_min || 0) + (lastSleep.sleep_light_min || 0) +
                   (lastSleep.sleep_rem_min || 0) + (lastSleep.sleep_wake_min || 0);
    var hours = Math.floor(totalMin / 60);
    var mins = totalMin % 60;
    document.getElementById('fitbit-sleep-last').textContent = hours + 'h ' + mins + 'm';

    createChart('fitbit-sleep-chart', {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Deep', data: deep, backgroundColor: COLORS.sleepDeep, borderRadius: 2 },
          { label: 'Light', data: light, backgroundColor: COLORS.sleepLight, borderRadius: 2 },
          { label: 'REM', data: rem, backgroundColor: COLORS.sleepRem, borderRadius: 2 },
          { label: 'Awake', data: wake, backgroundColor: COLORS.sleepWake, borderRadius: 2 }
        ]
      },
      options: Object.assign({}, CHART_DEFAULTS, {
        plugins: Object.assign({}, CHART_DEFAULTS.plugins, {
          legend: { display: true, labels: { color: COLORS.text, boxWidth: 12 } },
          tooltip: Object.assign({}, CHART_DEFAULTS.plugins.tooltip, {
            callbacks: {
              label: function(ctx) {
                return ctx.dataset.label + ': ' + (ctx.raw * 60).toFixed(0) + ' min';
              }
            }
          })
        }),
        scales: Object.assign({}, CHART_DEFAULTS.scales, {
          x: Object.assign({}, CHART_DEFAULTS.scales.x, { stacked: true }),
          y: Object.assign({}, CHART_DEFAULTS.scales.y, {
            stacked: true,
            title: { display: true, text: 'Hours', color: COLORS.text }
          })
        })
      })
    });
  }

  function renderDistanceWeight(data) {
    var labels = data.map(function(d) { return formatDate(d.date); });
    var distance = data.map(function(d) { return d.distance || 0; });
    var weight = data.map(function(d) { return d.weight || null; });

    var todayDist = last(distance) || 0;
    var latestWeight = last(weight);
    document.getElementById('fitbit-dist-today').textContent = todayDist.toFixed(1) + ' km';
    document.getElementById('fitbit-weight-latest').textContent = latestWeight ? latestWeight.toFixed(1) + ' kg' : '--';

    createChart('fitbit-dw-chart', {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Distance (km)',
            data: distance,
            borderColor: COLORS.distance,
            backgroundColor: COLORS.distance + '33',
            fill: true,
            tension: 0.3,
            pointRadius: 2,
            yAxisID: 'y'
          },
          {
            label: 'Weight (kg)',
            data: weight,
            borderColor: COLORS.weight,
            borderDash: [5, 5],
            tension: 0.3,
            pointRadius: 3,
            spanGaps: true,
            yAxisID: 'y1'
          }
        ]
      },
      options: Object.assign({}, CHART_DEFAULTS, {
        plugins: Object.assign({}, CHART_DEFAULTS.plugins, {
          legend: { display: true, labels: { color: COLORS.text, boxWidth: 12 } }
        }),
        scales: {
          x: CHART_DEFAULTS.scales.x,
          y: {
            type: 'linear',
            position: 'left',
            ticks: { color: COLORS.distance },
            grid: { color: COLORS.grid },
            title: { display: true, text: 'km', color: COLORS.distance }
          },
          y1: {
            type: 'linear',
            position: 'right',
            ticks: { color: COLORS.weight },
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'kg', color: COLORS.weight }
          }
        }
      })
    });
  }

  function renderDashboard(data) {
    if (!data || data.length === 0) {
      document.getElementById('fitbit-loading').textContent = 'Health data temporarily unavailable';
      return;
    }

    document.getElementById('fitbit-loading').style.display = 'none';
    document.getElementById('fitbit-charts').style.display = 'block';

    var lastItem = data[data.length - 1];
    if (lastItem && lastItem.date) {
      var d = new Date(lastItem.date + 'T00:00:00');
      document.getElementById('fitbit-updated').textContent =
        'Last data: ' + d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    renderSteps(data);
    renderHeartRate(data);
    renderActiveMinutes(data);
    renderSleep(data);
    renderDistanceWeight(data);
  }

  function init() {
    var container = document.getElementById('fitbit-dashboard');
    if (!container) return;

    fetch(API_URL)
      .then(function(res) { return res.json(); })
      .then(renderDashboard)
      .catch(function(err) {
        console.error('[Fitbit Dashboard] Error:', err);
        document.getElementById('fitbit-loading').textContent = 'Health data temporarily unavailable';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

- [ ] **Step 2: Commit**

```bash
cd /Users/thomashamer/source/hamercloud
git add assets/js/fitbit-dashboard.js
git commit -m "feat: add Chart.js health dashboard frontend"
```

---

### Task 7: Add Health & Fitness Section to index.html

**Files:**
- Modify: `/Users/thomashamer/source/hamercloud/index.html`

- [ ] **Step 1: Add Chart.js CDN script tag**

In the `<head>` section, after the existing preconnect hints, add:

```html
<link rel="preconnect" href="https://cdn.jsdelivr.net">
```

Note: This preconnect already exists at line 84. No change needed.

Before the closing `</body>` tag (after the other script tags around line 990), add:

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js" defer></script>
<script src="assets/js/fitbit-dashboard.js" defer></script>
```

- [ ] **Step 2: Add Health & Fitness HTML section**

Insert before the `<h3>Lifespan</h3>` line in the Personal article (around line 739):

```html
				<h3>Health & Fitness</h3>
				<p id="fitbit-updated" style="color: rgba(255,255,255,0.5); font-size: 0.85em;"></p>
				<div id="fitbit-dashboard">
					<p id="fitbit-loading" style="text-align: center; color: rgba(255,255,255,0.5);">Loading health data...</p>
					<div id="fitbit-charts" style="display: none;">
						<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5em; margin-bottom: 1.5em;">
							<div>
								<p style="margin-bottom: 0.3em;"><strong>Steps</strong> <span style="color: rgba(255,255,255,0.5); font-size: 0.85em;">Today: <span id="fitbit-steps-today">--</span> | Avg: <span id="fitbit-steps-avg">--</span></span></p>
								<div style="height: 200px;"><canvas id="fitbit-steps-chart"></canvas></div>
							</div>
							<div>
								<p style="margin-bottom: 0.3em;"><strong>Resting Heart Rate</strong> <span style="color: rgba(255,255,255,0.5); font-size: 0.85em;">Latest: <span id="fitbit-hr-latest">--</span> | Avg: <span id="fitbit-hr-avg">--</span></span></p>
								<div style="height: 200px;"><canvas id="fitbit-hr-chart"></canvas></div>
							</div>
						</div>
						<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5em; margin-bottom: 1.5em;">
							<div>
								<p style="margin-bottom: 0.3em;"><strong>Active Minutes</strong> <span style="color: rgba(255,255,255,0.5); font-size: 0.85em;">Today: <span id="fitbit-active-today">--</span></span></p>
								<div style="height: 200px;"><canvas id="fitbit-active-chart"></canvas></div>
							</div>
							<div>
								<p style="margin-bottom: 0.3em;"><strong>Sleep</strong> <span style="color: rgba(255,255,255,0.5); font-size: 0.85em;">Last: <span id="fitbit-sleep-last">--</span></span></p>
								<div style="height: 200px;"><canvas id="fitbit-sleep-chart"></canvas></div>
							</div>
						</div>
						<div>
							<p style="margin-bottom: 0.3em;"><strong>Distance & Weight</strong> <span style="color: rgba(255,255,255,0.5); font-size: 0.85em;">Distance: <span id="fitbit-dist-today">--</span> | Weight: <span id="fitbit-weight-latest">--</span></span></p>
							<div style="height: 200px;"><canvas id="fitbit-dw-chart"></canvas></div>
						</div>
					</div>
				</div>

```

- [ ] **Step 3: Commit**

```bash
cd /Users/thomashamer/source/hamercloud
git add index.html
git commit -m "feat: add Health & Fitness section with Chart.js dashboard"
```

---

### Task 8: Deploy Frontend and Verify End-to-End

- [ ] **Step 1: Push hamercloud to deploy via GitHub Actions**

```bash
cd /Users/thomashamer/source/hamercloud
git push origin main
```

Wait for GitHub Actions to deploy to S3/CloudFront.

- [ ] **Step 2: Invalidate CloudFront cache**

```bash
/opt/homebrew/bin/aws cloudfront create-invalidation \
  --distribution-id E3EZ46MUZPKKIB \
  --paths "/*" \
  --profile hamer
```

- [ ] **Step 3: Verify in browser**

Open `https://hamer.cloud/#personal` in incognito. The Health & Fitness section should show 5 charts with 30 days of data. Check browser console for any CSP or CORS errors.

- [ ] **Step 4: Verify EventBridge schedule is active**

```bash
/opt/homebrew/bin/aws events list-rules \
  --name-prefix fitbit \
  --profile hamer \
  --region us-east-1
```

Expected: `fitbit-fetch-schedule` with State `ENABLED`.

---

### Task 9: Cleanup Old Fitbit Lambda

**Files:**
- Modify: `/Users/thomashamer/source/mytf/websites/apig_data_fitbit.tf` (already replaced in Task 4)

- [ ] **Step 1: Verify new system is working**

Confirm API endpoint, charts rendering, and EventBridge schedule are all operational before removing anything.

- [ ] **Step 2: Remove old fitbit_deployment directory**

Move to trash (not rm, per user rules):

```bash
mv /Users/thomashamer/source/mytf/websites/fitbit_deployment ~/.Trash/fitbit_deployment_backup_$(date +%Y%m%d)
mv /Users/thomashamer/source/mytf/websites/fitbit.zip ~/.Trash/fitbit_zip_backup_$(date +%Y%m%d)
```

- [ ] **Step 3: Commit cleanup**

```bash
cd /Users/thomashamer/source/mytf/websites
git add -A
git commit -m "chore: remove old fitbit_lambda deployment files"
```
