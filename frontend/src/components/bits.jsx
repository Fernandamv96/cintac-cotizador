// Efectos inspirados en React Bits (reactbits.dev), reescritos sin dependencias
// y con los colores de Cintac. Todos respetan "prefers-reduced-motion".
import React, { useEffect, useRef, useState } from "react";

const reduceMovimiento = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Fondo animado de auroras naranjas, fijo detrás de toda la app. */
export function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <span className="aurora__blob aurora__blob--1" />
      <span className="aurora__blob aurora__blob--2" />
      <span className="aurora__blob aurora__blob--3" />
      <span className="aurora__grid" />
    </div>
  );
}

/** Texto con degradado animado. */
export function GradientText({ children, className = "", as: Tag = "span" }) {
  return <Tag className={`gradient-text ${className}`}>{children}</Tag>;
}

/** Texto con brillo que lo recorre. */
export function ShinyText({ children, className = "" }) {
  return <span className={`shiny-text ${className}`}>{children}</span>;
}

/** Las palabras aparecen desenfocadas y se enfocan una tras otra. */
export function BlurText({ text, className = "", as: Tag = "h1", delay = 70 }) {
  const palabras = String(text).split(" ");
  return (
    <Tag className={`blur-text ${className}`} aria-label={text}>
      {palabras.map((palabra, i) => (
        <span key={`${palabra}-${i}`} aria-hidden="true" style={{ animationDelay: `${i * delay}ms` }}>
          {palabra}
          {i < palabras.length - 1 ? " " : ""}
        </span>
      ))}
    </Tag>
  );
}

/** Número que cuenta desde 0 hasta el valor. */
export function CountUp({ to, duration = 1200, format = (n) => Math.round(n).toLocaleString() }) {
  const [valor, setValor] = useState(reduceMovimiento() ? to : 0);

  useEffect(() => {
    if (reduceMovimiento()) {
      setValor(to);
      return undefined;
    }
    let frame;
    const inicio = performance.now();
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - inicio) / duration);
      setValor(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(paso);
    };
    frame = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(frame);
  }, [to, duration]);

  return <span className="tabular-nums">{format(valor)}</span>;
}

/** Tarjeta con un foco de luz que sigue al puntero. */
export function SpotlightCard({ children, className = "", as: Tag = "div", ...props }) {
  return (
    <Tag className={`tarjeta spotlight ${className}`} {...props}>
      {children}
    </Tag>
  );
}

/**
 * Activa el foco de luz en cualquier .tarjeta de la página con un solo listener,
 * así también lo tienen las tablas y formularios existentes.
 */
export function useSpotlightGlobal() {
  useEffect(() => {
    function mover(e) {
      const tarjeta = e.target.closest?.(".tarjeta, .spotlight");
      if (!tarjeta) return;
      const r = tarjeta.getBoundingClientRect();
      tarjeta.style.setProperty("--mx", `${e.clientX - r.left}px`);
      tarjeta.style.setProperty("--my", `${e.clientY - r.top}px`);
    }
    document.addEventListener("pointermove", mover, { passive: true });
    return () => document.removeEventListener("pointermove", mover);
  }, []);
}

/** Chispas naranjas en cada clic (ClickSpark). */
export function ClickSpark() {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (reduceMovimiento()) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let chispas = [];
    let frame = null;

    function ajustar() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function dibujar(ahora) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      chispas = chispas.filter((c) => ahora - c.inicio < 420);
      for (const c of chispas) {
        const t = (ahora - c.inicio) / 420;
        const e = t * (2 - t);
        const d = e * 26;
        const largo = 9 * (1 - e);
        const x1 = c.x + d * Math.cos(c.angulo);
        const y1 = c.y + d * Math.sin(c.angulo);
        ctx.strokeStyle = "#ff7a1a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + largo * Math.cos(c.angulo), y1 + largo * Math.sin(c.angulo));
        ctx.stroke();
      }
      frame = chispas.length ? requestAnimationFrame(dibujar) : null;
    }

    function clic(e) {
      const ahora = performance.now();
      for (let i = 0; i < 8; i += 1) {
        chispas.push({ x: e.clientX, y: e.clientY, angulo: (2 * Math.PI * i) / 8, inicio: ahora });
      }
      if (!frame) frame = requestAnimationFrame(dibujar);
    }

    ajustar();
    window.addEventListener("resize", ajustar);
    document.addEventListener("click", clic);
    return () => {
      window.removeEventListener("resize", ajustar);
      document.removeEventListener("click", clic);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas ref={canvasRef} className="click-spark" aria-hidden="true" />;
}

/** Logo de Cintac: aro naranja con la C. */
export function LogoCintac({ size = 44, conTexto = true }) {
  return (
    <span className="logo-cintac">
      <span className="logo-cintac__mark" style={{ width: size, height: size }} aria-hidden="true">
        <span style={{ fontSize: size * 0.5 }}>C</span>
      </span>
      {conTexto && <span className="logo-cintac__texto">CINTAC</span>}
    </span>
  );
}
