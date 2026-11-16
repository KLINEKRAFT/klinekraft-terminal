from datetime import datetime,timezone,timedelta
from klinekraft import emergency

def test_readiness_never_calls_unverified_installation_ready():
    assert emergency.verified('AI', True, {}, '')['state']=='Not tested'
    now=datetime.now(timezone.utc)
    report={'passed':True,'checkedAt':now.isoformat()}
    assert emergency.verified('AI', True, report, '')['state']=='Ready'
    assert emergency.verified('AI', False, report, '')['state']=='Needs attention'
    assert emergency.verified('AI', True, {**report,'passed':False}, '')['state']=='Needs attention'
    report['checkedAt']=(now-timedelta(days=8)).isoformat()
    assert emergency.verified('AI', True, report, '')['state']=='Needs retest'
    report['checkedAt']='invalid'
    assert emergency.verified('AI', True, report, '')['state']=='Not tested'

def test_future_and_missing_timestamps_are_not_fresh():
    assert emergency.age_hours(None) is None
    assert emergency.age_hours((datetime.now(timezone.utc)+timedelta(days=1)).isoformat()) is None
    assert emergency.age_hours('2026-11-16T10:00:00') is None
