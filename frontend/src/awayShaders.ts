// Adapted from KLINEKRAFT/away-message-dual/app.js. Only the three selected backgrounds.
export const common = `precision highp float;
uniform vec2 u_r;uniform vec2 u_world;uniform vec2 u_off;uniform float u_t;uniform vec2 u_m;uniform vec3 u_c;uniform vec3 u_c2;uniform vec3 u_c3;uniform float u_au;uniform vec3 u_ck;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){
  vec2 i=floor(p),f=fract(p);
  float a=h(i),b=h(i+vec2(1,0)),c=h(i+vec2(0,1)),d=h(i+vec2(1,1));
  vec2 u=f*f*(3.-2.*f);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.02;a*=.5;}return v;}
`;
export const shaders = {
  gradient: `void main(){vec2 uv=gl_FragCoord.xy/u_r;float ar=u_r.x/u_r.y;vec2 q=uv;q.x*=ar;float t=u_t*.06;float w=fbm(q*1.6+t+(u_m-.5)*1.2);float g=uv.y*.6+uv.x*.2+w*.5;float cd=distance(uv,u_ck.xy);g+=sin(cd*32.-u_ck.z*7.)*exp(-cd*5.)*exp(-u_ck.z*2.5)*.22;float s=smoothstep(.05,1.05,g);vec3 col=mix(u_c*.48,u_c*1.18,s);col=mix(col,u_c2,s*s*.14);col+=u_c3*(1.-s)*.07;gl_FragColor=vec4(clamp(col,0.,1.),1.);}`,
  contour: `void main(){vec2 uv=gl_FragCoord.xy/u_r;float ar=u_r.x/u_r.y;vec2 q=uv;q.x*=ar;vec2 m=u_m;m.x*=ar;float t=u_t*.05;float f=fbm(q*2.2+vec2(t*.6,t));f+=exp(-dot(q-m,q-m)*5.)*.24;float cd=distance(uv,u_ck.xy);f+=exp(-cd*cd*18.)*exp(-u_ck.z*2.)*.28;float l=f*16.;float e=fract(l);float w=fwidth(l)*1.5;float c=smoothstep(0.,w,e)*(1.-smoothstep(1.-w,1.,e));vec3 col=u_c*mix(.94,.36,1.-c)+u_c2*(1.-c)*.14;gl_FragColor=vec4(clamp(col,0.,1.),1.);}`,
  chrome: `void main(){vec2 uv=gl_FragCoord.xy/u_r;float ar=u_r.x/u_r.y;vec2 p=vec2(uv.x*ar,uv.y);vec2 m=vec2(u_m.x*ar,u_m.y);float t=u_t*.09;float n1=fbm(p*1.8+vec2(t*.6,t*.4));float n2=fbm(p*3.2-vec2(t*.3,t*.5));float n3=fbm(p*5.5+vec2(t*.7,-t*.3));vec2 dp=vec2(n1-.5,n2-.5)*.38;float md=length(p-m);dp+=(p-m)/max(md,.01)*exp(-md*3.5)*.16;float cd=length(uv-u_ck.xy);float sw=sin(cd*44.-u_ck.z*10.)*exp(-cd*5.)*exp(-u_ck.z*2.5);dp+=vec2(sw)*.07;float env=fbm((uv+dp)*2.5+vec2(t*.2));float v=n1*.42+n2*.33+n3*.25;v=smoothstep(.18,.82,v+env*.28);vec3 dark=mix(vec3(.04,.045,.06),u_c3,.12);vec3 mid=mix(vec3(.5,.54,.6),u_c,.3);vec3 bright=mix(vec3(.9,.93,.96),u_c,.18);vec3 col=mix(dark,mid,smoothstep(0.,.5,v));col=mix(col,bright,smoothstep(.5,1.,v));float iv=n3*2.+t*.14;float ir=pow(max(0.,1.-abs(fract(iv)-.5)*4.),2.);vec3 iri=mix(u_c2,u_c3,.5+.5*sin(iv*6.28));col=mix(col,iri,ir*.2);float ca=fbm(uv*8.+t)*.015;col.r=mix(col.r,fbm((uv+dp+ca)*2.5+vec2(t*.2)),v*.3);gl_FragColor=vec4(clamp(col,0.,1.),1.);}`,
};
export type Background = keyof typeof shaders;
