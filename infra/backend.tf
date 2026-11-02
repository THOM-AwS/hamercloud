# Same state as mytf/websites used, workspace "hamer" (set via TF_WORKSPACE), so
# this stack took over the existing resources without a state move. Credentials
# come from the environment (OIDC in CI, AWS_PROFILE=hamer locally).
terraform {
  required_version = ">= 1.10"
  backend "s3" {
    bucket         = "hamer-terraform-backend"
    key            = "tf-hamer/hamer-website"
    region         = "ap-southeast-2"
    dynamodb_table = "hamer-terraform-lock"
  }
}
