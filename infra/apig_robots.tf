// robots.txt endpoint for api.hamer.cloud
// Returns a simple Disallow: / to prevent search engines from crawling the API
resource "aws_api_gateway_resource" "robots_resource" {
  rest_api_id = aws_api_gateway_rest_api.generic_api.id
  parent_id   = aws_api_gateway_rest_api.generic_api.root_resource_id
  path_part   = "robots.txt"
}

resource "aws_api_gateway_method" "robots_get" {
  rest_api_id   = aws_api_gateway_rest_api.generic_api.id
  resource_id   = aws_api_gateway_resource.robots_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "robots_integration" {
  rest_api_id = aws_api_gateway_rest_api.generic_api.id
  resource_id = aws_api_gateway_resource.robots_resource.id
  http_method = aws_api_gateway_method.robots_get.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "robots_200" {
  rest_api_id = aws_api_gateway_rest_api.generic_api.id
  resource_id = aws_api_gateway_resource.robots_resource.id
  http_method = aws_api_gateway_method.robots_get.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Content-Type" = true
  }
}

resource "aws_api_gateway_integration_response" "robots_response" {
  rest_api_id = aws_api_gateway_rest_api.generic_api.id
  resource_id = aws_api_gateway_resource.robots_resource.id
  http_method = aws_api_gateway_method.robots_get.http_method
  status_code = aws_api_gateway_method_response.robots_200.status_code

  response_parameters = {
    "method.response.header.Content-Type" = "'text/plain'"
  }

  response_templates = {
    "application/json" = <<-EOF
User-agent: *
Disallow: /

# This is an API endpoint, not a website.
# All content is served from https://hamer.cloud/
EOF
  }
}
