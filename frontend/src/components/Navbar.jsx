import React, { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { api } from "../api/api.js";
import { useAuth } from "../api/AuthContext.jsx";
import { LANGUAGES, useLanguage } from "../api/LanguageContext.jsx";
import { aplicarTema, temaInicial } from "../utils/tema.js";
import { LogoCintac } from "./bits.jsx";

const enlaces = [
  { to: "/", texto: "Inicio", fin: true },
  { to: "/nueva", texto: "Nueva cotización" },
  { to: "/historial", texto: "Historial" },
  { to: "/comparar", texto: "Comparar" },
  { to: "/tarifas", texto: "Tarifas" },
];

const textos = {
  es: {
    config: "Configuración",
    usuario: "Nombre de usuario",
    email: "Correo electrónico",
    idioma: "Idioma",
    tema: "Tema",
    claro: "Claro",
    oscuro: "Oscuro",
    cambiarPassword: "Cambiar contraseña",
    contraseñaActual: "Contraseña actual",
    nuevaContrasena: "Nueva contraseña",
    guardar: "Guardar",
    cerrarSesion: "Cerrar sesión",
    confirmarCorreo: "Confirmar por correo",
    codigo: "Código de confirmación",
    enviarCodigo: "Enviar código",
    codigoEnviado: "Se envió un código de confirmación a tu correo.",
    confirmar: "Confirmar cambio",
    nota: "Para cambiar correo, nombre de usuario o contraseña, debes confirmar por correo.",
  },
  en: {
    config: "Settings",
    usuario: "Username",
    email: "Email",
    idioma: "Language",
    tema: "Theme",
    claro: "Light",
    oscuro: "Dark",
    cambiarPassword: "Change password",
    contraseñaActual: "Current password",
    nuevaContrasena: "New password",
    guardar: "Save",
    cerrarSesion: "Log out",
    confirmarCorreo: "Confirm by email",
    codigo: "Confirmation code",
    enviarCodigo: "Send code",
    codigoEnviado: "A confirmation code was sent to your email.",
    confirmar: "Confirm change",
    nota: "Email confirmation is required to change your email, username, or password.",
  },
  ru: {
    config: "Настройки",
    usuario: "Имя пользователя",
    email: "Эл. почта",
    idioma: "Язык",
    tema: "Тема",
    claro: "Светлая",
    oscuro: "Тёмная",
    cambiarPassword: "Изменить пароль",
    contraseñaActual: "Текущий пароль",
    nuevaContrasena: "Новый пароль",
    guardar: "Сохранить",
    cerrarSesion: "Выйти",
    confirmarCorreo: "Подтвердить по email",
    codigo: "Код подтверждения",
    enviarCodigo: "Отправить код",
    codigoEnviado: "Код подтверждения отправлен на вашу почту.",
    confirmar: "Подтвердить изменение",
    nota: "Для смены почты, имени пользователя или пароля требуется подтверждение по email.",
  },
  zh: {
    config: "设置",
    usuario: "用户名",
    email: "电子邮件",
    idioma: "语言",
    tema: "主题",
    claro: "浅色",
    oscuro: "深色",
    cambiarPassword: "修改密码",
    contraseñaActual: "当前密码",
    nuevaContrasena: "新密码",
    guardar: "保存",
    cerrarSesion: "退出",
    confirmarCorreo: "通过邮箱确认",
    codigo: "确认码",
    enviarCodigo: "发送验证码",
    codigoEnviado: "确认码已发送到您的邮箱。",
    confirmar: "确认修改",
    nota: "更改邮箱、用户名或密码需要通过邮件确认。",
  },
  ja: {
    config: "設定",
    usuario: "ユーザー名",
    email: "メールアドレス",
    idioma: "言語",
    tema: "テーマ",
    claro: "ライト",
    oscuro: "ダーク",
    cambiarPassword: "パスワードを変更",
    contraseñaActual: "現在のパスワード",
    nuevaContrasena: "新しいパスワード",
    guardar: "保存",
    cerrarSesion: "ログアウト",
    confirmarCorreo: "メールで確認",
    codigo: "確認コード",
    enviarCodigo: "コードを送信",
    codigoEnviado: "確認コードをメールで送信しました。",
    confirmar: "変更を確認",
    nota: "メールアドレス、ユーザー名、パスワードの変更にはメール確認が必要です。",
  },
};

export default function Navbar() {
  const { usuario, cerrarSesion } = useAuth();
  const { language: idioma, setLanguage: setIdioma, t: translate } = useLanguage();
  const navigate = useNavigate();
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [tema, setTema] = useState(temaInicial);
  const [username, setUsername] = useState(usuario?.username || "");
  const [email, setEmail] = useState(usuario?.email || "");
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [codigoConfirmacion, setCodigoConfirmacion] = useState("");
  const [codigoEnviado, setCodigoEnviado] = useState("");
  const [errorConfig, setErrorConfig] = useState("");
  const [okConfig, setOkConfig] = useState("");
  const [solicitudRol, setSolicitudRol] = useState({
    nombre: "",
    username: "",
    email: "",
    password: "",
    confirmarPassword: "",
    passwordActual: "",
    rol: "JEFE_ABASTECIMIENTO",
  });
  const [aprobacionRol, setAprobacionRol] = useState(null);
  const [codigoAprobacionRol, setCodigoAprobacionRol] = useState("");
  const [errorAprobacionRol, setErrorAprobacionRol] = useState("");
  const [okAprobacionRol, setOkAprobacionRol] = useState("");
  const [cargandoAprobacionRol, setCargandoAprobacionRol] = useState(false);

  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);

  useEffect(() => {
    if (usuario) {
      setUsername(usuario.username || "");
      setEmail(usuario.email || "");
    }
  }, [usuario]);

  async function generarCodigoConfirmacion() {
    setErrorConfig("");
    setOkConfig("");

    try {
      await api.solicitarConfirmacionPerfil({ userId: usuario.id, email: email || usuario.email || "" });
      setCodigoEnviado("sent");
      setOkConfig("Se envió un código de confirmación a tu correo.");
    } catch (err) {
      setErrorConfig(err.message);
    }
  }

  async function solicitarAltaRol(e) {
    e.preventDefault();
    setErrorAprobacionRol("");
    setOkAprobacionRol("");
    setCargandoAprobacionRol(true);
    try {
      const resultado = await api.solicitarAprobacionRol(solicitudRol);
      setAprobacionRol(resultado);
      setCodigoAprobacionRol("");
      setSolicitudRol((prev) => ({ ...prev, password: "", confirmarPassword: "", passwordActual: "" }));
      setOkAprobacionRol(resultado.message);
    } catch (error) {
      setErrorAprobacionRol(error.message);
    } finally {
      setCargandoAprobacionRol(false);
    }
  }

  async function confirmarAltaRol(e) {
    e.preventDefault();
    setErrorAprobacionRol("");
    setOkAprobacionRol("");
    setCargandoAprobacionRol(true);
    try {
      const resultado = await api.confirmarAprobacionRol({
        challengeId: aprobacionRol.challengeId,
        codigo: codigoAprobacionRol.trim(),
      });
      setOkAprobacionRol(resultado.message);
      setAprobacionRol(null);
      setCodigoAprobacionRol("");
      setSolicitudRol({
        nombre: "",
        username: "",
        email: "",
        password: "",
        confirmarPassword: "",
        passwordActual: "",
        rol: "JEFE_ABASTECIMIENTO",
      });
    } catch (error) {
      setErrorAprobacionRol(error.message);
    } finally {
      setCargandoAprobacionRol(false);
    }
  }

  async function manejarConfiguracion(e) {
    e.preventDefault();
    setErrorConfig("");
    setOkConfig("");

    const quiereCambiarPassword = Boolean(passwordActual || passwordNueva);
    if (quiereCambiarPassword && (!passwordNueva || passwordNueva.length < 8 || !/[A-Za-z]/.test(passwordNueva) || !/\d/.test(passwordNueva))) {
      setErrorConfig("La nueva contraseña debe tener al menos 8 caracteres e incluir letras y números.");
      return;
    }

    if (quiereCambiarPassword && !passwordActual) {
      setErrorConfig("Debes ingresar tu contraseña actual. Si la olvidaste, usa la opción de recuperación al iniciar sesión.");
      return;
    }

    if ((quiereCambiarPassword || username !== usuario.username || email !== usuario.email) && !codigoConfirmacion.trim()) {
      setErrorConfig("Debes ingresar el código de confirmación que recibiste por correo.");
      return;
    }

    try {
      const actualizaCuenta = quiereCambiarPassword || username !== usuario.username || email !== usuario.email;
      let resultado;
      if (actualizaCuenta) {
        resultado = await api.confirmarPerfil({
          username: username.trim() || usuario.username,
          email: email.trim() || usuario.email,
          codigo: codigoConfirmacion.trim(),
          ...(quiereCambiarPassword && { password: passwordActual, nuevaPassword }),
        });
      }

      if (passwordActual || passwordNueva || username !== usuario.username || email !== usuario.email) {
        setOkConfig("Configuración actualizada correctamente.");
      } else {
        setOkConfig("Configuración guardada correctamente.");
      }

      setCodigoConfirmacion("");
      setCodigoEnviado("");
      setPasswordActual("");
      setPasswordNueva("");
      if (resultado?.logoutRequired) {
        cerrarSesion();
        navigate("/login", { replace: true });
      }
    } catch (err) {
      setErrorConfig(err.message);
    }
  }

  if (!usuario) return null;

  const t = textos[idioma] || textos.es;
  const esAdmin = ["ADMIN", "SUPERADMIN", "administrador"].includes(usuario.rol);
  const paginaInicio = esAdmin ? "/admin" : "/";


  return (
    <header className="navbar-shell">
      <div className="navbar-bar">
        <Link to={paginaInicio} aria-label={translate("CINTAC, volver al inicio")} className="logo-cintac">
          <LogoCintac size={36} />
          <span className="hidden text-xs font-medium text-acero-claro 2xl:block">{translate("Cotizador de flete de importación")}</span>
        </Link>

        <nav className="nav-pills" aria-label={translate("Navegación principal")}>
          {(esAdmin
            ? [
                ...enlaces,
                { to: "/admin", texto: "Panel", fin: true },
                { to: "/admin/usuarios", texto: "Usuarios" },
                { to: "/admin/auditoria", texto: "Auditoría" },
              ]
            : enlaces
          ).map((enlace) => (
            <NavLink key={enlace.to} to={enlace.to} end={enlace.fin} className="nav-link">
              {translate(enlace.texto)}
            </NavLink>
          ))}
        </nav>

        <div className="nav-user">
          <span className="nav-user__avatar" aria-hidden="true">{(usuario.nombre || "?").trim().charAt(0).toUpperCase()}</span>
          <span className="nav-user__datos">
            <strong>{usuario.nombre}</strong>
            <small>{translate(usuario.rol.replace("_", " "))}</small>
            {usuario.email && <small className="nav-user__email" title={usuario.email}>{usuario.email}</small>}
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-label={tema === "oscuro" ? t.claro : t.oscuro}
            title={`${t.tema}: ${tema === "oscuro" ? t.oscuro : t.claro}`}
            onClick={() => setTema((prev) => (prev === "oscuro" ? "claro" : "oscuro"))}
          >
            <span aria-hidden="true">{tema === "oscuro" ? "☀" : "☾"}</span>
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={t.config}
            title={t.config}
            aria-expanded={mostrarConfig}
            onClick={() => setMostrarConfig((prev) => !prev)}
          >
            <span aria-hidden="true">⚙</span>
          </button>
          <button
            type="button"
            className="btn-secundario whitespace-nowrap px-3 py-2 text-sm"
            onClick={() => {
              cerrarSesion();
              navigate("/login");
            }}
          >
            {t.cerrarSesion}
          </button>
        </div>
      </div>

      {mostrarConfig && (
        <div className="config-panel">
          <div className="px-6 py-5">
            <form onSubmit={manejarConfiguracion} className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="m-0 text-sm font-semibold" style={{ color: "var(--text)" }}>{t.nota}</p>
                <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={generarCodigoConfirmacion}>
                  {t.enviarCodigo}
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="perfilUsername">{t.usuario}</label>
                  <input id="perfilUsername" value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label htmlFor="perfilEmail">{t.email}</label>
                  <input id="perfilEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label htmlFor="perfilPasswordActual">{t.contraseñaActual}</label>
                  <input id="perfilPasswordActual" type="password" value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label htmlFor="perfilPasswordNueva">{t.nuevaContrasena}</label>
                  <input id="perfilPasswordNueva" type="password" value={passwordNueva} onChange={(e) => setPasswordNueva(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label htmlFor="selectIdioma">{t.idioma}</label>
                  <select id="selectIdioma" value={idioma} onChange={(e) => setIdioma(e.target.value)} className="mt-1">
                    {LANGUAGES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="selectTema">{t.tema}</label>
                  <select id="selectTema" value={tema} onChange={(e) => setTema(e.target.value)} className="mt-1">
                    <option value="claro">{t.claro}</option>
                    <option value="oscuro">{t.oscuro}</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="codigoConfirmacion">{t.codigo}</label>
                  <input id="codigoConfirmacion" value={codigoConfirmacion} onChange={(e) => setCodigoConfirmacion(e.target.value)} className="mt-1" placeholder="123456" />
                </div>
                <div className="flex items-end">
                  <button type="submit" className="btn-primario w-full">{t.confirmar}</button>
                </div>
              </div>

              {codigoEnviado && (
                <p className="m-0 text-sm text-ambar">{translate(codigoEnviado === "sent" ? "Se envió un código de confirmación a tu correo." : codigoEnviado)}</p>
              )}
              {errorConfig && <p className="m-0 text-sm text-peligro">{translate(errorConfig)}</p>}
              {okConfig && <p className="m-0 text-sm text-exito">{translate(okConfig)}</p>}
            </form>

            {esAdmin && (
              <section className="mt-6 border-t border-[var(--border)] pt-5">
                <h3 className="text-lg">{translate("Agregar administrador o jefatura")}</h3>
                <p className="text-sm text-acero-claro">
                  {translate("La cuenta solo se crea después de introducir el código enviado al correo principal de aprobación. El código vence en 10 minutos y permite cinco intentos.")}
                </p>
                {!aprobacionRol ? (
                  <form onSubmit={solicitarAltaRol} className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="altaRolNombre">{translate("Nombre")}</label>
                      <input id="altaRolNombre" required maxLength="100" value={solicitudRol.nombre} onChange={(e) => setSolicitudRol({ ...solicitudRol, nombre: e.target.value })} />
                    </div>
                    <div>
                      <label htmlFor="altaRolUsername">{translate("Usuario")}</label>
                      <input id="altaRolUsername" required minLength="3" maxLength="50" value={solicitudRol.username} onChange={(e) => setSolicitudRol({ ...solicitudRol, username: e.target.value })} />
                    </div>
                    <div>
                      <label htmlFor="altaRolEmail">{translate("Correo del nuevo usuario")}</label>
                      <input id="altaRolEmail" type="email" required maxLength="254" value={solicitudRol.email} onChange={(e) => setSolicitudRol({ ...solicitudRol, email: e.target.value })} />
                    </div>
                    <div>
                      <label htmlFor="altaRol">{translate("Rol solicitado")}</label>
                      <select id="altaRol" value={solicitudRol.rol} onChange={(e) => setSolicitudRol({ ...solicitudRol, rol: e.target.value })}>
                        <option value="ADMIN">{translate("Administrador")}</option>
                        <option value="JEFE_ABASTECIMIENTO">{translate("Jefatura de abastecimiento")}</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="altaRolPassword">{translate("Contraseña temporal")}</label>
                      <input id="altaRolPassword" type="password" required minLength="8" value={solicitudRol.password} onChange={(e) => setSolicitudRol({ ...solicitudRol, password: e.target.value })} />
                    </div>
                    <div>
                      <label htmlFor="altaRolConfirmarPassword">{translate("Confirmar contraseña")}</label>
                      <input id="altaRolConfirmarPassword" type="password" required minLength="8" value={solicitudRol.confirmarPassword} onChange={(e) => setSolicitudRol({ ...solicitudRol, confirmarPassword: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="altaRolPasswordActual">{translate("Confirma con tu contraseña actual")}</label>
                      <input id="altaRolPasswordActual" type="password" required value={solicitudRol.passwordActual} onChange={(e) => setSolicitudRol({ ...solicitudRol, passwordActual: e.target.value })} />
                    </div>
                    <button type="submit" disabled={cargandoAprobacionRol} className="btn-primario sm:col-span-2">
                      {cargandoAprobacionRol ? translate("Enviando...") : translate("Enviar código al correo principal")}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={confirmarAltaRol} className="grid gap-4 sm:grid-cols-2">
                    <p className="sm:col-span-2 text-sm text-acero-claro">
                      {translate("Introduce el código enviado a")} {aprobacionRol.correoEnmascarado}.
                    </p>
                    <div>
                      <label htmlFor="codigoAprobacionRol">{translate("Código de aprobación")}</label>
                      <input
                        id="codigoAprobacionRol"
                        required
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength="6"
                        pattern="[0-9]{6}"
                        value={codigoAprobacionRol}
                        onChange={(e) => setCodigoAprobacionRol(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      />
                    </div>
                    <div className="flex items-end">
                      <button type="submit" disabled={cargandoAprobacionRol || codigoAprobacionRol.length !== 6} className="btn-primario w-full">
                        {cargandoAprobacionRol ? translate("Verificando...") : translate("Aprobar y crear cuenta")}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary sm:col-span-2"
                      disabled={cargandoAprobacionRol}
                      onClick={() => {
                        setAprobacionRol(null);
                        setCodigoAprobacionRol("");
                        setErrorAprobacionRol("");
                        setOkAprobacionRol("");
                      }}
                    >
                      {translate("Cancelar y solicitar otro código")}
                    </button>
                  </form>
                )}
                {errorAprobacionRol && <p role="alert" className="mt-3 text-sm text-peligro">{translate(errorAprobacionRol)}</p>}
                {okAprobacionRol && <p role="status" className="mt-3 text-sm text-exito">{translate(okAprobacionRol)}</p>}
              </section>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
