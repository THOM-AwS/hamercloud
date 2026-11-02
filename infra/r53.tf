data "aws_route53_zone" "hamer_zone" {
  name = "hamer.cloud"
}

resource "aws_route53_record" "api_record" {
  name    = "api.hamer.cloud"
  type    = "A"
  zone_id = data.aws_route53_zone.hamer_zone.zone_id

  alias {
    name                   = aws_api_gateway_domain_name.api_custom_domain.regional_domain_name
    zone_id                = "Z1UJRXOUMOOFQ8"
    evaluate_target_health = false
  }
}

output "api_custom_domain_name" {
  value = aws_api_gateway_domain_name.api_custom_domain.regional_domain_name
}
