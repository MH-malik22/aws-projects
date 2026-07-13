# Kubernetes

## Overview

Kubernetes (K8s) orchestrates containers across a fleet of machines: scheduling, self-healing,
scaling, rollout, service discovery, and configuration. You describe desired state in YAML;
controllers relentlessly reconcile reality toward it.

**Prerequisites:** Docker (hard requirement), Linux, YAML. **Estimated time:** 12 hours.

## Key Concepts

### Architecture
- **Control plane:** API server (front door), etcd (state store), scheduler (places pods),
  controller-manager (reconciliation loops).
- **Nodes:** kubelet (runs pods), container runtime (containerd), kube-proxy (service routing).
- Everything is an **object** with `spec` (desired) and `status` (observed); controllers close the gap.

### The workload ladder
```
Pod  ⟵ smallest unit: 1+ containers sharing network/storage; mortal
ReplicaSet ⟵ keeps N identical pods alive
Deployment ⟵ manages ReplicaSets: rolling updates, rollback, scaling   ← you write THIS
StatefulSet / DaemonSet / Job / CronJob ⟵ stateful apps / per-node agents / batch
```

### A production-shaped Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: api, labels: { app: api } }
spec:
  replicas: 3
  selector: { matchLabels: { app: api } }
  template:
    metadata: { labels: { app: api } }
    spec:
      containers:
        - name: api
          image: registry.example.com/api:1.4.2   # never :latest
          ports: [{ containerPort: 8000 }]
          envFrom:
            - configMapRef: { name: api-config }
            - secretRef:    { name: api-secrets }
          resources:
            requests: { cpu: 100m, memory: 128Mi }  # scheduling guarantee
            limits:   { cpu: 500m, memory: 256Mi }  # hard ceiling
          readinessProbe: { httpGet: { path: /readyz,  port: 8000 } }
          livenessProbe:  { httpGet: { path: /healthz, port: 8000 } }
---
apiVersion: v1
kind: Service
metadata: { name: api }
spec:
  selector: { app: api }          # label selector = service membership
  ports: [{ port: 80, targetPort: 8000 }]
```

### Services & Ingress
| Type | Reach | Use |
|---|---|---|
| ClusterIP (default) | inside cluster | service-to-service |
| NodePort | node IP : 30000-32767 | dev/debug |
| LoadBalancer | cloud LB | expose one service |
| **Ingress** | HTTP router in front of many services | real-world north-south traffic |

DNS: `api.checkout.svc.cluster.local` — any pod can call `http://api` in its own namespace.

### Config, secrets, storage
- **ConfigMap** = non-secret config; **Secret** = base64-encoded (encrypt etcd, use external
  managers for real secrets). Mounted as env vars or files.
- **PVC/PV + StorageClass** = persistent volumes that outlive pods (databases, uploads).

### Health & scaling
- **readiness** gates traffic; **liveness** restarts stuck containers; **startup** protects slow boots.
- **HPA** scales replicas on CPU/memory/custom metrics.
- Rollouts: `maxSurge`/`maxUnavailable`; `kubectl rollout undo deploy/api` is your instant rollback.

### kubectl survival kit
```bash
kubectl get pods -o wide                     # what's running, where
kubectl describe pod api-6d4cf56db9-x2m8p    # events = why it's broken
kubectl logs -f deploy/api                   # logs (previous crash: --previous)
kubectl exec -it deploy/api -- sh            # shell in
kubectl apply -f k8s/                        # declarative apply
kubectl rollout status deploy/api            # watch a rollout
kubectl scale deploy/api --replicas=5
kubectl get events --sort-by=.lastTimestamp  # cluster-level whodunit
```

## Real-World Examples

**1. CrashLoopBackOff at 2 a.m.** `kubectl describe pod` shows restarts; `kubectl logs
--previous` reveals a bad DB password after a secret rotation. Fix the Secret, restart the
rollout. Lesson: describe → events, logs --previous → last words.

**2. OOMKilled.** Java service dies with exit 137 under load: JVM heap exceeds the 256Mi
limit. Set `-Xmx` in line with limits (or raise limits); add HPA so load spreads across replicas.

**3. Zero-downtime deploy that wasn't.** Users see 502s during rollout. Cause: no readiness
probe, so traffic hit pods before the app booted. Add readiness + `maxUnavailable: 0`; the
next rollout is invisible.

**4. Service selector typo.** `kubectl get endpoints api` shows `<none>` — the Service
selector says `app: apy`. Endpoints-empty is *the* diagnostic for selector/label mismatches.

## Step-by-Step Exercises

**Exercise 1 — Cluster up.** Install minikube or kind; `kubectl get nodes`, explore
`kubectl api-resources | head -20`.

**Exercise 2 — Pod → Deployment.** Run a bare nginx pod, delete it (gone forever). Create a
3-replica Deployment, delete a pod, watch the ReplicaSet resurrect it.

**Exercise 3 — Wire a Service.** Expose the Deployment as ClusterIP; from a debug pod
(`kubectl run tmp --rm -it --image=busybox -- sh`) wget it by service name.

**Exercise 4 — Config & probes.** Add a ConfigMap env var and readiness/liveness probes;
break the probe path on purpose and observe the pod never receiving traffic.

**Exercise 5 — Rollout & rollback.** Update the image tag, `kubectl rollout status`, then
deploy a nonexistent tag, watch it stall (old pods keep serving!), and `rollout undo`.
