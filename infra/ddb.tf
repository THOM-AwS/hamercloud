resource "aws_dynamodb_table" "generic_data" {
  name           = "genericDataTable"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1

  attribute {
    name = "timestamp"
    type = "S"
  }

  hash_key = "timestamp"

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
}

resource "aws_dynamodb_table" "ddb_website_cache" {
  name         = "WebSiteCache"
  billing_mode = "PAY_PER_REQUEST" # On-demand capacity mode for cost-effectiveness
  hash_key     = "Date"
  range_key    = "TTL" # Adding TTL as a range key

  attribute {
    name = "Date"
    type = "S"
  }

  attribute {
    name = "TTL"
    type = "N"
  }

  ttl {
    attribute_name = "TTL"
    enabled        = true
  }
}

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
