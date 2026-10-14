import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/api.js";
import { useAuth } from "../api/AuthContext.jsx";
import { LANGUAGES, useLanguage } from "../api/LanguageContext.jsx";
import { BlurText, GradientText, LogoCintac, ShinyText, SpotlightCard } from "../components/bits.jsx";
import { aplicarTema, temaInicial } from "../utils/tema.js";

const textos = {
  es: {
    acceso: "Cotizador de flete de importación — acceso Cintac",
    correo: "Correo o usuario",
    nombre: "Nombre",
    usuario: "Usuario",
    correoRegistro: "Correo electrónico",
    password: "Contraseña",
    confirmarPassword: "Confirmar contraseña",
    passwordPlaceholder: "Contraseña",
    crearCuenta: "Crear cuenta",
    ingresar: "Ingresar",
    volver: "Volver al inicio de sesión",
    alternar: "Crear una cuenta",
    idioma: "Idioma",
    tema: "Tema",
    claro: "Claro",
    oscuro: "Oscuro",
    recordar: "Mantener sesión activa",
    fallos1: "Credenciales incorrectas.",
    fallos2: "Te quedan",
    fallos3: "intentos antes de poder restablecer la contraseña.",
    errorBloqueo: "Has superado 5 intentos. Cambia tu contraseña para continuar.",
    cambiarPassword: "Cambiar contraseña",
    actual: "Contraseña actual",
    nueva: "Nueva contraseña",
    restablecer: "Guardar nueva contraseña",
    exitoReset: "Contraseña actualizada correctamente.",
    recuperarLink: "¿Olvidaste tu contraseña?",
    enviarCodigo: "Enviar código",
    codigoRecibido: "Código recibido",
    confirmarCambio: "Confirmar cambio",
    descripcionReset: "Te enviaremos un código de verificación a tu correo para cambiar la contraseña sin pedir la actual.",
  },
  en: {
    acceso: "Import freight quote — Cintac access",
    correo: "Email or username",
    nombre: "Name",
    usuario: "Username",
    correoRegistro: "Email",
    password: "Password",
    confirmarPassword: "Confirm password",
    passwordPlaceholder: "Password",
    crearCuenta: "Create account",
    ingresar: "Log in",
    volver: "Back to login",
    alternar: "Create an account",
    idioma: "Language",
    tema: "Theme",
    claro: "Light",
    oscuro: "Dark",
    recordar: "Keep session active",
    fallos1: "Incorrect credentials.",
    fallos2: "You have",
    fallos3: "attempts left before you can reset the password.",
    errorBloqueo: "You exceeded 5 attempts. Change your password to continue.",
    cambiarPassword: "Change password",
    actual: "Current password",
    nueva: "New password",
    restablecer: "Save new password",
    exitoReset: "Password updated successfully.",
    recuperarLink: "Forgot your password?",
    enviarCodigo: "Send code",
    codigoRecibido: "Code received",
    confirmarCambio: "Confirm change",
    descripcionReset: "We will send a verification code to your email so you can change the password without entering the current one.",
  },
  ru: {
    acceso: "Калькулятор фрахта — доступ Cintac",
    correo: "Эл. почта или логин",
    nombre: "Имя",
    usuario: "Логин",
    correoRegistro: "Эл. почта",
    password: "Пароль",
    confirmarPassword: "Подтвердите пароль",
    passwordPlaceholder: "Пароль",
    crearCuenta: "Создать аккаунт",
    ingresar: "Войти",
    volver: "Назад к входу",
    alternar: "Создать аккаунт",
    idioma: "Язык",
    tema: "Тема",
    claro: "Светлая",
    oscuro: "Тёмная",
    recordar: "Сохранить сеанс",
    fallos1: "Неверные данные.",
    fallos2: "У вас осталось",
    fallos3: "попыток до сброса пароля.",
    errorBloqueo: "Вы превысили 5 попыток. Смените пароль, чтобы продолжить.",
    cambiarPassword: "Сменить пароль",
    actual: "Текущий пароль",
    nueva: "Новый пароль",
    restablecer: "Сохранить новый пароль",
    exitoReset: "Пароль успешно обновлён.",
    recuperarLink: "Забыли пароль?",
    enviarCodigo: "Отправить код",
    codigoRecibido: "Полученный код",
    confirmarCambio: "Подтвердить смену",
    descripcionReset: "Мы отправим код подтверждения на вашу почту, чтобы вы могли сменить пароль без ввода текущего.",
  },
  zh: {
    acceso: "进口运费报价器 — Cintac 登录",
    correo: "电子邮件或用户名",
    nombre: "姓名",
    usuario: "用户名",
    correoRegistro: "电子邮件",
    password: "密码",
    confirmarPassword: "确认密码",
    passwordPlaceholder: "密码",
    crearCuenta: "创建账户",
    ingresar: "登录",
    volver: "返回登录",
    alternar: "创建账户",
    idioma: "语言",
    tema: "主题",
    claro: "浅色",
    oscuro: "深色",
    recordar: "保持会话激活",
    fallos1: "凭据不正确。",
    fallos2: "你还有",
    fallos3: "次机会可在重置密码前使用。",
    errorBloqueo: "你已超过 5 次尝试。修改密码后再继续。",
    cambiarPassword: "修改密码",
    actual: "当前密码",
    nueva: "新密码",
    restablecer: "保存新密码",
    exitoReset: "密码已成功更新。",
    recuperarLink: "忘记密码？",
    enviarCodigo: "发送验证码",
    codigoRecibido: "收到的验证码",
    confirmarCambio: "确认更改",
    descripcionReset: "我们会将验证码发送到您的邮箱，随后可在不输入当前密码的情况下完成修改。",
  },
  ja: {
    acceso: "輸入運賃見積もり — CINTACログイン",
    correo: "メールアドレスまたはユーザー名",
    nombre: "氏名",
    usuario: "ユーザー名",
    correoRegistro: "メールアドレス",
    password: "パスワード",
    confirmarPassword: "パスワードを確認",
    passwordPlaceholder: "パスワード",
    crearCuenta: "アカウントを作成",
    ingresar: "ログイン",
    volver: "ログインに戻る",
    alternar: "アカウントを作成",
    idioma: "言語",
    tema: "テーマ",
    claro: "ライト",
    oscuro: "ダーク",
    recordar: "ログイン状態を保持",
    fallos1: "ユーザー名またはパスワードが正しくありません。",
    fallos2: "残り",
    fallos3: "回試行できます。その後パスワードを再設定してください。",
    errorBloqueo: "試行回数の上限に達しました。続行するにはパスワードを変更してください。",
    cambiarPassword: "パスワードを変更",
    actual: "現在のパスワード",
    nueva: "新しいパスワード",
    restablecer: "新しいパスワードを保存",
    exitoReset: "パスワードを更新しました。",
    recuperarLink: "パスワードをお忘れですか？",
    enviarCodigo: "コードを送信",
    codigoRecibido: "受信したコード",
    confirmarCambio: "変更を確認",
    descripcionReset: "登録メールアドレスに確認コードを送信します。",
  },
};
const MAX_INTENTOS = 5;

function obtenerRutaInicial(usuario) {
  return ["ADMIN", "SUPERADMIN", "administrador"].includes(usuario?.rol) ? "/admin" : "/";
}

export default function Login() {
  const [modo, setModo] = useState("login");
  const [identifier, setIdentifier] = useState("");
  const [nombre, setNombre] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [tema, setTema] = useState(temaInicial);
  const [rememberMe, setRememberMe] = useState(localStorage.getItem("cintac-remember") === "true");
  const [intentosFallidos, setIntentosFallidos] = useState(Number(localStorage.getItem("cintac-login-fails") || 0));
  const [mostrarCambioPassword, setMostrarCambioPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetCodigo, setResetCodigo] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetNuevaPassword, setResetNuevaPassword] = useState("");
  const [resetOk, setResetOk] = useState("");
  const [codigoGenerado, setCodigoGenerado] = useState("");
  const { usuario, iniciarSesion } = useAuth();
  const { language: idioma, setLanguage: setIdioma, t: translate } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (usuario) {
      limpiarIntentos();
      navigate(obtenerRutaInicial(usuario), { replace: true });
    }
  }, [usuario, navigate]);

  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);

  useEffect(() => {
    localStorage.setItem("cintac-remember", String(Boolean(rememberMe)));
  }, [rememberMe]);

  const t = textos[idioma] || textos.es;

  function limpiarIntentos() {
    localStorage.removeItem("cintac-login-fails");
    setIntentosFallidos(0);
    setMostrarCambioPassword(false);
    setResetEmail("");
    setResetCodigo("");
    setResetPassword("");
    setResetNuevaPassword("");
    setCodigoGenerado("");
    setResetOk("");
  }

  async function manejarEnvio(e) {
    e.preventDefault();
    setError("");
    setResetOk("");
    setCargando(true);
    try {
      if (modo === "registro") {
        if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
            setError("La nueva contraseña debe tener al menos 8 caracteres e incluir letras y números.");
          return;
        }
        if (password !== confirmarPassword) {
            setError("Las contraseñas no coinciden.");
          return;
        }
        const { token, usuario } = await api.registrar({ nombre, username, email, password, confirmarPassword });
        iniciarSesion(token, usuario, rememberMe);
        limpiarIntentos();
        navigate(obtenerRutaInicial(usuario));
        return;
      }

      const { token, usuario } = await api.login(identifier, password);
      iniciarSesion(token, usuario, rememberMe);
      limpiarIntentos();
      navigate(obtenerRutaInicial(usuario));
    } catch (err) {
      const proximoNumero = intentosFallidos + 1;
      localStorage.setItem("cintac-login-fails", String(proximoNumero));
      setIntentosFallidos(proximoNumero);

      if (proximoNumero >= MAX_INTENTOS) {
          setError("__loginLocked");
        setMostrarCambioPassword(true);
        return;
      }

      const restantes = MAX_INTENTOS - proximoNumero;
        setError("__loginFailure");
    } finally {
      setCargando(false);
    }
  }

  async function manejarCodigoReset(e) {
    e.preventDefault();
    setError("");
    setResetOk("");

    const correoDestino = (resetEmail || email || "").trim();
    if (!correoDestino) {
        setError("Debes ingresar tu correo electrónico.");
      return;
    }

    try {
      await api.solicitarCodigoReset({ email: correoDestino });
      setCodigoGenerado("enviado");
        setResetOk("Si la cuenta existe, enviaremos un código al correo registrado.");
    } catch (err) {
        setError(err.message);
    }
  }

  async function manejarCambioPasswordBloqueado(e) {
    e.preventDefault();
    setError("");
    setResetOk("");
    try {
      const correoDestino = (resetEmail || email || "").trim();
      const { token, usuario } = await api.reestablecerPassword({
        email: correoDestino,
        codigo: resetCodigo,
        nuevaPassword: resetNuevaPassword,
      });
      iniciarSesion(token, usuario, rememberMe);
      limpiarIntentos();
        setResetOk("Contraseña actualizada correctamente.");
      setMostrarCambioPassword(false);
      navigate(obtenerRutaInicial(usuario));
    } catch (err) {
        setError(err.message);
    }
  }

  return (
    <div className="login-page">
      <section className="login-hero fade-up">
        <LogoCintac size={48} />
        <div className="mt-8">
          <span className="chip"><span className="chip__dot" />{translate("Comercio Exterior · Importación marítima")}</span>
        </div>
        <BlurText as="h1" text={translate("Cotiza tu flete de importación")} />
        <p>
          <ShinyText>{translate("Compara embarcadores, calcula contenedores e internación en CLP con el dólar del día.")}</ShinyText>
        </p>
        <div className="login-features">
          <SpotlightCard><strong>25 t</strong><span>{translate("por contenedor, editable")}</span></SpotlightCard>
          <SpotlightCard><strong>CIF + IVA</strong><span>{translate("según reglas de Comex")}</span></SpotlightCard>
          <SpotlightCard><strong>PDF · Excel</strong><span>{translate("exporta el desglose")}</span></SpotlightCard>
        </div>
      </section>

      <div className="login-shell fade-up" style={{ animationDelay: "120ms" }}>
      <form onSubmit={manejarEnvio} className="tarjeta login-card">
        <h2>
          {modo === "registro" ? t.crearCuenta : <GradientText>{t.ingresar}</GradientText>}
        </h2>
        <p className="login-subtitle">{t.acceso}</p>
        {modo === "registro" ? (
          <>
            <div>
              <label htmlFor="nombre">{t.nombre}</label>
              <input
                id="nombre"
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="mt-1"
                placeholder={t.nombre}
              />
            </div>

            <div>
              <label htmlFor="username">{t.usuario}</label>
              <input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1"
                placeholder={translate("usuario_cintac")}
              />
            </div>

            <div>
              <label htmlFor="emailRegistro">{t.correoRegistro}</label>
              <input
                id="emailRegistro"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                placeholder={translate("nombre@cintac.cl")}
              />
            </div>
          </>
        ) : (
          <div>
            <label htmlFor="identifier">{t.correo}</label>
            <input
              id="identifier"
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="mt-1"
              placeholder={translate("usuario o nombre@cintac.cl")}
            />
          </div>
        )}

        <div>
          <label htmlFor="password">{t.password}</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1"
            placeholder={t.passwordPlaceholder}
          />
        </div>

        {modo === "registro" && (
          <div>
            <label htmlFor="confirmarPassword">{t.confirmarPassword}</label>
            <input
              id="confirmarPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              className="mt-1"
            />
          </div>
        )}

        <label className="mt-4 flex items-center gap-3 text-left">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4"
          />
          <span>{t.recordar}</span>
        </label>

        {error && (
          <p role="alert" className="alerta mt-3">
            {error === "__loginLocked"
              ? t.errorBloqueo
              : error === "__loginFailure"
                ? `${t.fallos1} ${t.fallos2} ${Math.max(0, MAX_INTENTOS - intentosFallidos)} ${t.fallos3}`
                : translate(error)}
          </p>
        )}

        {intentosFallidos >= MAX_INTENTOS && (
          <button
            type="button"
            className="link-suave mt-3 text-left"
            onClick={() => setMostrarCambioPassword((prev) => !prev)}
          >
            {t.recuperarLink}
          </button>
        )}

        <button type="submit" disabled={cargando} className="btn-primario">
          {cargando ? "Procesando..." : modo === "registro" ? t.crearCuenta : t.ingresar}
        </button>
      </form>

      {mostrarCambioPassword && (
        <form onSubmit={codigoGenerado ? manejarCambioPasswordBloqueado : manejarCodigoReset} className="tarjeta mt-4 w-full">
          <h3 className="mb-2 text-left text-base">{t.cambiarPassword}</h3>
          <p className="mb-3 text-left text-xs text-acero-claro">{t.descripcionReset}</p>
          <div>
            <label htmlFor="resetEmail">{t.correoRegistro}</label>
            <input
              id="resetEmail"
              type="email"
              required
              value={resetEmail || email || ""}
              onChange={(e) => setResetEmail(e.target.value)}
              className="mt-1"
              placeholder={translate("usuario@cintac.cl")}
            />
          </div>

          {!codigoGenerado ? (
            <button type="submit" className="btn-secundario mt-3 w-full">{t.enviarCodigo}</button>
          ) : (
            <>
              <div>
                <label htmlFor="resetCodigo">{t.codigoRecibido}</label>
                <input
                  id="resetCodigo"
                  type="text"
                  required
                  value={resetCodigo}
                  onChange={(e) => setResetCodigo(e.target.value)}
                  className="mt-1"
                  placeholder="123456"
                />
              </div>
              <div>
                <label htmlFor="resetNuevaPassword">{t.nueva}</label>
                <input
                  id="resetNuevaPassword"
                  type="password"
                  required
                  value={resetNuevaPassword}
                  onChange={(e) => setResetNuevaPassword(e.target.value)}
                  className="mt-1"
                />
              </div>
              <button type="submit" className="btn-primario mt-3 w-full">{t.confirmarCambio}</button>
            </>
          )}
          {resetOk && <p className="mt-3 text-sm text-exito">{resetOk}</p>}
        </form>
      )}

      <div className="mt-4 flex w-full gap-2">
        <div className="flex-1">
          <label htmlFor="loginIdioma">{t.idioma}</label>
          <select id="loginIdioma" value={idioma} onChange={(e) => setIdioma(e.target.value)}>
            {LANGUAGES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="loginTema">{t.tema}</label>
          <select id="loginTema" value={tema} onChange={(e) => setTema(e.target.value)}>
            <option value="claro">{t.claro}</option>
            <option value="oscuro">{t.oscuro}</option>
          </select>
        </div>
      </div>

      {modo === "registro" ? (
        <button
          type="button"
          className="btn-secundario mt-4 w-full"
          onClick={() => {
            setError("");
            setPassword("");
            setModo("login");
          }}
        >
          {t.volver}
        </button>
      ) : (
        <button
          type="button"
          className="link-suave mt-4 block w-full text-center"
          onClick={() => {
            setError("");
            setModo("registro");
          }}
        >
          {t.alternar}
        </button>
      )}
      </div>
    </div>
  );
}
