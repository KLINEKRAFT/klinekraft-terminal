from types import SimpleNamespace
from fastapi.testclient import TestClient
from klinekraft.main import app
from klinekraft.resources import ResourceSampler
from klinekraft import resources


def test_rates_reset_and_process_cpu(monkeypatch):
    clock = iter([100., 102., 104.])
    monkeypatch.setattr(resources.time, 'monotonic', lambda: next(clock))
    monkeypatch.setattr(resources.psutil, 'cpu_count', lambda: 4)
    counters = {'wlan0': SimpleNamespace(bytes_recv=1000, bytes_sent=500), 'lo': SimpleNamespace(bytes_recv=999999, bytes_sent=999999)}
    monkeypatch.setattr(resources.psutil, 'net_io_counters', lambda **_: counters)
    info = {'pid': 12, 'create_time': 10., 'name': 'test', 'cpu_times': SimpleNamespace(user=1., system=1.), 'memory_info': SimpleNamespace(rss=2000)}
    monkeypatch.setattr(resources.psutil, 'process_iter', lambda *a, **kw: [SimpleNamespace(info=info.copy())])
    sampler = ResourceSampler()
    rates, processes = sampler.sample()
    assert rates['network_download'] is None
    assert processes[0]['cpu'] is None
    counters['wlan0'] = SimpleNamespace(bytes_recv=5000, bytes_sent=1500)
    info['cpu_times'] = SimpleNamespace(user=3., system=1.)
    rates, processes = sampler.sample()
    assert rates == {'network_download': 2000., 'network_upload': 500.}
    assert processes[0]['cpu'] == 25.0
    counters['wlan0'] = SimpleNamespace(bytes_recv=1, bytes_sent=1)
    info['create_time'] = 20.  # PID reused: no inherited CPU history.
    rates, processes = sampler.sample()
    assert rates['network_download'] == 0
    assert processes[0]['cpu'] is None
    assert set(processes[0]) == {'pid', 'name', 'cpu', 'memoryBytes'}


def test_missing_resource_reads_are_unavailable(monkeypatch):
    def denied(**kwargs): raise OSError()
    monkeypatch.setattr(resources.psutil, 'net_io_counters', denied)
    monkeypatch.setattr(resources.psutil, 'process_iter', lambda *a, **kw: (_ for _ in ()).throw(OSError()))
    rates, processes = ResourceSampler().sample()
    assert rates == {'network_download': None, 'network_upload': None}
    assert processes is None


def test_process_endpoint_requires_local_header():
    with TestClient(app, base_url='http://127.0.0.1') as client:
        assert client.get('/api/processes').status_code == 403
        response = client.get('/api/processes', headers={'X-Klinekraft-Client': 'local-ui'})
        assert response.status_code == 200
        assert response.headers['cache-control'] == 'no-store'
        assert response.json()['sampledAt']
        assert len(response.json()['processes']) <= 12
