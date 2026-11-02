# hamer.cloud's own security headers. The site owns them; the
# aws-static-website module only attaches the policy. Same values the
# Lambda@Edge secheader.py set before module v2.
locals {
  csp_directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google.com https://static.doubleclick.net https://www.youtube.com https://s.ytimg.com https://cdn.jsdelivr.net https://unpkg.com https://maps.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.youtube.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: https://avatars.githubusercontent.com https://i.ytimg.com https://yt3.ggpht.com https://www.googletagmanager.com https://www.google.com.au https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://maps.googleapis.com https://maps.gstatic.com https://khms0.googleapis.com https://khms1.googleapis.com https://www.google.co.jp",
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
    "connect-src 'self' https://www.googletagmanager.com https://www.google.com https://www.google.com.au https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://www.youtube.com https://play.google.com https://api.hamer.cloud https://api.github.com https://maps.googleapis.com https://raw.githubusercontent.com",
    "frame-src 'self' https://www.youtube.com https://cdn.jsdelivr.net",
    "object-src 'none'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests",
  ]
}

resource "aws_cloudfront_response_headers_policy" "site" {
  name    = "hamer-cloud-security-headers"
  comment = "Security headers and CSP for hamer.cloud"

  security_headers_config {
    content_security_policy {
      content_security_policy = join("; ", local.csp_directives)
      override                = true
    }

    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }

    content_type_options {
      override = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
  }

  custom_headers_config {
    items {
      header   = "Permissions-Policy"
      value    = "accelerometer=(), geolocation=(), microphone=(), camera=(), fullscreen=(self), payment=(), interest-cohort=(), usb=(), magnetometer=(), gyroscope=()"
      override = true
    }
  }
}
