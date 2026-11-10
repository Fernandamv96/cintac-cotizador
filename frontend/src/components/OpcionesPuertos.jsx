import React from "react";

// Opciones de un <select> de puertos agrupadas por país (China, Corea del Sur, Japón...).
export default function OpcionesPuertos({ grupos = [] }) {
  return grupos.map((grupo) => (
    <optgroup key={grupo.pais} label={grupo.pais}>
      {grupo.puertos.map((puerto) => <option key={puerto} value={puerto}>{puerto}</option>)}
    </optgroup>
  ));
}
