#!/usr/bin/env python3
"""Consolidate all project memory.db files (local + servy) into the central
memory.db and the Obsidian vault. Idempotent: upserts by name, merges
observations, dedups entities.

Usage:
  python3 scripts/consolidate-memory.py [--vault PATH] [--central PATH] [--include-servy]
"""
import argparse, json, os, sqlite3, subprocess, sys
from pathlib import Path

DEFAULT_CENTRAL = os.path.expanduser("~/memory/memory.db")
DEFAULT_VAULT = "/home/azzar/Documents/obsidian/vaults/Vault"

import re as _re
def safe(s):
    s = (s or "")
    # Obsidian-forbidden filename characters: \ / : * ? " < > |
    s = _re.sub(r'[\\\\/:*?"<>|]', '_', s)
    # trim leading/trailing spaces and dots (also problematic on some OS)
    s = s.strip(' .')
    if not s:
        s = 'entity'
    return s[:120]

def read_db(dbpath):
    ents, rels = [], []
    try:
        con = sqlite3.connect(f"file:{dbpath}?mode=ro", uri=True)
        con.row_factory = sqlite3.Row
        try:
            for r in con.execute("SELECT name, entity_type, observations, created_at, updated_at FROM entities"):
                try:
                    obs = json.loads(r["observations"]) if r["observations"] else []
                except Exception:
                    obs = [r["observations"]] if r["observations"] else []
                ents.append({"name": r["name"], "type": r["entity_type"], "obs": obs,
                             "created": r["created_at"], "updated": r["updated_at"]})
        except sqlite3.Error:
            pass
        try:
            for r in con.execute("SELECT from_entity, to_entity, relation_type, created_at FROM relations"):
                rels.append({"from": r["from_entity"], "to": r["to_entity"],
                             "type": r["relation_type"], "created": r["created_at"]})
        except sqlite3.Error:
            pass
        con.close()
    except Exception as e:
        print(f"  skip {dbpath}: {e}", file=sys.stderr)
    return ents, rels

def ensure_central_schema(con):
    con.execute("""CREATE TABLE IF NOT EXISTS entities (
        name TEXT PRIMARY KEY, entity_type TEXT, observations TEXT,
        created_at TEXT, updated_at TEXT)""")
    con.execute("""CREATE TABLE IF NOT EXISTS relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT, from_entity TEXT, to_entity TEXT,
        relation_type TEXT, created_at TEXT,
        UNIQUE(from_entity, to_entity, relation_type))""")
    con.commit()

def upsert_central(con, ents, rels):
    for e in ents:
        cur = con.execute("SELECT observations, created_at FROM entities WHERE name=?", (e["name"],)).fetchone()
        if cur:
            try:
                old = json.loads(cur[0]) if cur[0] else []
            except Exception:
                old = [cur[0]] if cur[0] else []
            merged = list(dict.fromkeys(old + e["obs"]))
            con.execute("UPDATE entities SET entity_type=?, observations=?, updated_at=? WHERE name=?",
                        (e["type"], json.dumps(merged), e["updated"], e["name"]))
        else:
            con.execute("INSERT INTO entities (name, entity_type, observations, created_at, updated_at) VALUES (?,?,?,?,?)",
                        (e["name"], e["type"], json.dumps(e["obs"]), e["created"], e["updated"]))
    for r in rels:
        try:
            con.execute("INSERT OR IGNORE INTO relations (from_entity, to_entity, relation_type, created_at) VALUES (?,?,?,?)",
                        (r["from"], r["to"], r["type"], r["created"]))
        except sqlite3.Error:
            pass
    con.commit()

def write_note(vault, e, rels_for_e):
    path = os.path.join(vault, safe(e["name"]) + ".md")
    outgoing = [r for r in rels_for_e if r["from"] == e["name"]]
    incoming = [r for r in rels_for_e if r["to"] == e["name"]]
    lines = ["---",
             f'name: {json.dumps(e["name"])}',
             f'type: {json.dumps(e["type"])}',
             f'created: {e["created"]}',
             f'updated: {e["updated"]}',
             'source: hela-genome',
             '---', '', f'# {e["name"]}', '', f'**Type:** {e["type"]}', '',
             '## Observations', '']
    if e["obs"]:
        lines += [f'- {o}' for o in e["obs"]]
    else:
        lines += ['_(none)_']
    lines += ['', '## Relations', '']
    for r in outgoing:
        lines.append(f'- [[{r["to"]}]] — {r["type"]}')
    for r in incoming:
        lines.append(f'- [[{r["from"]}]] — {r["type"]} (incoming)')
    if not (outgoing or incoming):
        lines.append('_(none)_')
    lines.append('')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--vault', default=DEFAULT_VAULT)
    ap.add_argument('--central', default=DEFAULT_CENTRAL)
    ap.add_argument('--include-servy', action='store_true')
    ap.add_argument('--servy-host', default='servy')
    ap.add_argument('--roots', default=None,
                    help='Comma-separated roots to scan for memory.db (default: auto)')
    ap.add_argument('--clean-vault', action='store_true', default=True,
                    help='Wipe existing .md notes before regenerating (default: true)')
    args = ap.parse_args()

    os.makedirs(args.vault, exist_ok=True)
    os.makedirs(os.path.dirname(args.central), exist_ok=True)

    # Collect db paths
    dbpaths = []
    if args.roots:
        roots = [r.strip() for r in args.roots.split(',') if r.strip()]
    else:
        roots = []
        for cand in ['/home/azzar/project', '/home/ubuntu/projects', '/home/ubuntu']:
            if os.path.isdir(cand):
                roots.append(cand)
    # Use find with maxdepth for speed (os.walk is too slow on large trees)
    for root in roots:
        try:
            out = subprocess.check_output(['find', root, '-maxdepth', '8', '-name', 'memory.db', '-type', 'f'],
                                         stderr=subprocess.DEVNULL, text=True)
            for line in out.splitlines():
                line = line.strip()
                if line:
                    dbpaths.append(line)
        except Exception:
            for dp, _, files in os.walk(root):
                if 'memory.db' in files:
                    dbpaths.append(os.path.join(dp, 'memory.db'))
    # servy
    if args.include_servy:
        print('Fetching servy db list...')
        r = subprocess.run(['ssh', args.servy_host, 'find /home/ubuntu -maxdepth 6 -name memory.db 2>/dev/null'], capture_output=True, text=True)
        out = r.stdout
        remote_dbs = [l.strip() for l in out.splitlines() if l.strip()]
        local_servy_dir = '/tmp/scratchpad/servy-dbs'
        os.makedirs(local_servy_dir, exist_ok=True)
        for rd in remote_dbs:
            # scp
            local = os.path.join(local_servy_dir, rd.replace('/', '_'))
            try:
                subprocess.run(['scp', f'{args.servy_host}:{rd}', local], check=True, capture_output=True)
                dbpaths.append(local)
            except Exception as e:
                print(f'  scp fail {rd}: {e}', file=sys.stderr)

    print(f'Found {len(dbpaths)} memory.db files')

    # Skip manual persona reference notes (live in personas/ subfolder)
    SKIP_PREFIXES = ('Persona:',)

    # Trash filter (test/junk entities to exclude)
    TRASH_NAMES = {
        'A','B','BackfillTest','HumanNote','ManualNote','ManualRebuild',
        'RemoteSyncTest','RemoteObsidianTest','TestEntity','Test_Write_Check',
        'UniqueVaultTest99','debug:a','debug:b','debug:c','debug:d','debug:e',
        'file:tests/test_vault.py','E2E MCP Test - Azzar Brews',
    }
    import re as _re2
    def is_trash(name):
        n = (name or '').strip().lower()
        if n in {t.lower() for t in TRASH_NAMES}: return True
        if n.startswith('debug:') or n.startswith('test_') or n.startswith('test-'): return True
        if 'test' in n and ('entity' in n or 'write' in n or 'vault' in n): return True
        if n.startswith('perf_run_') or n.startswith('perf-run-') or n.startswith('perf run'): return True
        if n.startswith('perf_warm_') or n.startswith('perf-warm-'): return True
        # auto-generated junk: e.g. c_0_wfgwd, bo_23_4_8yoe2, bn_-1_2_gtzzx
        if _re2.match(r'^[a-z]{1,3}_-?\d+.*$', n): return True
        return False

    # Read all
    all_ents = []
    all_rels = []
    for db in dbpaths:
        e, r = read_db(db)
        for ent in e:
            if is_trash(ent['name']): continue
            if any(ent['name'].startswith(p) for p in SKIP_PREFIXES): continue
            # filter perf-only auto-generated junk (observation == 'perf')
            if ent['obs'] == ['perf'] or ent['obs'] == ['perf ']: continue
            # filter any entity whose name matches auto-gen pattern (prefix_num_...)
            if _re2.match(r'^[a-z]{1,3}_-?\d+.*$', (ent['name'] or '').lower()): continue
            all_ents.append(ent)
        for rel in r:
            if is_trash(rel['from']) or is_trash(rel['to']): continue
            all_rels.append(rel)
    print(f'Total raw: {len(all_ents)} entities, {len(all_rels)} relations')

    # Dedup entities by normalized name (merge observations)
    groups = {}
    for e in all_ents:
        groups.setdefault(e["name"].strip().lower(), []).append(e)
    deduped = []
    for key, grp in groups.items():
        if len(grp) == 1:
            deduped.append(grp[0])
            continue
        # merge
        survivor = min(grp, key=lambda x: x["created"] or '')
        obs = []
        seen = set()
        for g in grp:
            for o in g["obs"]:
                if o not in seen:
                    seen.add(o); obs.append(o)
        survivor["obs"] = obs
        deduped.append(survivor)
    print(f'After dedup: {len(deduped)} entities')

    # Dedup relations by (from, to, type)
    seen_rels = set()
    deduped_rels = []
    for r in all_rels:
        key = (r["from"], r["to"], r["type"])
        if key in seen_rels:
            continue
        seen_rels.add(key)
        deduped_rels.append(r)
    all_rels = deduped_rels
    print(f'After rel dedup: {len(all_rels)} relations')

    # Upsert into central
    con = sqlite3.connect(args.central)
    ensure_central_schema(con)
    # Remove trash entities from central
    for t in TRASH_NAMES:
        con.execute("DELETE FROM entities WHERE name=?", (t,))
        con.execute("DELETE FROM relations WHERE from_entity=? OR to_entity=?", (t,t))
    # Pattern-based trash cleanup
    for row in con.execute("SELECT name FROM entities").fetchall():
        nm = row[0]
        low = (nm or '').lower()
        if (low.startswith('debug:') or low.startswith('test_') or low.startswith('test-') or
            ('test' in low and ('entity' in low or 'write' in low or 'vault' in low)) or
            _re2.match(r'^[a-z]{1,3}_-?\d+', low)):
            con.execute("DELETE FROM entities WHERE name=?", (nm,))
            con.execute("DELETE FROM relations WHERE from_entity=? OR to_entity=?", (nm,nm))
    # Dedup relations in central (keep one per from/to/type)
    try:
        dups = con.execute("""SELECT from_entity, to_entity, relation_type, MIN(id) as keep_id
                              FROM relations GROUP BY from_entity, to_entity, relation_type
                              HAVING COUNT(*) > 1""").fetchall()
        for from_e, to_e, rtype, keep_id in dups:
            con.execute("""DELETE FROM relations
                           WHERE from_entity=? AND to_entity=? AND relation_type=? AND id != ?""",
                        (from_e, to_e, rtype, keep_id))
    except Exception:
        pass
    con.commit()
    upsert_central(con, deduped, all_rels)
    con.close()
    print(f'Central DB updated: {args.central}')

    # Clean vault (remove stale/duplicate notes) so vault == central exactly
    if args.clean_vault:
        removed = 0
        for fn in os.listdir(args.vault):
            if fn.endswith('.md'):
                try:
                    os.remove(os.path.join(args.vault, fn))
                    removed += 1
                except Exception:
                    pass
        print(f'Cleaned {removed} stale notes from vault')

    # Write vault notes
    # Build vault from CENTRAL db (source of truth) so vault == central exactly
    con2 = sqlite3.connect(args.central)
    cent_ents = []
    for r in con2.execute("SELECT name, entity_type, observations, created_at, updated_at FROM entities"):
        try:
            obs = json.loads(r[2]) if r[2] else []
        except Exception:
            obs = [r[2]] if r[2] else []
        cent_ents.append({"name": r[0], "type": r[1], "obs": obs, "created": r[3], "updated": r[4]})
    cent_rels = []
    for r in con2.execute("SELECT from_entity, to_entity, relation_type, created_at FROM relations"):
        cent_rels.append({"from": r[0], "to": r[1], "type": r[2], "created": r[3]})
    con2.close()
    rels_by_entity = {}
    for r in cent_rels:
        rels_by_entity.setdefault(r["from"], []).append(r)
        rels_by_entity.setdefault(r["to"], []).append(r)
    for e in cent_ents:
        rels = rels_by_entity.get(e["name"], [])
        write_note(args.vault, e, rels)
    print(f'Vault notes written: {len(cent_ents)} to {args.vault} (from central)')

if __name__ == '__main__':
    main()
