#!/usr/bin/python3
"""Small Wayland overlay for Shackleton, including outside Chromium.

No microphone access: reads the guarded loopback service's state only.
"""
import json
import math
import threading
import time
import urllib.request
import gi

gi.require_version('Gtk', '3.0')
gi.require_version('GtkLayerShell', '0.1')
from gi.repository import Gtk, GLib, GtkLayerShell, Gdk

BASE='http://127.0.0.1:8000/api/voice'

def request(path='', body=None):
    req=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,
                              headers={'X-Klinekraft-Client':'local-ui','Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=2) as response:return json.load(response)

class Overlay:
    def __init__(self):
        self.motion=Gtk.Settings.get_default().get_property('gtk-enable-animations')
        self.status={};self.t=0.;self.level=0.;self.last=time.monotonic();self.running=True
        self.points=[]
        for i in range(1800):
            y=1-2*(i+.5)/1800;r=math.sqrt(1-y*y);a=i*2.39996323
            self.points.append((r*math.cos(a),y,r*math.sin(a)))
        self.window=Gtk.Window();self.window.set_title('Shackleton voice');self.window.set_resizable(False)
        GtkLayerShell.init_for_window(self.window)
        GtkLayerShell.set_namespace(self.window,'klinekraft-voice')
        GtkLayerShell.set_layer(self.window,GtkLayerShell.Layer.OVERLAY)
        GtkLayerShell.set_anchor(self.window,GtkLayerShell.Edge.BOTTOM,True)
        GtkLayerShell.set_anchor(self.window,GtkLayerShell.Edge.RIGHT,True)
        GtkLayerShell.set_margin(self.window,GtkLayerShell.Edge.BOTTOM,12)
        GtkLayerShell.set_margin(self.window,GtkLayerShell.Edge.RIGHT,12)
        GtkLayerShell.set_keyboard_mode(self.window,GtkLayerShell.KeyboardMode.NONE)
        style=Gtk.CssProvider();style.load_from_data(b'window { background:#f2f0ea; color:#242424; border:1px solid #bcc6fb; border-radius:18px; } button { color:#242424; background:transparent; border:none; box-shadow:none; padding:8px; } label { font-family:Inter; font-size:13px; }')
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(),style,Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
        box=Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL,spacing=6);box.set_border_width(10);self.window.add(box)
        self.art=Gtk.DrawingArea();self.art.set_size_request(95,105);self.art.connect('draw',self.draw);box.pack_start(self.art,False,False,0)
        self.label=Gtk.Label();self.label.set_line_wrap(True);self.label.set_max_width_chars(28);self.label.set_width_chars(28);self.label.set_xalign(0);box.pack_start(self.label,True,True,0)
        controls=Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.stop=Gtk.Button(label='Stop');self.stop.connect('clicked',lambda _:self.action('stop'));controls.pack_start(self.stop,False,False,0)
        self.mute=Gtk.Button(label='Mute');self.mute.connect('clicked',lambda _:self.action('mute' if self.status.get('preferences',{}).get('enabled') else 'unmute'));controls.pack_start(self.mute,False,False,0)
        box.pack_start(controls,False,False,0)
        self.window.connect('destroy',lambda _:Gtk.main_quit())
        GLib.timeout_add(42,self.animate)
        threading.Thread(target=self.poll,daemon=True).start()

    def action(self,action):
        def work():
            try:request('/control',{'action':action})
            except Exception:pass
        threading.Thread(target=work,daemon=True).start()

    def poll(self):
        heartbeat=0
        while self.running:
            try:
                status=request()
                if time.monotonic()-heartbeat>1.5:
                    request('/ack',{'id':'native-heartbeat','result':''});heartbeat=time.monotonic()
                GLib.idle_add(self.update,status)
            except Exception:GLib.idle_add(self.window.hide)
            time.sleep(.2)

    def update(self,status):
        self.status=status;phase=status.get('phase','muted');active=phase not in ('idle','muted')
        # Always-available mute badge; expanded presentation only during a request.
        self.window.show_all();self.art.set_visible(active);self.stop.set_visible(active)
        enabled=status.get('preferences',{}).get('enabled',False)
        self.mute.set_label('Mute' if enabled else 'Mic off')
        if active:
            caption=status.get('error') or (status.get('answer') if phase=='speaking' else status.get('text')) or 'Speak now'
            self.label.set_text(('Anything else?' if phase=='followup' else phase.capitalize())+'\n'+caption[:155])
            self.label.set_width_chars(28)
        else:
            self.label.set_text('Shackleton');self.label.set_width_chars(10)
        self.art.queue_draw()
        return False

    def animate(self):
        now=time.monotonic();dt=min(now-self.last,.1);self.last=now
        if self.motion and self.status.get('phase') not in ('idle','muted'):
            self.t+=dt;self.art.queue_draw()
        return True

    def draw(self,widget,cr):
        phase=self.status.get('phase','idle');thinking=phase in ('thinking','preparing')
        level=self.status.get('level',0) if self.motion else 0;self.level+=(level-self.level)*.25
        w=widget.get_allocated_width();h=widget.get_allocated_height();cx=w/2;cy=h/2;r=34
        rot=self.t*(.6 if thinking else .16)
        if self.status.get('preferences',{}).get('style')=='liquid':
            for layer in range(15):
                cr.set_source_rgba(.01,.15,1,.25+layer/30);cr.set_line_width(.65)
                for i in range(81):
                    a=i*math.pi*2/80;rad=r+(layer-7)*.5+(1+self.level*6)*math.sin(a*3+self.t*1.5+layer*.2)
                    px=cx+math.cos(a)*rad;py=cy+math.sin(a)*rad
                    if i==0:cr.move_to(px,py)
                    else:cr.line_to(px,py)
                cr.close_path();cr.stroke()
        else:
            co=math.cos(rot);si=math.sin(rot)
            for x,y,z in self.points:
                xx=x*co+z*si;zz=z*co-x*si;scale=r*(1+self.level*.08*math.sin(y*9+self.t*3+zz*4))
                cr.set_source_rgba(.01,.15,1,.18+(zz+1)*.38)
                cr.arc(cx+xx*scale,cy+y*scale,.19+(zz+1)*.1,0,math.pi*2);cr.fill()

if __name__=='__main__':
    overlay=Overlay()
    try:Gtk.main()
    finally:overlay.running=False
