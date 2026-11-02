resource "aws_iam_role" "api_gw_to_ddb" {
  name                 = "ApiGatewayToDynamoDBRole"
  permissions_boundary = local.permissions_boundary_arn

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "api_gw_ddb_access" {
  name = "ApiGatewayDynamoDBAccess"
  role = aws_iam_role.api_gw_to_ddb.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ],
        Effect   = "Allow",
        Resource = aws_dynamodb_table.generic_data.arn
      }
    ]
  })
}


resource "aws_iam_role" "apigw_cloudwatch_logging_role" {
  name                 = "APIGWCWLoggingRole"
  permissions_boundary = local.permissions_boundary_arn

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Principal = {
          Service = "apigateway.amazonaws.com"
        },
        Effect = "Allow"
      }
    ]
  })
}

resource "aws_iam_role_policy" "apigw_cloudwatch_logging_policy" {
  name = "APIGWCWLoggingPolicy"
  role = aws_iam_role.apigw_cloudwatch_logging_role.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "logs:CreateLogGroup",
        Resource = "*"
      },
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogStream",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
          "logs:PutLogEvents"
        ],
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}


# Fitbit Fetch Lambda Role (SSM + DDB write + CloudWatch metrics)
resource "aws_iam_role" "fitbit_fetch_role" {
  name                 = "fitbit_fetch_role"
  permissions_boundary = local.permissions_boundary_arn

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
        Effect = "Allow"
        Action = ["ssm:GetParameter", "ssm:PutParameter"]
        Resource = [for n in ["fitbit_client_id", "fitbit_client_secret", "access_token", "refresh_token"] :
        "arn:aws:ssm:us-east-1:${data.aws_caller_identity.current.account_id}:parameter/${n}"]
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
  name                 = "fitbit_api_role"
  permissions_boundary = local.permissions_boundary_arn

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
        Action   = ["lambda:InvokeFunction"]
        Resource = "arn:aws:lambda:us-east-1:${data.aws_caller_identity.current.account_id}:function:fitbit_api"
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
