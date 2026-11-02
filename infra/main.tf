data "aws_caller_identity" "current" {}

module "aws-static-website" {
  source = "github.com/THOM-AwS/aws-static-website?ref=v2.0.0"

  domain_name                = local.workspace["domain_name"]
  hosted_zone_id             = data.aws_route53_zone.hamer_zone.zone_id
  certificate_arn            = data.aws_acm_certificate.site.arn
  response_headers_policy_id = aws_cloudfront_response_headers_policy.site.id
  environment                = "prod"
  tags = {
    "Stack" = local.workspace["domain_name"]
  }
}

# The issued certificate v1 looked up inside the module. It covers the apex
# and www; the site owns it, not the module.
data "aws_acm_certificate" "site" {
  domain      = local.workspace["domain_name"]
  statuses    = ["ISSUED"]
  most_recent = true
}
