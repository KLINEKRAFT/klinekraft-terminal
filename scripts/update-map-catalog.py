#!/usr/bin/env python3
"""Refresh small public location collections. Never stores personal saved places.
Run explicitly online; generated JSON ships with the app for offline searching.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import urllib.parse
import urllib.request


def fetch(url, **params):
    request = urllib.request.Request(url + '?' + urllib.parse.urlencode(params), headers={'User-Agent': 'KlinekraftTerminal/1.0'})
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.load(response)


def point(identifier, name, lon, lat, group, url, note=''):
    return {'id': identifier, 'name': name, 'longitude': float(lon), 'latitude': float(lat),
            'group': group, 'url': url, 'note': note}


def main():
    key = os.environ.get('NPS_API_KEY', 'DEMO_KEY')
    parks = fetch('https://developer.nps.gov/api/v1/parks', limit=500, api_key=key)
    assert len(parks['data']) == int(parks['total']), 'NPS results truncated'
    items = []
    for p in parks['data']:
        states = p['states'].split(',')
        if 'HI' in states or not p['latitude'] or not p['longitude']:
            continue
        lat, lon = float(p['latitude']), float(p['longitude'])
        group = 'national-parks' if (p['designation'] in ('National Park', 'National Park & Preserve', 'National Parks') or p['parkCode'] in ('redw', 'npsa')) else None
        if 'OK' in states and -103.1 < lon < -94.3 and 33.6 < lat < 37.1:
            group = 'oklahoma-nps'
        if group:
            items.append(point('nps-'+p['parkCode'],p['fullName'],lon,lat,group,p['url'],
                               'NPS reference point; choose an official entrance before routing.'))
    source = 'https://www.wildlifedepartment.com/server/rest/services/PublicWILMA/WILMAFeatures/MapServer/1'
    entrances = fetch(source+'/query', where="OPENTOPUBL='Yes'", outFields='OBJECTID,WMANAME,OPENTOPUBL', outSR=4326, f='geojson')
    assert not entrances.get('exceededTransferLimit'), 'ODWC results truncated'
    expected = fetch(source+'/query', where="OPENTOPUBL='Yes'", returnCountOnly='true', f='json')['count']
    assert len(entrances['features']) == expected
    for f in entrances['features']:
        p = f['properties']; lon,lat = f['geometry']['coordinates'][:2]
        items.append(point('odwc-'+str(p['OBJECTID']),p['WMANAME']+' · entrance '+str(p['OBJECTID']),lon,lat,
                           'oklahoma-land','https://www.wildlifedepartment.com/hunting/wma',
                           'ODWC public entrance snapshot. Check current rules, seasons and closures. Not a property boundary.'))
    sites = fetch('https://developer.nps.gov/api/v1/places',parkCode='mimi',limit=50,api_key=key)
    wanted = ('Delta-01 Launch Control Facility','Delta-09 Missile Silo','Missile Site Park','Oscar-Zero Minuteman Missile Alert Facility')
    for p in sites['data']:
        if p['title'] in wanted:
            items.append(point('historic-'+p['id'],p['title'],p['longitude'],p['latitude'],'missile-history',p['url'],
                               'Preserved former missile facility. Check official opening hours and access.'))
    groups = [
        {'id':'national-parks','name':'US national parks · no Hawaii','note':'NPS park reference locations, including Alaska and US territories. Basemap coverage is lower 48 + Alaska.'},
        {'id':'oklahoma-nps','name':'Oklahoma · NPS sites','note':'Oklahoma NPS destinations: recreation area and historic site; not designated National Parks.'},
        {'id':'oklahoma-land','name':'Oklahoma · wildlife-area entrances','note':'ODWC public entrances, not all Oklahoma public land or land boundaries.'},
        {'id':'missile-history','name':'Historic missile sites','note':'Selected preserved decommissioned silos and control facilities. Not a nationwide inventory.'},
    ]
    data={'updated':datetime.now(timezone.utc).isoformat(),'groups':groups,'places':sorted(items,key=lambda p:p['name'])}
    path=Path(__file__).resolve().parents[1]/'backend/klinekraft/data/map-catalog.json'
    path.parent.mkdir(exist_ok=True)
    temporary=path.with_suffix('.tmp'); temporary.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');temporary.replace(path)
    print({g['name']:sum(p['group']==g['id'] for p in items) for g in groups})

if __name__ == '__main__': main()
