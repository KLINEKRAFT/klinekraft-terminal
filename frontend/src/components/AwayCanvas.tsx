import { useEffect, useRef, useState } from "react";
import { common, shaders, type Background } from "../awayShaders";

export function AwayCanvas({
  background,
  colors,
  paused,
}: {
  background: Background;
  colors: string[];
  paused: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const palette = useRef(colors);
  palette.current = colors;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = canvas.current!;
    const gl = element.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "low-power",
    });
    setFailed(false);
    if (!gl) {
      setFailed(true);
      return;
    }
    const resources: WebGLShader[] = [];
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let frame = 0;
    let lost = false;
    const onLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      cancelAnimationFrame(frame);
      setFailed(true);
    };
    element.addEventListener("webglcontextlost", onLost);
    try {
      const derivatives = !!gl.getExtension("OES_standard_derivatives");
      let fragment = shaders[background];
      if (!derivatives) fragment = fragment.replace("fwidth(l)*1.5", "0.07");
      const compile = (kind: number, source: string) => {
        const shader = gl.createShader(kind)!;
        resources.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
          throw new Error("Shader unavailable");
        return shader;
      };
      program = gl.createProgram()!;
      gl.attachShader(
        program,
        compile(
          gl.VERTEX_SHADER,
          "attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}",
        ),
      );
      gl.attachShader(
        program,
        compile(
          gl.FRAGMENT_SHADER,
          (derivatives
            ? "#extension GL_OES_standard_derivatives : enable\n"
            : "") +
            common +
            fragment,
        ),
      );
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error("Shader unavailable");
      gl.useProgram(program);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const resolution = gl.getUniformLocation(program, "u_r");
      const time = gl.getUniformLocation(program, "u_t");
      const uniforms = ["u_c", "u_c2", "u_c3"].map((name) =>
        gl.getUniformLocation(program!, name),
      );
      gl.uniform2f(gl.getUniformLocation(program, "u_m"), 0.5, 0.5);
      gl.uniform3f(gl.getUniformLocation(program, "u_ck"), 0, 0, 100);
      const motion = matchMedia("(prefers-reduced-motion: reduce)");
      let elapsed = 0,
        previous = 0;
      const draw = (stamp: number) => {
        if (lost) return;
        frame = requestAnimationFrame(draw);
        if (document.hidden) {
          previous = stamp;
          return;
        }
        if (stamp - previous < 1000 / 24) return;
        if (!paused && !motion.matches)
          elapsed += Math.min(stamp - previous, 100) / 1000;
        previous = stamp;
        const box = element.getBoundingClientRect();
        const scale = Math.min(
          1,
          960 / Math.max(1, box.width),
          540 / Math.max(1, box.height),
        );
        const width = Math.max(1, Math.round(box.width * scale)),
          height = Math.max(1, Math.round(box.height * scale));
        if (element.width !== width || element.height !== height) {
          element.width = width;
          element.height = height;
          gl.viewport(0, 0, width, height);
        }
        gl.uniform2f(resolution, width, height);
        gl.uniform1f(time, elapsed);
        palette.current.forEach((hex, i) => {
          const value = parseInt(hex.slice(1), 16);
          gl.uniform3f(
            uniforms[i],
            ((value >> 16) & 255) / 255,
            ((value >> 8) & 255) / 255,
            (value & 255) / 255,
          );
        });
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      };
      frame = requestAnimationFrame(draw);
    } catch {
      setFailed(true);
    }
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("webglcontextlost", onLost);
      resources.forEach((shader) => gl.deleteShader(shader));
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [background, paused]);
  return (
    <>
      <canvas
        ref={canvas}
        className="away-canvas"
        aria-hidden="true"
        style={{
          background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]}, ${colors[2]})`,
          visibility: failed ? "hidden" : "visible",
        }}
      />
      {failed && (
        <small className="away-render-note">
          Animated background unavailable · static colors shown
        </small>
      )}
    </>
  );
}
