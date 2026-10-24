"""Bounded, read-only network and process samples. No command lines or environments."""
import time
import psutil


class ResourceSampler:
    def __init__(self):
        self.previous_time = None
        self.network = {}
        self.process_cpu = {}

    def sample(self):
        now = time.monotonic()
        elapsed = now - self.previous_time if self.previous_time is not None else None
        rates = {'network_download': None, 'network_upload': None}
        try:
            current = {name: (v.bytes_recv, v.bytes_sent) for name, v in psutil.net_io_counters(pernic=True).items() if name not in ('lo', 'lo0')}
            common = current.keys() & self.network.keys()
            if elapsed and elapsed > 0 and common:
                rates = {key: round(sum(max(0, current[n][i] - self.network[n][i]) for n in common) / elapsed, 2)
                         for i, key in enumerate(('network_download', 'network_upload'))}
            self.network = current
        except (psutil.Error, OSError, NotImplementedError):
            self.network = {}
        processes, next_cpu = [], {}
        cores = psutil.cpu_count() or 1
        try:
            for p in psutil.process_iter(['pid', 'name', 'create_time', 'cpu_times', 'memory_info'], ad_value=None):
                info = p.info
                if info['cpu_times'] is None or info['memory_info'] is None or info['create_time'] is None:
                    continue
                identity = (info['pid'], info['create_time'])
                cpu = info['cpu_times'].user + info['cpu_times'].system
                previous = self.process_cpu.get(identity)
                usage = min(100, max(0, (cpu - previous) / elapsed / cores * 100)) if elapsed and previous is not None else None
                next_cpu[identity] = cpu
                processes.append({'pid': info['pid'], 'name': (info['name'] or 'Unknown')[:100],
                                  'cpu': round(usage, 1) if usage is not None else None,
                                  'memoryBytes': info['memory_info'].rss})
        except (psutil.Error, OSError):
            processes = None
        self.process_cpu = next_cpu
        self.previous_time = now
        if processes is not None:
            processes.sort(key=lambda p: (p['cpu'] or 0, p['memoryBytes']), reverse=True)
            processes = processes[:12]
        return rates, processes
