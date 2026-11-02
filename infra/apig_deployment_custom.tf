resource "aws_api_gateway_deployment" "deploy_api" {
  depends_on = [
    aws_api_gateway_rest_api.generic_api,
    aws_api_gateway_integration.ddb_integration,
    aws_api_gateway_integration.ddb_get,
    aws_api_gateway_integration.fitbit_api_integration,
    aws_api_gateway_integration.fitbit_options_integration,
    aws_api_gateway_integration.robots_integration,
  ]
  rest_api_id = aws_api_gateway_rest_api.generic_api.id
  # The API is built from separate resources, so rest_api.body is always null and
  # hashing it never changed. Hash the resources instead so any route, method or
  # integration change creates a new deployment and the stage picks it up.
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.generic_resource,
      aws_api_gateway_resource.fitbit_resource,
      aws_api_gateway_resource.robots_resource,
      aws_api_gateway_method.generic_get,
      aws_api_gateway_method.generic_post,
      aws_api_gateway_method.fitbit_get,
      aws_api_gateway_method.fitbit_options,
      aws_api_gateway_method.robots_get,
      aws_api_gateway_integration.ddb_get,
      aws_api_gateway_integration.ddb_integration,
      aws_api_gateway_integration.fitbit_api_integration,
      aws_api_gateway_integration.fitbit_options_integration,
      aws_api_gateway_integration.robots_integration,
      aws_api_gateway_method_response.get_200,
      aws_api_gateway_method_response.post_200,
      aws_api_gateway_method_response.fitbit_get_200,
      aws_api_gateway_method_response.fitbit_options_200,
      aws_api_gateway_method_response.robots_200,
      aws_api_gateway_integration_response.fitbit_options_response,
      aws_api_gateway_integration_response.robots_response,
    ]))
  }

  # The prod stage points at this deployment; create the new one before the old
  # one is deleted or the delete fails with an active-stage error.
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_domain_name" "api_custom_domain" {
  domain_name              = "api.hamer.cloud"
  regional_certificate_arn = "arn:aws:acm:us-east-1:${data.aws_caller_identity.current.account_id}:certificate/7bba1b38-d28c-4665-aa2d-456785dc1b76"
  security_policy          = "TLS_1_2"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_base_path_mapping" "api_base_path_mapping" {
  depends_on  = [aws_api_gateway_deployment.deploy_api]
  api_id      = aws_api_gateway_rest_api.generic_api.id
  stage_name  = aws_api_gateway_stage.api_stage.stage_name
  domain_name = aws_api_gateway_domain_name.api_custom_domain.domain_name
}

resource "aws_api_gateway_account" "apigw_account" {
  cloudwatch_role_arn = aws_iam_role.apigw_cloudwatch_logging_role.arn
}

resource "aws_api_gateway_stage" "api_stage" {
  depends_on    = [aws_cloudwatch_log_group.apigw_log_group]
  deployment_id = aws_api_gateway_deployment.deploy_api.id
  rest_api_id   = aws_api_gateway_rest_api.generic_api.id
  stage_name    = "prod"
  lifecycle { create_before_destroy = true }

  # Enable logs
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.apigw_log_group.arn
    format          = "value: $context.identity.sourceIp $context.identity.caller $context.identity.user [$context.requestTime] \"$context.httpMethod $context.resourcePath $context.protocol\" $context.status $context.responseLength $context.requestId"
  }
  xray_tracing_enabled = true
}
