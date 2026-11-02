locals {

  env = {
    hamer = {
      aws_profile = "hamer"
      aws_region  = "us-east-1"
      domain_name = "hamer.cloud"
    }
    wcplumbing = {
      aws_profile = "hamer"
      aws_region  = "us-east-1"
      domain_name = "wcplumbing.com.au"
    }
  }

  workspace = local.env[terraform.workspace]
}
locals {
  # Created by hamercloud_bootstrap. Caps every role this stack runs.
  permissions_boundary_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/hamercloud-boundary"
}
