# Linux Fundamentals

## Overview

Linux runs ~96% of the world's top web servers, every Docker container, and every Kubernetes node.
Every other module in this curriculum assumes you can move around a Linux system confidently.

**You will learn to:** navigate the filesystem, manage files and permissions, control processes
and services, inspect networking, read logs, and automate with shell scripts.

**Prerequisites:** none. **Estimated time:** 8 hours.

## Key Concepts

### The filesystem hierarchy
| Path | Purpose |
|---|---|
| `/etc` | System configuration (nginx, ssh, cron) |
| `/var/log` | Logs — your first stop when debugging |
| `/home` | User home directories |
| `/usr/bin`, `/usr/local/bin` | Executables |
| `/proc`, `/sys` | Kernel & process info (virtual) |
| `/tmp` | World-writable scratch space, cleared on reboot |

### Essential commands
```bash
pwd; ls -la; cd /var/log            # navigate
cat file; less file; tail -f app.log # read (tail -f = follow live)
cp src dst; mv old new; rm -r dir    # manipulate
find /etc -name "*.conf"             # locate files
grep -rn "ERROR" /var/log/app/       # search content
du -sh *; df -h                      # disk usage / free space
```

### Permissions
`rwxr-xr-- 1 deploy www-data app.sh` → owner `deploy` can read/write/execute,
group `www-data` can read/execute, others read only.

```bash
chmod 754 app.sh        # rwx r-x r--  (octal: r=4, w=2, x=1)
chmod u+x deploy.sh     # symbolic: add execute for user
chown deploy:www-data app.sh
sudo -u postgres psql   # run as another user
```

### Processes & services
```bash
ps aux | grep nginx     # list processes
top / htop              # live view
kill -15 1234           # graceful terminate (SIGTERM)
kill -9 1234            # force kill (SIGKILL — last resort)
systemctl status nginx  # systemd service state
systemctl restart nginx && journalctl -u nginx -f
```

### Networking
```bash
ss -tulpn               # listening ports (replaces netstat)
curl -I https://api.example.com   # HTTP headers
dig example.com         # DNS lookup
ip addr; ip route       # interfaces & routes
```

### Pipes, redirection, and the shell
```bash
command > out.log 2>&1        # stdout+stderr to file
history | grep ssh            # pipe output into another command
cut -d: -f1 /etc/passwd | sort | uniq -c
export DB_HOST=10.0.0.5       # environment variable
```

## Real-World Examples

**1. Disk full on a production server.** Alerts fire: `df -h` shows `/var` at 100%.
`du -sh /var/* | sort -h` points to `/var/log`. `ls -laS /var/log` reveals a 40 GB app log —
the app has no log rotation. Fix now: truncate with `> app.log`; fix forever: add a
`logrotate` config in `/etc/logrotate.d/app`.

**2. "The service is down."** `systemctl status api` → `failed`. `journalctl -u api -n 50`
shows `EADDRINUSE: port 8080`. `ss -tulpn | grep 8080` finds an orphaned process; `kill -15`
it, `systemctl start api`, verify with `curl -I localhost:8080/healthz`.

**3. Deploy user can't write releases.** `ls -la /opt/app/releases` shows `root:root`.
`sudo chown -R deploy:deploy /opt/app/releases` — and note that a CI pipeline should have
created the directory with the right owner in the first place.

## Step-by-Step Exercises

**Exercise 1 — Log triage.** Create `~/practice/app.log` with 100 lines
(`for i in $(seq 1 100); do echo "line $i $( ((i % 7)) || echo ERROR)"; done > ~/practice/app.log`).
Use `grep -c ERROR` to count errors, `grep -n ERROR | head -3` to find the first three,
and `tail -20` to see the end of the file.

**Exercise 2 — Permissions drill.** Create `secret.txt`, set it to owner-read-only (`chmod 400`),
verify with `ls -l`, try reading it as another user with `sudo -u nobody cat secret.txt` and
observe the denial.

**Exercise 3 — Process hunt.** Start `sleep 600 &`, find its PID with `ps aux | grep sleep`
(or `pgrep sleep`), inspect `/proc/<pid>/status`, then terminate it gracefully.

**Exercise 4 — Mini deploy script.** Write `deploy.sh` that: creates `/tmp/releases/$(date +%s)`,
copies the current directory's `*.txt` files into it, and prints the release path. Make it
executable and run it. Add `set -euo pipefail` at the top and explain what each flag does.
