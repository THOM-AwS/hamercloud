resource "aws_api_gateway_integration" "ddb_get" {
  depends_on              = [aws_api_gateway_method.generic_get]
  rest_api_id             = aws_api_gateway_rest_api.generic_api.id
  resource_id             = aws_api_gateway_resource.generic_resource.id
  http_method             = aws_api_gateway_method.generic_get.http_method
  passthrough_behavior    = "NEVER"
  integration_http_method = "POST"
  uri                     = "arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/${aws_lambda_function.get.arn}/invocations"
  type                    = "AWS_PROXY"
}

resource "aws_api_gateway_method" "generic_get" {
  depends_on    = [aws_api_gateway_resource.generic_resource]
  rest_api_id   = aws_api_gateway_rest_api.generic_api.id
  resource_id   = aws_api_gateway_resource.generic_resource.id
  http_method   = "GET"
  authorization = "NONE"
  request_parameters = {
    "method.request.header.Content-Type" = true
  }
}

resource "aws_api_gateway_method_response" "get_200" {
  rest_api_id = aws_api_gateway_rest_api.generic_api.id
  resource_id = aws_api_gateway_resource.generic_resource.id
  http_method = aws_api_gateway_method.generic_get.http_method
  status_code = "200"
}

resource "aws_lambda_function" "get" {
  function_name    = "get_loc_Lambda"
  filename         = "lambda_package_get.zip"
  source_code_hash = filebase64sha256("lambda_package_get.zip")
  role             = aws_iam_role.lambda_logging.arn
  handler          = "lambdaGet.handler"
  runtime          = "python3.7"
  environment {
    variables = {
      LOG_LEVEL = "INFO"
    }
  }
}


resource "aws_lambda_permission" "apigw_get" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get.function_name
  principal     = "apigateway.amazonaws.com"
  # The /*/* in the source_arn is a wildcard that can be used to allow any method on any resource within the API Gateway.
  # Adjust the wildcard pattern as needed to be more specific if necessary.
  source_arn = "${aws_api_gateway_rest_api.generic_api.execution_arn}/*/*/*"
}
