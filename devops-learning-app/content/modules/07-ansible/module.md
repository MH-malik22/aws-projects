# Ansible

## Overview

Ansible configures servers and orchestrates operations over plain SSH — no agents to install.
You declare desired state in YAML playbooks; Ansible's modules make each host converge to it,
idempotently. Where Terraform *provisions* infrastructure, Ansible *configures* what runs on it.

**Prerequisites:** Linux, YAML, SSH. **Estimated time:** 6 hours.

## Key Concepts

### How it works
Control node (your laptop/CI) → SSH → managed nodes. Modules are small programs pushed and
executed per task; only Python is needed on targets.

### Inventory
```ini
[web]
web1.example.com
web2.example.com ansible_host=10.0.1.12

[db]
db1.example.com

[prod:children]
web
db

[web:vars]
nginx_worker_processes=4
```
Static INI/YAML files, or **dynamic inventory** plugins (AWS EC2 tags → groups).

### Playbook anatomy
```yaml
- name: Configure web servers
  hosts: web
  become: true                    # sudo
  vars:
    app_port: 8000
  tasks:
    - name: Install nginx
      ansible.builtin.apt:
        name: nginx
        state: present            # idempotent: present, not "install"
        update_cache: true

    - name: Deploy site config
      ansible.builtin.template:
        src: site.conf.j2         # Jinja2: {{ app_port }} substituted
        dest: /etc/nginx/conf.d/site.conf
      notify: reload nginx        # only fires if this task CHANGED

    - name: Ensure nginx running on boot
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true

  handlers:
    - name: reload nginx
      ansible.builtin.service: { name: nginx, state: reloaded }
```

### Idempotency — the core contract
Modules test current state before acting: `state: present` installs only if missing.
Re-running a good playbook reports `changed=0`. Prefer modules over `shell:`; when shell is
unavoidable, guard it with `creates:`/`when:` so it stays idempotent.

### Variables & facts
Precedence (low→high, simplified): role defaults → group_vars → host_vars → play vars →
extra vars (`-e`, always wins). **Facts** (`ansible_facts`) are auto-gathered host data
(OS, IPs, memory) usable in conditionals: `when: ansible_facts.os_family == "Debian"`.

### Roles & collections
```
roles/nginx/
├── defaults/main.yml   # overridable defaults
├── tasks/main.yml
├── handlers/main.yml
├── templates/site.conf.j2
└── meta/main.yml
```
Roles are the reusable unit; Galaxy/collections distribute them
(`ansible-galaxy collection install community.general`).

### Ansible Vault
```bash
ansible-vault encrypt group_vars/prod/secrets.yml
ansible-playbook site.yml --ask-vault-pass   # or --vault-password-file
```
Secrets encrypted at rest in Git, decrypted at run time.

## Real-World Examples

**1. Fleet patching.** `ansible-playbook patch.yml --limit 'web:!web7'` upgrades packages
serially (`serial: 2`) with a health check between batches — a rolling OS patch across 40
servers in one command, minus the flaky host you excluded.

**2. Onboarding a server in minutes.** New EC2 instance → dynamic inventory picks it up by
tag → `site.yml` applies the `base` role (users, ssh hardening, node_exporter) + app role.
Server #41 is identical to #1..40 by construction.

**3. Config drift repair.** Someone hand-tuned nginx on web3. Next scheduled playbook run
reverts it (template re-applied, handler reloads). Check mode first:
`ansible-playbook site.yml --check --diff` shows what would change.

**4. Secrets done right.** DB passwords live in `group_vars/prod/vault.yml` (encrypted);
CI holds the vault password. Git history contains only ciphertext.

## Step-by-Step Exercises

**Exercise 1 — Ping the fleet.** Write an inventory with localhost
(`ansible_connection=local`), run `ansible all -i inventory -m ping`, then
`-m setup` and skim the facts.

**Exercise 2 — First playbook.** Playbook that creates `/opt/app`, writes a templated
`app.conf` from a Jinja2 template with a variable, and installs a package. Run twice; second
run must be `changed=0`.

**Exercise 3 — Handler discipline.** Add a `notify` → handler pair. Prove the handler runs
only when the template task changes (edit the template, rerun).

**Exercise 4 — Vault.** Encrypt a vars file containing `api_key`, reference it in the
playbook, run with `--ask-vault-pass`, confirm the plaintext never appears in Git.
