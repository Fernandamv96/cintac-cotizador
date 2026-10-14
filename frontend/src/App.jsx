import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./api/AuthContext.jsx";
import { LanguageProvider, useLanguage } from "./api/LanguageContext.jsx";
import Navbar from "./components/Navbar.jsx";
import { Aurora, ClickSpark, useSpotlightGlobal } from "./components/bits.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import NuevaCotizacion from "./pages/NuevaCotizacion.jsx";
import Historial from "./pages/Historial.jsx";
import Comparar from "./pages/Comparar.jsx";
import Usuarios from "./pages/Usuarios.jsx";
import Admin from "./pages/Admin.jsx";
import Auditoria from "./pages/Auditoria.jsx";
import Tarifas from "./pages/Tarifas.jsx";

const INFO_CINTAC = {
  matriz: {
    titulo: "Casa Matriz",
    direccion: "Camino a Melipilla 8920, Maipú",
    telefono: "+56 2 2484 9200",
  },
  santiago: {
    titulo: "Retiro de productos Santiago",
    direccion: "Santa Adela 8920, Maipu",
    telefono: "+56 9 5669 5025",
    canal: "WhatsApp",
  },
  instapanel: {
    titulo: "Instapanel LAB",
    direccion: "Av. Las Condes 9765, Local 210, Las Condes",
    telefono: "+56 2 2484 9200",
  },
  concepcion: {
    titulo: "Concepción",
    direccion: "Camino a Coronel 5580, Km 10, bodegas 6B Mecagentro, San Pedro de la Paz",
    telefono: "+56 41 2 461620\n+56 41 2 461621\n+56 9 9332 9676",
  },
};

const BLOQUES_FOOTER = [
  {
    titulo: "Productos",
    items: [
      { label: "Cubiertas y Revestimientos", href: "https://www.cintac.cl/cubiertas-y-revestimientos/" },
      { label: "Metalon", href: "https://www.cintac.cl/perfiles-y-accesorios-metalcon/" },
      { label: "Perfiles Abiertos", href: "https://www.cintac.cl/tubos-perfiles-plancha/" },
      { label: "Perfiles Laminados", href: "https://www.cintac.cl/tubos-perfiles-plancha/" },
      { label: "Tubest", href: "https://www.cintac.cl/tubest/" },
      { label: "Tubulares", href: "https://www.cintac.cl/tubos-perfiles-plancha/" },
    ],
  },
  {
    titulo: "Ayuda",
    items: [
      { label: "Consulta", href: "https://www.cintac.cl/contacto-2/" },
      { label: "Cotiza", href: "https://www.cintac.cl/cotiza/" },
      { label: "Blog", href: "https://www.cintac.cl/noticias/" },
    ],
  },
  {
    titulo: "Comunidad",
    items: [
      { label: "Foros", href: "https://www.cintac.cl/" },
      { label: "Capacitaciones", href: "https://www.cintac.cl/" },
      { label: "Noticias", href: "https://www.cintac.cl/noticias/" },
    ],
  },
  {
    titulo: "Historia",
    items: [
      { label: "Historia", href: "https://www.cintac.cl/empresa/" },
      { label: "CAP", href: "http://www.cap.cl/" },
      { label: "Tupemesa", href: "https://www.tupemesa.com.pe/" },
      { label: "Calaminon", href: "http://www.calaminon.com/" },
    ],
  },
  {
    titulo: "Empresas Relacionadas",
    items: [
      { label: "Instapanel", href: "https://www.cintac.cl/instapanel/" },
      { label: "Suministros CINTAC", href: "https://www.cintac.cl/" },
      { label: "Distribución", href: "https://www.cintac.cl/" },
      { label: "Servicios", href: "https://www.cintac.cl/" },
    ],
  },
];

function RutaProtegida({ children, soloAdmin = false }) {
  const { usuario } = useAuth();
  if (!usuario) return <Navigate to="/login" replace />;
  if (soloAdmin && !["ADMIN", "SUPERADMIN", "administrador"].includes(usuario.rol)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="site-footer">
      <div className="site-footer__grid">
        <div>
          <h4>{t(INFO_CINTAC.matriz.titulo)}</h4>
          <p>{t("Dirección")}: {INFO_CINTAC.matriz.direccion}</p>
          <p>{t("Teléfono")}: {INFO_CINTAC.matriz.telefono}</p>
        </div>
        <div>
          <h4>{t(INFO_CINTAC.santiago.titulo)}</h4>
          <p>{t("Dirección")}: {INFO_CINTAC.santiago.direccion}</p>
          <p>{t(INFO_CINTAC.santiago.canal)}: {INFO_CINTAC.santiago.telefono}</p>
        </div>
        <div>
          <h4>{t(INFO_CINTAC.instapanel.titulo)}</h4>
          <p>{t("Dirección")}: {INFO_CINTAC.instapanel.direccion}</p>
          <p>{t("Teléfono")}: {INFO_CINTAC.instapanel.telefono}</p>
        </div>
        <div>
          <h4>{t(INFO_CINTAC.concepcion.titulo)}</h4>
          <p>{t("Dirección")}: {INFO_CINTAC.concepcion.direccion}</p>
          <p>{t("Teléfono")}: {INFO_CINTAC.concepcion.telefono}</p>
        </div>
      </div>

      <div className="site-footer__bottom">
        <div className="site-footer__links">
          {BLOQUES_FOOTER.map((bloque) => (
            <div key={bloque.titulo} className="site-footer__column">
              <h5>{t(bloque.titulo)}</h5>
              <ul>
                {bloque.items.map((item) => (
                  <li key={item.label}>
                    <a href={item.href} target="_blank" rel="noreferrer">{t(item.label)}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="site-footer__socials">
          <a href="https://www.facebook.com/CINTAC" target="_blank" rel="noreferrer" aria-label={t("Facebook CINTAC")}>f</a>
          <a href="https://www.instagram.com/cintaccl/" target="_blank" rel="noreferrer" aria-label={t("Instagram CINTAC")}>◎</a>
          <a href="https://www.linkedin.com/company/cintac" target="_blank" rel="noreferrer" aria-label={t("LinkedIn CINTAC")}>in</a>
        </div>
      </div>

      <div className="site-footer__copyright">{t("Copyright Cintac S.A.I.C. Todos los derechos reservados.")}</div>
    </footer>
  );
}

function Layout() {
  useSpotlightGlobal();
  return (
    <>
      <Aurora />
      <ClickSpark />
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RutaProtegida>
              <Dashboard />
            </RutaProtegida>
          }
        />
        <Route
          path="/nueva"
          element={
            <RutaProtegida>
              <NuevaCotizacion />
            </RutaProtegida>
          }
        />
        <Route
          path="/historial"
          element={
            <RutaProtegida>
              <Historial />
            </RutaProtegida>
          }
        />
        <Route
          path="/comparar"
          element={
            <RutaProtegida>
              <Comparar />
            </RutaProtegida>
          }
        />
        <Route
          path="/tarifas"
          element={
            <RutaProtegida>
              <Tarifas />
            </RutaProtegida>
          }
        />
        <Route
          path="/admin"
          element={
            <RutaProtegida soloAdmin>
              <Admin />
            </RutaProtegida>
          }
        />
        <Route
          path="/admin/usuarios"
          element={
            <RutaProtegida soloAdmin>
              <Usuarios />
            </RutaProtegida>
          }
        />
        <Route
          path="/admin/auditoria"
          element={
            <RutaProtegida soloAdmin>
              <Auditoria />
            </RutaProtegida>
          }
        />
        <Route
          path="/usuarios"
          element={
            <Navigate to="/admin/usuarios" replace />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Layout />
      </LanguageProvider>
    </AuthProvider>
  );
}
