# Monitoring (Prometheus + Grafana)

## Overview

You can't operate what you can't observe. Prometheus is the de-facto metrics system of the
cloud-native world (pull-based scraping, powerful PromQL, alerting); Grafana turns those
metrics into dashboards humans can reason with. Together they answer: *is it healthy, is it
fast, and who should wake up?*

**Prerequisites:** Linux, Docker; Kubernetes helpful. **Estimated time:** 7 hours.

## Key Concepts

### Architecture
```
apps (/metrics) ◀──scrape──┐
node_exporter   ◀──scrape──┤  Prometheus ──rules──▶ Alertmanager ──▶ Slack / PagerDuty
kube-state-metrics ◀───────┘      ▲
                                  │ PromQL
                               Grafana (dashboards)
```
- **Pull model:** Prometheus scrapes HTTP `/metrics` endpoints on an interval (default 15s).
- **Exporters** translate third-party systems into metrics: node_exporter (host),
  postgres_exporter, blackbox_exporter (probing), kube-state-metrics.
- **Service discovery** (Kubernetes, EC2, DNS) finds targets automatically.

### Metric types
| Type | Meaning | Example |
|---|---|---|
| Counter | Only goes up (rate it!) | `http_requests_total` |
| Gauge | Goes up and down | `memory_usage_bytes`, queue depth |
| Histogram | Buckets of observations | `http_request_duration_seconds_bucket` |
| Summary | Client-side quantiles | (prefer histograms) |

Labels (`method="GET", status="500"`) make metrics multi-dimensional — and each unique label
combination is a new time series. **Never label by unbounded values** (user ID, URL path with
IDs) or you get a cardinality explosion.

### PromQL you'll actually use
```promql
rate(http_requests_total[5m])                                   # req/s
sum(rate(http_requests_total{status=~"5.."}[5m]))
  / sum(rate(http_requests_total[5m]))                          # error ratio
histogram_quantile(0.99,
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le))  # p99 latency
node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.10 # disk <10%
up == 0                                                         # target down
```
Rule of thumb: counters are meaningless raw — always `rate()` them.

### Alerting
```yaml
groups:
  - name: api
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
            / sum(rate(http_requests_total[5m])) > 0.05
        for: 10m                       # must persist — no page on a blip
        labels: { severity: page }
        annotations:
          summary: "API 5xx ratio above 5% for 10m"
          runbook_url: "https://wiki/runbooks/api-errors"
```
**Alertmanager** dedupes, groups, routes (severity → PagerDuty vs Slack), silences, and
inhibits (suppress downstream alerts when the upstream cause fires).

Philosophy: **alert on symptoms** (user-facing error rate, latency) not causes (CPU%);
every page must be actionable and carry a runbook.

### Golden signals & SLOs
Latency, traffic, errors, saturation — the four golden signals. SLO example: "99.9% of
requests succeed in <300ms over 30 days"; the **error budget** (0.1%) sets how fast alerts
must fire (burn-rate alerts).

### Grafana
Datasources (Prometheus, Loki, CloudWatch) → dashboards as code (JSON, provisioned via
Git/Helm) → variables (`$namespace`, `$instance`) make one dashboard serve every service.
Standard layout: top row SLO/golden signals, then resource detail, then dependencies.

## Real-World Examples

**1. The 3 a.m. page that worked.** `HighErrorRate` fires; the runbook link points to the
dashboard; error breakdown by `status` shows 500s only on `/checkout`; deploy marker at 02:40
matches. `helm rollback` → error budget saved, incident: 12 minutes.

**2. Disk-full, predicted.** `predict_linear(node_filesystem_avail_bytes[6h], 24*3600) < 0`
warns that a database volume will fill within 24h — a calm daytime ticket instead of a
weekend outage.

**3. Cardinality explosion.** A dev adds `user_id` as a metric label; Prometheus memory
triples and scrapes slow. Fix: drop the label (that's what logs/traces are for),
add a CI check on series growth.

**4. Dashboards as code.** Grafana dashboards live in Git and deploy via the Helm chart's
sidecar. A new service inherits the golden-signals dashboard automatically from its
ServiceMonitor labels.

## Step-by-Step Exercises

**Exercise 1 — Local stack.** docker compose with prometheus + node_exporter + grafana.
Browse `localhost:9090/targets`, query `up`, add Prometheus as a Grafana datasource.

**Exercise 2 — PromQL drills.** On the node_exporter data: CPU usage per mode
(`rate(node_cpu_seconds_total[5m])`), memory available %, disk usage %, and network
throughput. Save each as a Grafana panel.

**Exercise 3 — First alert.** Write a rule: `up == 0 for: 1m` → severity: page. Kill
node_exporter, watch pending → firing in `/alerts`, wire Alertmanager to a test webhook.

**Exercise 4 — Instrument an app.** Add a Prometheus client library to a small HTTP app:
request counter + duration histogram. Scrape it, build p95 latency and error-rate panels —
you've built the golden signals from scratch.
