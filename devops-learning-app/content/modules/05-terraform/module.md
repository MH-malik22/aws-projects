# Terraform (Infrastructure as Code)

## Overview

Terraform lets you declare infrastructure (servers, networks, DNS, SaaS config) in code,
preview changes before applying them, and keep environments reproducible. It's
cloud-agnostic via providers and is the de-facto IaC standard.

**You will learn:** HCL syntax, the plan/apply workflow, state (the crucial concept),
variables/outputs, modules, and team-safe remote state.

**Prerequisites:** Linux, Git, basic AWS concepts help. **Estimated time:** 8 hours.

## Key Concepts

### The core loop
```bash
terraform init      # download providers, configure backend
terraform fmt       # canonical formatting
terraform validate  # syntax/type check
terraform plan      # diff: desired (code) vs actual (state ⇄ real world)
terraform apply     # execute the plan
terraform destroy   # tear everything down
```

### HCL by example
```hcl
terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  backend "s3" {                     # remote state (team-safe)
    bucket         = "acme-tfstate"
    key            = "prod/network.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "tf-locks"      # state locking
    encrypt        = true
  }
}

provider "aws" { region = var.region }

variable "region"       { type = string, default = "eu-west-1" }
variable "instance_type"{ type = string, default = "t3.micro" }

resource "aws_instance" "web" {
  ami           = data.aws_ami.al2023.id
  instance_type = var.instance_type
  tags = { Name = "web-${terraform.workspace}" }
}

data "aws_ami" "al2023" {            # data source: read, don't create
  most_recent = true
  owners      = ["amazon"]
  filter { name = "name", values = ["al2023-ami-*-x86_64"] }
}

output "public_ip" { value = aws_instance.web.public_ip }
```

### State — the concept people fail interviews on
- `terraform.tfstate` maps resource addresses in code → real resource IDs.
- Plan = three-way diff between **code**, **state**, and (via refresh) **reality**.
- State contains secrets → treat as sensitive, encrypt, never commit to Git.
- **Remote backend + locking** (S3+DynamoDB, Terraform Cloud) prevents two engineers
  corrupting state with concurrent applies.
- Drift: someone clicks in the console → next plan shows the delta. Import existing
  resources with `terraform import` (or `import {}` blocks).

### Modules
```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.8.1"
  name    = "prod"
  cidr    = "10.0.0.0/16"
}
```
Modules are reusable packages of resources — your org's paved road ("our standard VPC",
"our standard service"). Root module per environment, pinned versions.

### Meta-arguments worth knowing
`count` / `for_each` (multiple instances), `depends_on` (explicit ordering),
`lifecycle { prevent_destroy = true }` (protect databases), `create_before_destroy`
(zero-downtime replacement).

## Real-World Examples

**1. Reviewable infrastructure.** Change `instance_type` in a PR; CI posts `terraform plan`
output as a comment. Reviewer sees exactly "1 to change, 0 to destroy" before merge —
infrastructure change management with the same rigor as code.

**2. The Friday-afternoon save.** Plan says `-/+ destroy and then create replacement` on the
production database because someone renamed a resource. `terraform state mv old_addr new_addr`
retargets state; the next plan is a no-op. Nothing was destroyed.

**3. Environment parity.** dev/staging/prod are the same module called with different
tfvars (`instance_type = "t3.micro"` vs `"m6i.large"`). "Staging is different from prod" bugs
largely disappear.

**4. Drift detection.** Nightly `terraform plan -detailed-exitcode` job: exit 2 = drift →
alert. Finds the security-group rule someone hand-edited during an incident.

## Step-by-Step Exercises

**Exercise 1 — Zero-cost first apply.** Use the `local` provider: a `local_file` resource
writing `hello.txt`. init → plan → apply → verify file → change content → plan (see the diff)
→ apply → destroy.

**Exercise 2 — Variables & outputs.** Parameterize the filename and content via variables
(with defaults + a `terraform.tfvars`), output the file's path, run
`terraform output -json`.

**Exercise 3 — Break state on purpose.** Delete `hello.txt` manually, run plan — watch
Terraform propose recreating it (drift repair). Then `terraform state list` and
`terraform state show local_file.hello`.

**Exercise 4 — Module extraction.** Move the file resource into `modules/greeting`, call it
twice with different names from the root module. Note how outputs must be re-exported.
