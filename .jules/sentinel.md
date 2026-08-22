## 2025-08-21 - Authorization Defense on Serverless Stripe Product Creation Endpoint
**Vulnerability:** The Cloudflare Pages serverless endpoint `functions/api/stripe-product-create.js` lacked authorization validation on incoming HTTP requests, allowing any unauthenticated caller to invoke Stripe API product and price creation when `STRIPE_SECRET_KEY` was configured or pollute catalog logs.
**Learning:** Serverless edge functions handling privileged operations (such as creating Stripe products or initiating financial resources) must enforce explicit token/credential verification (`Authorization` or `X-Admin-Token`) independently from client-side JS abstractions.
**Prevention:** Always implement an authorization guard checking bearer tokens against admin secrets or JWT claims at the top of serverless POST handlers before executing side effects or proxying third-party API mutations.

## 2025-08-22 - Authorization and Role Checks on OWASP ZAP Serverless Endpoint
**Vulnerability:** The OWASP ZAP serverless proxy endpoint `functions/api/zap-scan.js` lacked request authorization and allowed mock token bypasses in remote environments, as well as accepting non-admin Firebase identities without verifying role privileges.
**Learning:** Mock token bypasses must be explicitly bounded to local development environments (`localhost`, `127.0.0.1`, `ENVIRONMENT === 'development'`). Furthermore, after verifying Firebase ID token signatures via Web Crypto API, serverless endpoints handling privileged operations must verify the user's role against Firestore (`admin` or `editor`) before granting access.
**Prevention:** Enforce environment isolation for mock auth overrides and always pair JWT signature verification with explicit role check queries on sensitive serverless endpoints.
