resource "aws_cloudwatch_log_group" "apigw_log_group" {
  name              = "/aws/apigateway/GenericAPI"
  retention_in_days = 3
}
