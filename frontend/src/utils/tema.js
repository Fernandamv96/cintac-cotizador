// Tema claro/oscuro compartido por Login y Navbar. El oscuro es el predeterminado.
export function temaInicial() {
  try {
    return localStorage.getItem("cintac-theme") || "oscuro";
  } catch {
    return "oscuro";
  }
}

export function aplicarTema(tema) {
  const valor = tema === "claro" ? "light" : "dark";
  try {
    localStorage.setItem("cintac-theme", tema);
  } catch {
    // Sin almacenamiento local: el tema solo dura esta visita.
  }
  document.documentElement.dataset.theme = valor;
  document.body.dataset.theme = valor;
}
