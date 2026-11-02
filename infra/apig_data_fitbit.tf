# --- Zip Lambdas ---
data "archive_file" "fitbit_fetch_zip" {
  type        = "zip"
  source_file = "${path.module}/fitbit_fetch/fitbit_fetch.py"
  output_path = "${path.module}/fitbit_fetch.zip"
}

data "archive_file" "fitbit_api_zip" {
  type        = "zip"
  source_file = "${path.module}/fitbit_api/fitbit_api.py"
  output_path = "${path.module}/fitbit_api.zip"
}

# --- Fitbit Fetch Lambda (scheduled) ---
resource "aws_lambda_function" "fitbit_fetch" {
  filename         = data.archive_file.fitbit_fetch_zip.output_path
  function_name    = "fitbit_fetch"
  role             = aws_iam_role.fitbit_fetch_role.arn
  handler          = "fitbit_fetch.lambda_handler"
  runtime          = "python3.11"
  timeout          = 120
  source_code_hash = data.archive_file.fitbit_fetch_zip.output_base64sha256
  environment {
    variables = {
      # Client id and secret are read from SSM at runtime, so they are not
      # in the function config or Terraform state.
      TABLE_NAME = aws_dynamodb_table.fitbit_data.name
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
  filename         = data.archive_file.fitbit_api_zip.output_path
  function_name    = "fitbit_api"
  role             = aws_iam_role.fitbit_api_role.arn
  handler          = "fitbit_api.lambda_handler"
  runtime          = "python3.11"
  timeout          = 30
  source_code_hash = data.archive_file.fitbit_api_zip.output_base64sha256
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
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
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
