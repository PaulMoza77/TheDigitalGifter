# Contabo Admin SSH Access · Mac mini → Edge Recovery

**Date:** 2026-10-15  
**Repo / PR:** `PaulMoza77/TheDigitalGifter` · #367  
**Target:** Contabo `62.171.191.209` (self-hosted Supabase for `supabase.thedigitalgifter.com`)  
**Scope:** Establish shell-capable SSH only. No DB/Stripe/DNS/checkout changes.

---

## Status: **FOUNDER ACTION REQUIRED** (console pubkey install)

Shell-capable Contabo access is **not** available to agents yet. A dedicated Ed25519 admin key was generated. Private key is **not** in Git, PR, or chat.

---

## 1. Inventory (authorized paths)

| Identity / path | Role | Shell on Contabo? |
| --- | --- | --- |
| Mozas → Contabo `tunnel-key` (`/opt/mozas/projects/thedigitalgifter-staging/tunnel-key`) | Port-forward only (`authorized_keys` options: `command` + `permitopen` + `port-forwarding`) | **No** |
| Mozas `/root/.ssh/casahub_deploy` | GitHub deploy | **No** (Permission denied) |
| Mozas `/root/.ssh/id_*`, `/home/mozas/.ssh/id_*` | Absent / not Contabo admin | **No** |
| Cloud agent env secrets | `MOZAS_SSH_*` only (no `CONTABO_SSH_*`) | n/a |
| Cloud agent host | Linux VM `cursor` — **not** the Mac mini | — |
| New admin key (this turn) | `tdg-contabo-admin@20261015@macmini` | Pending Contabo install |

### Tunnel (must not be treated as admin)

```text
systemd: tdg-staging-supabase-tunnel.service
ssh -NT … -L 127.0.0.1:19000:127.0.0.1:8000 -L 172.18.0.1:19001:127.0.0.1:8000 root@62.171.191.209
```

Debug proof: `Remote: …/authorized_keys:2: key options: command permitopen port-forwarding` → remote `hostname` exits **1**.

---

## 2. Dedicated admin key (public only)

| Field | Value |
| --- | --- |
| Type | Ed25519 (`-a 100`) |
| Comment | `tdg-contabo-admin@20261015@macmini` |
| Fingerprint | `SHA256:c9kH+S1xc7DiIfctDt3+6XTeDkvh9k1ZMv/CV07HDzc` |
| Public key | `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKa4NDrmaA8Hfsxidz5RK5M6VJDtyQAVITfxG4SuFIyc tdg-contabo-admin@20261015@macmini` |
| Agent path (ephemeral VM) | `~/.ssh/tdg_contabo_admin_ed25519` mode `600` — **not** in repo |
| Pre-install SSH test | `Permission denied (publickey,password)` (expected) |

**Never** commit, paste, or log the private key.

---

## 3. Founder-only: Contabo console install

Requires an **already authorized** Contabo control-panel / VNC / recovery console session (not the tunnel key). Do not bypass access controls.

On Contabo as root:

```bash
umask 077
mkdir -p /root/.ssh
chmod 700 /root/.ssh
# Append admin key (NO forced-command / NO permitopen on this line)
printf '%s\n' 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKa4NDrmaA8Hfsxidz5RK5M6VJDtyQAVITfxG4SuFIyc tdg-contabo-admin@20261015@macmini' >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

# Verify the new line is unrestricted and fingerprint matches
grep 'tdg-contabo-admin@20261015@macmini' /root/.ssh/authorized_keys
# Must NOT start with command="…" or restrict/port-forwarding options
```

Optional: keep the existing tunnel key line (with `command`/`permitopen`) unchanged so Mozas tunnel keeps working.

---

## 4. Mac mini: store private key + SSH alias

Private key must live on the Mac mini (and optionally Cursor secrets), **never** in Git.

### Prefer: copy agent-generated key to Mac mini (secure channel)

If you can retrieve `~/.ssh/tdg_contabo_admin_ed25519` from the cloud agent session securely (not chat/PR):

```bash
# On Mac mini
mkdir -p ~/.ssh
chmod 700 ~/.ssh
# place private key at:
#   ~/.ssh/tdg_contabo_admin_ed25519
# place public key at:
#   ~/.ssh/tdg_contabo_admin_ed25519.pub
chmod 600 ~/.ssh/tdg_contabo_admin_ed25519
chmod 644 ~/.ssh/tdg_contabo_admin_ed25519.pub
ssh-keygen -lf ~/.ssh/tdg_contabo_admin_ed25519.pub
# Expect: SHA256:c9kH+S1xc7DiIfctDt3+6XTeDkvh9k1ZMv/CV07HDzc
```

### Alternate: generate on Mac mini instead

If you prefer the private key never exists off-Mac:

```bash
ssh-keygen -t ed25519 -a 100 -f ~/.ssh/tdg_contabo_admin_ed25519 -C "tdg-contabo-admin@$(hostname -s)"
# Install the NEW .pub on Contabo (replace the key in §3)
ssh-keygen -lf ~/.ssh/tdg_contabo_admin_ed25519.pub
```

Then update Cursor secret / docs fingerprint accordingly.

### `~/.ssh/config` alias (Mac mini)

```sshconfig
Host tdg-contabo
  HostName 62.171.191.209
  User root
  IdentityFile ~/.ssh/tdg_contabo_admin_ed25519
  IdentitiesOnly yes
  ServerAliveInterval 30
  ServerAliveCountMax 3
```

Verify:

```bash
ssh tdg-contabo 'hostname; whoami; docker ps --format "{{.Names}}\t{{.Status}}" | head; df -h / | tail -1'
```

---

## 5. How authorized agents use Contabo admin SSH

After Mac mini shell verify succeeds:

1. Add Cursor secrets (do not paste into chat):
   - `CONTABO_SSH_PRIVATE_KEY` = contents of `~/.ssh/tdg_contabo_admin_ed25519`
   - optional `CONTABO_SSH_USER=root`
   - optional `CONTABO_SSH_HOST=62.171.191.209`
2. Agents write the secret to a temp key file mode `600`, then:

```bash
ssh -i "$CONTABO_KEYFILE" -o IdentitiesOnly=yes -o BatchMode=yes \
  "${CONTABO_SSH_USER:-root}@${CONTABO_SSH_HOST:-62.171.191.209}" 'docker ps'
```

3. **Never** use the Mozas `tunnel-key` for admin/shell work.

---

## 6. Post-access verification checklist (after founder install)

Run from Mac mini (`ssh tdg-contabo '…'`) before any Edge repair:

| Check | Command / expectation |
| --- | --- |
| Shell | `hostname` prints Contabo hostname |
| Docker | `docker ps` lists Kong / edge-runtime / db / storage / auth |
| Disk | `df -h /` shows adequate free space |
| Permissions | `/root/.ssh` `700`, `authorized_keys` `600` |
| Edge mounts | Locate compose root; `find …/functions -maxdepth 2 -type f` for `stripe-webhook` vs `christmas-checkout` |
| Tunnel intact | Mozas `tdg-staging-supabase-tunnel.service` still **active** |

---

## 7. Edge entrypoint diagnosis & controlled repair plan (no prod change yet)

### Diagnosis (read-only once shell works)

```bash
# Locate stack
cd /home/supabase/docker 2>/dev/null || cd /opt/supabase/docker 2>/dev/null || \
  find / -name 'docker-compose.yml' 2>/dev/null | xargs grep -l edge-runtime | head

docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}'
# Compare working vs broken slug trees
for s in stripe-webhook christmas-funnel christmas-checkout christmas-photo-funnel christmas-photo-generate; do
  echo "== $s =="
  find . -path "*functions/$s*" -type f 2>/dev/null | head -20
done
```

Expected: broken slugs missing `index.ts` / nested wrong path; working slugs have entrypoint files.

### Controlled repair (only after backup; still approval-gated)

1. `STAMP=$(date -u +%Y%m%dT%H%M%SZ)`; tarball functions volume + compose `.env`.  
2. Restore/redeploy missing entrypoints for Christmas commerce slugs only.  
3. Restart **edge-runtime** service only (not Postgres).  
4. Probe non-payment: expect app JSON, not `InvalidWorkerCreation`.  
5. Inject confirmed self-host `STRIPE_WEBHOOK_SECRET` into Contabo Edge env (not printed).  
6. Do **not** disable Cloud Stripe webhook / enable checkout / apply PR #367 SQL until probes pass + explicit approval.

Rollback: restore functions volume tarball + prior `.env`; restart edge-runtime.

---

## 8. Explicit non-goals (this access mission)

- No production DB migration  
- No Stripe webhook disable/create  
- No DNS changes  
- No `CHRISTMAS_CHECKOUT_ENABLED=true`  
- No Cloud Pro upgrade  

---

## Founder action (single blocker)

**Use Contabo console to append the public key in §2 to `/root/.ssh/authorized_keys` without forced-command options**, then verify `ssh tdg-contabo` from the Mac mini and add `CONTABO_SSH_PRIVATE_KEY` to Cursor secrets. Reply here when shell works so Edge diagnosis can proceed.
