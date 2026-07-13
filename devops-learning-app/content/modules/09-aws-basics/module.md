# AWS Basics (IAM, EC2, S3, VPC)

## Overview

Four services underpin almost everything on AWS: **IAM** (who may do what), **EC2** (virtual
servers), **S3** (object storage), and **VPC** (your private network). Master these and the
other 200+ services become variations on familiar themes.

**Prerequisites:** Linux, networking basics. **Estimated time:** 10 hours.
**Cost note:** all exercises fit in the free tier or cost cents — always tag and tear down.

## Key Concepts

### IAM — Identity and Access Management
- **Users** (humans — prefer SSO/Identity Center), **groups**, **roles** (assumable identities
  for services/machines — no long-lived keys), **policies** (JSON allow/deny documents).
- Evaluation: **explicit deny > explicit allow > implicit deny (default)**.
- **Least privilege** is the discipline; wildcards (`"Action": "*"` on `"Resource": "*"`) are the anti-pattern.
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject"],
    "Resource": "arn:aws:s3:::acme-app-uploads/*"
  }]
}
```
- Golden rules: never use the root account for daily work (MFA it, lock it away); attach
  **roles** to EC2/Lambda instead of embedding access keys; rotate anything long-lived.

### EC2 — Elastic Compute Cloud
- **Instance** = VM: AMI (image) + instance type (`t3.micro` burstable, `m6i` general,
  `c7g` compute/Graviton) + EBS volumes + **security groups**.
- **Security groups** are stateful virtual firewalls: allow rules only; return traffic is
  automatic. (NACLs are the stateless subnet-level cousin.)
- **User data** = boot script for bootstrap; **instance metadata** at `169.254.169.254`
  (use IMDSv2) exposes identity/credentials to the instance.
- Pricing ladders: on-demand → reserved/savings plans (steady state) → **spot** (interruptible,
  up to ~90% off — perfect for CI runners and batch).

### S3 — Simple Storage Service
- **Buckets** (globally unique names) hold **objects** (key → bytes, up to 5 TB); it's a
  key-value store, not a filesystem — "folders" are key prefixes.
- 11 nines durability; consistency is strong read-after-write.
- **Versioning** (recover overwrites/deletes), **lifecycle rules** (transition to IA/Glacier,
  expire), **server-side encryption** (SSE-S3/SSE-KMS, on by default now).
- Access via bucket policies + IAM; **Block Public Access** stays ON unless you're
  intentionally hosting a public site. Presigned URLs grant temporary object access.

### VPC — Virtual Private Cloud
```
VPC 10.0.0.0/16
├── Public subnet 10.0.1.0/24  (route 0.0.0.0/0 → Internet Gateway)
│     └── ALB, NAT Gateway, bastion
├── Private subnet 10.0.11.0/24 (route 0.0.0.0/0 → NAT Gateway)
│     └── app servers
└── Private subnet 10.0.21.0/24 (no internet route)
      └── databases
```
- **Subnet is public** ⇔ its route table points 0.0.0.0/0 at an **Internet Gateway**.
- **NAT Gateway** gives private subnets *outbound-only* internet (updates, APIs).
- Spread subnets across **Availability Zones** for HA. Security groups (instance level)
  + NACLs (subnet level) control traffic.

## Real-World Examples

**1. The leaked-key incident.** An access key committed to a public repo starts mining crypto
minutes later. Response: deactivate key, audit CloudTrail, rotate everything. Prevention:
IAM roles on compute (no keys to leak), secret scanning in CI, SCP guardrails.

**2. Classic 3-tier network.** ALB in public subnets (2 AZs) → app EC2/ASG in private subnets
→ RDS in isolated subnets. Only the ALB security group allows 443 from the internet; app SG
allows traffic *from the ALB SG*; DB SG *from the app SG*. SG-references, not CIDRs.

**3. S3 static site + lifecycle.** Marketing site served from S3 behind CloudFront; build
artifacts bucket has a lifecycle rule (30 days → IA, 90 days → delete) cutting storage spend 70%.

**4. "It can't reach the internet."** New instance times out on `yum update`. Checklist:
private subnet? route to NAT? SG egress open? NACL outbound? — the order you debug VPC issues.

## Step-by-Step Exercises

**Exercise 1 — IAM hygiene.** Create an admin group + user (console access, MFA), stash root
away. Write a least-privilege policy allowing read-only on a single bucket; test with the
policy simulator.

**Exercise 2 — EC2 web server.** Launch t3.micro (Amazon Linux 2023) with user data installing
nginx; SG allowing 22 from your IP and 80 from anywhere; verify in browser; terminate.

**Exercise 3 — S3 versioning.** Create a bucket, enable versioning, upload a file twice,
list versions (`aws s3api list-object-versions`), delete it, then restore by removing the
delete marker.

**Exercise 4 — Build a VPC by hand.** VPC 10.0.0.0/16, one public + one private subnet, IGW,
route tables, NAT gateway. Launch instances in both; prove the private one reaches out via
NAT but accepts nothing inbound. **Delete the NAT gateway after** — it bills hourly.
