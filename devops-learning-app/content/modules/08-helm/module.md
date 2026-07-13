# Helm

## Overview

Helm is the package manager for Kubernetes. It bundles the pile of YAML a real app needs
(Deployment, Service, Ingress, ConfigMap, HPA…) into a **chart**, parameterized by **values**,
installed as a versioned **release** you can upgrade and roll back. It's how you install
third-party software (Prometheus, ingress-nginx, Postgres) and how many teams ship their own
services per environment.

**Prerequisites:** Kubernetes module. **Estimated time:** 5 hours.

## Key Concepts

### The three nouns
| Term | Meaning |
|---|---|
| **Chart** | The package: templates + default values + metadata |
| **Values** | The configuration injected into templates (`values.yaml`, `-f`, `--set`) |
| **Release** | A named, versioned installation of a chart in a cluster/namespace |

### Chart layout
```
mychart/
├── Chart.yaml          # name, version (chart), appVersion (app)
├── values.yaml         # defaults — the chart's public API
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── _helpers.tpl    # named template partials
│   └── NOTES.txt       # post-install usage hints
└── charts/             # dependencies (subcharts)
```

### Templating
```yaml
# templates/deployment.yaml (excerpt)
spec:
  replicas: {{ .Values.replicaCount }}
  template:
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          {{- if .Values.resources }}
          resources: {{- toYaml .Values.resources | nindent 12 }}
          {{- end }}
```
Built-ins: `.Values`, `.Release.Name`, `.Chart.*`. Functions/pipelines (`default`, `quote`,
`toYaml`, `nindent`) come from Go templates + Sprig.

### Daily commands
```bash
helm repo add bitnami https://charts.bitnami.com/bitnami && helm repo update
helm search repo postgresql
helm install mydb bitnami/postgresql -n data --create-namespace \
  -f prod-values.yaml --set auth.database=app
helm list -A                        # all releases
helm upgrade --install api ./chart -f values-prod.yaml   # idempotent deploy (CI staple)
helm rollback api 4                 # back to revision 4
helm uninstall mydb -n data
helm template ./chart -f v.yaml     # render locally, no cluster
helm diff upgrade api ./chart       # (plugin) what would change
```

### Values layering
`values.yaml` (chart defaults) ← `-f env-values.yaml` (environment file) ← `--set key=val`
(highest). Typical setup: one chart, `values-dev.yaml` / `values-prod.yaml` per environment.

### Upgrades, history, rollback
Every upgrade creates a new **revision**; `helm history api` lists them,
`helm rollback api <rev>` restores one. `--atomic` auto-rolls-back a failed upgrade —
use it in CI.

## Real-World Examples

**1. Installing the monitoring stack.** `helm install monitoring
prometheus-community/kube-prometheus-stack -n monitoring --create-namespace -f values.yaml`
brings up Prometheus, Grafana, Alertmanager, exporters and dashboards — hundreds of objects,
one command, one values file in Git.

**2. One chart, three environments.** The api chart deploys with `values-dev.yaml`
(1 replica, no HPA) and `values-prod.yaml` (5 replicas, HPA, TLS ingress). Environment drift
becomes a reviewable values diff.

**3. Friday deploy gone wrong.** `helm upgrade` ships a bad config; pods crash-loop.
`helm rollback api 12` restores the previous revision in seconds — no digging for old
manifests. With `--atomic` the rollback would have been automatic.

**4. Config change that actually restarts pods.** Ops changes a ConfigMap value; nothing
happens (pods cache env). The chart adds
`checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}`
as a pod annotation — now any config change alters the pod template and triggers a rolling
restart.

## Step-by-Step Exercises

**Exercise 1 — Consume a chart.** Add the bitnami repo, `helm search repo nginx`, install
with a custom `--set`, `helm list`, inspect created objects with kubectl, uninstall.

**Exercise 2 — Author a chart.** `helm create webapp`, read every generated file, set your
image in values.yaml, `helm template` to inspect rendered YAML, install, hit the service.

**Exercise 3 — Values layering.** Create `values-dev.yaml` (replicas 1) and
`values-prod.yaml` (replicas 3); install twice into different namespaces; verify with
`kubectl get deploy -A`.

**Exercise 4 — Upgrade & rollback.** Bump the image tag, `helm upgrade`, check
`helm history`, then roll back and confirm the old tag is live again.
