# Security Policy

The security of contributors and users matters. Please follow this policy when reporting a potential vulnerability.

## Supported versions

| Version | Security updates |
| --- | --- |
| Latest version on the default branch | Supported |
| Older versions | Not currently supported |

## Reporting a vulnerability

**Please do not disclose suspected vulnerabilities in public issues, pull requests, discussions, or social media.**

Use GitHub's private vulnerability reporting feature:

1. Open this repository on GitHub.
2. Select the **Security** tab.
3. Choose **Report a vulnerability** (if the feature is enabled).
4. Include a concise description, affected component, impact, and safe reproduction steps.

If private vulnerability reporting is unavailable, contact the repository maintainer privately through GitHub. Do not include secrets or other people's personal information in a report.

## What to include

- Affected file, component, or dependency.
- The impact you believe is possible.
- Steps to reproduce in a test environment.
- Any suggested mitigation, if known.

Please allow reasonable time for investigation and a fix before sharing details publicly. The maintainer will acknowledge and assess reports as soon as practical; no fixed response-time guarantee is made.

## Security practices

- Never commit API keys, passwords, access tokens, or private environment files.
- Keep real credentials in local environment files or your hosting provider's secret manager.
- Do not expose privileged API credentials in browser-delivered code. Client-side environment variables are not secret.
- Keep dependencies updated and review security advisories.
- Validate untrusted input and handle external data carefully.
- Use least-privilege access for tokens and integrations.
