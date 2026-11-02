import { useState, type FormEvent } from "react";
import { AuthApiError, login, signup } from "../../api/auth";
import { Button } from "../../components/common/Button";
import { Field } from "../../components/common/Field";
import { Icon } from "../../components/common/Icon";
import { saveAuthSession } from "../../store/authStore";
import { AuthLayout, type AuthMode } from "./AuthLayout";
import "./AuthPage.css";

type FieldErrors = Partial<Record<"nickname" | "email" | "password", string>>;

function validateNickname(value: string) {
  const nickname = value.trim();
  if (!nickname) return "닉네임을 입력해 주세요.";
  if (nickname.length > 12) return "닉네임은 12자 이하로 입력해 주세요.";
  return "";
}

function validateEmail(value: string) {
  const email = value.trim();
  if (!email) return "이메일을 입력해 주세요.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "이메일 형식을 확인해 주세요.";
  return "";
}

function validatePassword(value: string) {
  if (!value) return "비밀번호를 입력해 주세요.";
  if (value.length < 8) return "비밀번호는 8자 이상 입력해 주세요.";
  if (value.length > 72) return "비밀번호는 72자 이하로 입력해 주세요.";
  return "";
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const isSignup = mode === "signup";
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const formReady = (!isSignup || !validateNickname(nickname))
    && !validateEmail(email) && !validatePassword(password);

  function updateField(name: keyof FieldErrors, value: string, setter: (next: string) => void) {
    setter(value);
    if (fieldErrors[name]) setFieldErrors(current => ({ ...current, [name]: undefined }));
    if (formError) setFormError("");
  }

  function validateField(name: keyof FieldErrors) {
    const message = name === "nickname" ? validateNickname(nickname)
      : name === "email" ? validateEmail(email) : validatePassword(password);
    setFieldErrors(current => ({ ...current, [name]: message || undefined }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const nextErrors: FieldErrors = {
      ...(isSignup ? { nickname: validateNickname(nickname) || undefined } : {}),
      email: validateEmail(email) || undefined,
      password: validatePassword(password) || undefined,
    };
    setFieldErrors(nextErrors);
    const firstInvalid = (isSignup ? ["nickname", "email", "password"] : ["email", "password"])
      .find(name => nextErrors[name as keyof FieldErrors]);
    if (firstInvalid) {
      document.getElementById(`auth-${firstInvalid}`)?.focus();
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const session = isSignup
        ? await signup(nickname.trim(), email.trim(), password)
        : await login(email.trim(), password);
      saveAuthSession(session);
      window.location.hash = "";
    } catch (reason) {
      if (isSignup && reason instanceof AuthApiError && reason.status === 409) {
        setFieldErrors(current => ({ ...current, email: reason.message }));
        document.getElementById("auth-email")?.focus();
      } else {
        setFormError(reason instanceof Error ? reason.message : "요청을 처리하지 못했어요.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return <AuthLayout mode={mode}>
      <header className="auth-panel__header">
        <h2>{isSignup ? "회원가입" : "로그인"}</h2>
        <p>{isSignup ? "나만의 산행 기록을 시작해 보세요." : "트레일맵과 다시 산길을 이어가세요."}</p>
      </header>
      <form className="auth-form" onSubmit={submit} noValidate aria-busy={submitting}>
        {isSignup && <Field id="auth-nickname" label="닉네임" showIcon={false} autoComplete="nickname"
          maxLength={12} placeholder="최대 12자" value={nickname}
          state={fieldErrors.nickname ? "error" : nickname ? "value" : "empty"}
          helper={fieldErrors.nickname ?? "한글, 영문, 숫자를 포함해 최대 12자"} showHelper
          onBlur={() => validateField("nickname")}
          onChange={event => updateField("nickname", event.target.value, setNickname)} />}
        <Field id="auth-email" label="이메일" showIcon={false} type="email" inputMode="email"
          autoComplete="email" autoCapitalize="none" spellCheck={false} required
          placeholder="name@example.com" value={email}
          state={fieldErrors.email ? "error" : email ? "value" : "empty"}
          helper={fieldErrors.email ?? ""} showHelper={Boolean(fieldErrors.email)}
          onBlur={() => validateField("email")}
          onChange={event => updateField("email", event.target.value, setEmail)} />
        <Field id="auth-password" label="비밀번호" showIcon={false}
          type={passwordVisible ? "text" : "password"}
          autoComplete={isSignup ? "new-password" : "current-password"} required minLength={8} maxLength={72}
          placeholder="8자 이상 입력" value={password}
          state={fieldErrors.password ? "error" : password ? "value" : "empty"}
          helper={fieldErrors.password ?? (isSignup ? "8~72자로 입력해 주세요." : "")}
          showHelper={Boolean(fieldErrors.password) || isSignup}
          onBlur={() => validateField("password")}
          onChange={event => updateField("password", event.target.value, setPassword)}
          trailingControl={<button type="button" className="auth-form__password-toggle"
            aria-label={passwordVisible ? "비밀번호 숨기기" : "비밀번호 보기"}
            aria-pressed={passwordVisible} onClick={() => setPasswordVisible(current => !current)}>
            <Icon name={passwordVisible ? "EyeOff" : "Eye"} size={20} color="currentColor" />
          </button>} />
        {formError && <p className="auth-form__error" role="alert">{formError}</p>}
        <Button type="submit" fullWidth disabled={submitting || !formReady}>
          {submitting && <span className="auth-form__spinner" aria-hidden="true" />}
          {submitting ? (isSignup ? "가입하는 중" : "로그인 중") : isSignup ? "가입하기" : "로그인"}
        </Button>
      </form>
      <p className="auth-panel__switch">
        {isSignup ? "이미 계정이 있나요?" : "아직 계정이 없나요?"}
        <a href={isSignup ? "#login" : "#signup"}>{isSignup ? "로그인" : "회원가입"}</a>
      </p>
  </AuthLayout>;
}
