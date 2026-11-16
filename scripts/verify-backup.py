#!/usr/bin/env python3
"""Restore a saved Terminal database into an isolated folder and verify it."""
import os,pathlib,shlex,subprocess,json,sqlite3,hashlib,datetime
home=pathlib.Path.home();env=os.environ.copy()
for line in (home/'.config/klinekraft-backup/environment').read_text().splitlines():
 if line.strip() and not line.startswith('#'):
  k,v=line.split('=',1);env[k]=shlex.split(v)[0]
env['RCLONE_TPSLIMIT']='0.5';env['RCLONE_TPSLIMIT_BURST']='1'
root=home/'.local/state/klinekraft-backup/restore-verification'/datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ');root.mkdir(parents=True,exist_ok=False,mode=0o700)
def run(args):return subprocess.run(['restic',*args],env=env,check=True,capture_output=True,text=True,timeout=600).stdout
snapshots=json.loads(run(['snapshots','--tag','terminal','--latest','1','--json']));sid=snapshots[-1]['id'];print('Snapshot selected:',sid[:8],flush=True)
run(['restore',sid,'--include','/terminal/conversations.sqlite3','--include','/archives/Cold War Civil Defense','--target',str(root)])
db=list(root.rglob('conversations.sqlite3'))[0]
with sqlite3.connect(db.as_uri()+'?mode=ro',uri=True) as c:
 assert c.execute('pragma integrity_check').fetchone()[0]=='ok'
 tables=[r[0] for r in c.execute("select name from sqlite_master where type='table'")]
 count=c.execute('select count(*) from research_files').fetchone()[0]
print('Restored SQLite passes integrity check; research records:',count,flush=True)
archive=root/'archives/Cold War Civil Defense'
verified=[]
if (archive/'manifest.json').is_file():
 for entry in json.loads((archive/'manifest.json').read_text()):
  original=(archive/entry['original']).resolve()
  if not original.is_relative_to(archive.resolve()): raise RuntimeError('Invalid archive path')
  if hashlib.sha256(original.read_bytes()).hexdigest()!=entry['sha256']: raise RuntimeError('Archive checksum mismatch')
  verified.append(entry['title'])
 print('Original archive checksums verified:',len(verified),flush=True)
run(['check'])
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'snapshot':sid,'restoredDatabaseIntegrity':'ok','researchRecords':count,'repositoryMetadataCheck':'passed','physicalBootRestoreTested':False,'archiveOriginalsVerified':verified}
(root/'verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
