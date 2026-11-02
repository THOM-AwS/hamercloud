resource "aws_api_gateway_integration" "ddb_integration" {
  depends_on              = [aws_api_gateway_method.generic_post]
  rest_api_id             = aws_api_gateway_rest_api.generic_api.id
  resource_id             = aws_api_gateway_resource.generic_resource.id
  http_method             = aws_api_gateway_method.generic_post.http_method
  passthrough_behavior    = "NEVER"
  integration_http_method = "POST"
  uri                     = "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/${aws_lambda_function.log_payload.arn}/invocations"
  type                    = "AWS_PROXY"
}

resource "aws_api_gateway_method" "generic_post" {
  depends_on    = [aws_api_gateway_resource.generic_resource]
  rest_api_id   = aws_api_gateway_rest_api.generic_api.id
  resource_id   = aws_api_gateway_resource.generic_resource.id
  http_method   = "POST"
  authorization = "NONE"
  request_parameters = {
    "method.request.header.Content-Type" = true
  }
}


resource "aws_iam_role" "lambda_logging" {
  name                 = "LambdaLoggingRole"
  permissions_boundary = local.permissions_boundary_arn

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "lambda_dynamodb_access" {
  name        = "LambdaDynamoDBAccess"
  description = "IAM policy for Lambda function to access DynamoDB"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "dynamodb:*"
        ],
        Resource = "arn:aws:dynamodb:us-east-1:490638925706:table/genericDataTable"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb_attachment" {
  role       = aws_iam_role.lambda_logging.name
  policy_arn = aws_iam_policy.lambda_dynamodb_access.arn
}


resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_logging.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "log_payload" {
  function_name    = "LogPayloadLambda"
  filename         = "lambda_package.zip"
  source_code_hash = filebase64sha256("lambda_package.zip")
  role             = aws_iam_role.lambda_logging.arn
  handler          = "lambda.handler"
  runtime          = "python3.7"
  environment {
    variables = {
      LOG_LEVEL = "INFO"
    }
  }
}


resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.log_payload.function_name
  principal     = "apigateway.amazonaws.com"
  # The /*/* in the source_arn is a wildcard that can be used to allow any method on any resource within the API Gateway.
  # Adjust the wildcard pattern as needed to be more specific if necessary.
  source_arn = "${aws_api_gateway_rest_api.generic_api.execution_arn}/*/*/*"
}

resource "aws_api_gateway_method_response" "post_200" {
  rest_api_id = aws_api_gateway_rest_api.generic_api.id
  resource_id = aws_api_gateway_resource.generic_resource.id
  http_method = aws_api_gateway_method.generic_post.http_method
  status_code = "200"
}


