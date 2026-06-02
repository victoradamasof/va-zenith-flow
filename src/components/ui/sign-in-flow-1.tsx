import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserPassword, type LoginUser } from "@/lib/auth";

type SignInPageProps = {
  users: LoginUser[];
  onAuthenticated: (user: LoginUser) => void;
  className?: string;
};

function CanvasRevealEffect() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <motion.div
        className="absolute inset-[-20%] opacity-70"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,122,36,0.55) 1px, transparent 1.8px)",
          backgroundSize: "26px 26px",
        }}
        animate={{ backgroundPosition: ["0px 0px", "104px 78px"] }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,122,36,0.20),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.08),transparent_24%),linear-gradient(180deg,rgba(0,0,0,0.25),#050201_80%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black to-transparent" />
    </div>
  );
}

type RipplePoint = {
  id: number;
  x: number;
  y: number;
};

function SerenityLoginEffects() {
  const [mouseGradientStyle, setMouseGradientStyle] = useState({
    left: "50%",
    top: "50%",
    opacity: 0,
  });
  const [ripples, setRipples] = useState<RipplePoint[]>([]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setMouseGradientStyle({
        left: `${event.clientX}px`,
        top: `${event.clientY}px`,
        opacity: 1,
      });
    };
    const handleMouseLeave = () => {
      setMouseGradientStyle((current) => ({ ...current, opacity: 0 }));
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const ripple = { id: Date.now(), x: event.clientX, y: event.clientY };
      setRipples((current) => [...current, ripple]);
      window.setTimeout(() => {
        setRipples((current) => current.filter((item) => item.id !== ripple.id));
      }, 900);
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern id="va-login-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,122,36,0.08)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#va-login-grid)" />
        <line x1="0" y1="20%" x2="100%" y2="20%" className="login-grid-line" />
        <line x1="0" y1="80%" x2="100%" y2="80%" className="login-grid-line delay-200" />
        <line x1="20%" y1="0" x2="20%" y2="100%" className="login-grid-line delay-400" />
        <line x1="80%" y1="0" x2="80%" y2="100%" className="login-grid-line delay-600" />
        <line x1="50%" y1="0" x2="50%" y2="100%" className="login-grid-line opacity-40 delay-700" />
        <line
          x1="0"
          y1="50%"
          x2="100%"
          y2="50%"
          className="login-grid-line opacity-40 delay-1000"
        />
        <circle cx="20%" cy="20%" r="2" className="login-detail-dot" />
        <circle cx="80%" cy="20%" r="2" className="login-detail-dot delay-200" />
        <circle cx="20%" cy="80%" r="2" className="login-detail-dot delay-500" />
        <circle cx="80%" cy="80%" r="2" className="login-detail-dot delay-700" />
        <circle cx="50%" cy="50%" r="1.5" className="login-detail-dot delay-1000" />
      </svg>

      <div className="login-corner left-5 top-5 sm:left-8 sm:top-8" />
      <div className="login-corner right-5 top-5 rotate-90 sm:right-8 sm:top-8" />
      <div className="login-corner bottom-5 left-5 -rotate-90 sm:bottom-8 sm:left-8" />
      <div className="login-corner bottom-5 right-5 rotate-180 sm:bottom-8 sm:right-8" />

      <span className="login-floating left-[15%] top-[25%]" />
      <span className="login-floating left-[86%] top-[62%] delay-300" />
      <span className="login-floating left-[10%] top-[48%] delay-700" />
      <span className="login-floating left-[90%] top-[76%] delay-1000" />

      <div className="login-mouse-gradient" style={mouseGradientStyle} />

      {ripples.map((ripple) => (
        <span key={ripple.id} className="login-ripple" style={{ left: ripple.x, top: ripple.y }} />
      ))}
    </div>
  );
}

function MiniNavbar() {
  return (
    <div
      className="word-animate login-reveal-block fixed inset-x-0 top-6 z-20 flex justify-center px-4"
      data-delay={2600}
      style={{
        opacity: 0,
        transform: "translateY(30px) scale(0.8)",
        filter: "blur(10px)",
      }}
    >
      <header className="flex w-full items-center justify-between rounded-full border border-white/10 bg-black/45 px-4 py-3 shadow-2xl backdrop-blur-xl sm:w-auto sm:gap-10">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-primary/40 bg-black shadow-glow">
            <img
              src="/va-consultoria-mark.png"
              alt="VA Consultoria"
              className="h-7 w-7 object-contain"
              draggable={false}
            />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">VA Consultoria</p>
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Manager</p>
          </div>
        </div>
        <nav className="hidden items-center gap-6 text-xs text-white/55 sm:flex">
          <a href="#seguranca" className="transition hover:text-white">
            Segurança
          </a>
          <a href="#financeiro" className="transition hover:text-white">
            Financeiro
          </a>
          <a href="#crm" className="transition hover:text-white">
            CRM
          </a>
        </nav>
      </header>
    </div>
  );
}

function RevealBlock({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={cn("word-animate login-reveal-block", className)}
      data-delay={delay}
      style={{
        opacity: 0,
        transform: "translateY(30px) scale(0.8)",
        filter: "blur(10px)",
      }}
    >
      {children}
    </div>
  );
}

function AnimatedWord({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <span
      className="word-animate"
      data-delay={delay}
      style={{
        opacity: 0,
        transform: "translateY(30px) scale(0.8)",
        filter: "blur(10px)",
      }}
    >
      {children}
    </span>
  );
}

function LoginButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
      <motion.button
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.985 }}
        className={cn(
          "group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full border border-primary/55 px-5 text-sm font-semibold shadow-2xl shadow-primary/20 transition disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-full" />
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.24),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.1),transparent_55%,rgba(0,0,0,0.22))] opacity-80" />
        <span className="relative z-10 inline-flex items-center justify-center">{children}</span>
      </motion.button>
    );
  }

export function SignInPage({ users, onAuthenticated, className }: SignInPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");
  const [error, setError] = useState("");

  useEffect(() => {
    const animateWords = () => {
      const wordElements = document.querySelectorAll<HTMLElement>(".word-animate");
      wordElements.forEach((word) => {
        word.style.animation = "none";
        word.style.opacity = "0";
        word.style.transform = "translateY(30px) scale(0.8)";
        word.style.filter = "blur(10px)";
        const delay = Number.parseInt(word.getAttribute("data-delay") ?? "0", 10) || 0;
        window.setTimeout(() => {
          word.style.animation = "word-appear 0.8s ease-out forwards";
        }, delay);
      });
    };

    const timeoutId = window.setTimeout(animateWords, 500);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const wordElements = document.querySelectorAll<HTMLElement>(".word-animate");
    const handleMouseEnter = (event: Event) => {
      const target = event.currentTarget as HTMLElement;
      target.style.textShadow = "0 0 20px color-mix(in oklab, var(--primary) 46%, transparent)";
    };
    const handleMouseLeave = (event: Event) => {
      const target = event.currentTarget as HTMLElement;
      target.style.textShadow = "none";
    };

    wordElements.forEach((word) => {
      word.addEventListener("mouseenter", handleMouseEnter);
      word.addEventListener("mouseleave", handleMouseLeave);
    });
    return () => {
      wordElements.forEach((word) => {
        word.removeEventListener("mouseenter", handleMouseEnter);
        word.removeEventListener("mouseleave", handleMouseLeave);
      });
    };
  }, []);

  const activeUsers = useMemo(
    () =>
      users.filter(
        (user) => user.status.trim().toLowerCase() === "ativo" && user.email.trim(),
      ),
    [users],
  );
  const handleLoginSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetEmail = email.trim().toLowerCase();
    const targetPassword = password.trim();
    const user = activeUsers.find((item) => item.email.trim().toLowerCase() === targetEmail);

    if (!user) {
      setError("E-mail não encontrado ou usuário inativo.");
      return;
    }

    if (targetPassword !== getUserPassword(user).trim()) {
      setError("Senha incorreta.");
      return;
    }

    setError("");
    setStep("success");
    window.setTimeout(() => onAuthenticated(user), 650);
  };

  return (
    <div
      className={cn(
        "relative flex min-h-screen w-full flex-col overflow-hidden bg-black",
        className,
      )}
    >
      <CanvasRevealEffect />
      <SerenityLoginEffects />
      <MiniNavbar />

      <main className="relative z-10 flex min-h-screen items-center px-6 py-28">
        <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <section className="hidden lg:block">
            <div className="max-w-xl">
              <p className="mb-5 font-mono text-xs uppercase tracking-[0.28em] text-white/45">
                <AnimatedWord delay={0}>Controle</AnimatedWord>
                <AnimatedWord delay={180}>.</AnimatedWord>
                <AnimatedWord delay={320}>clareza</AnimatedWord>
                <AnimatedWord delay={500}>.</AnimatedWord>
                <AnimatedWord delay={640}>escala</AnimatedWord>
              </p>
              <RevealBlock
                delay={360}
                className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              >
                <Sparkles className="h-3.5 w-3.5" />
                ERP financeiro conectado em tempo real
              </RevealBlock>
              <h1 className="text-decoration-animate font-display text-6xl font-bold tracking-tight text-white">
                <div className="mb-4">
                  <AnimatedWord delay={700}>Controle</AnimatedWord>
                  <AnimatedWord delay={850}>total</AnimatedWord>
                  <AnimatedWord delay={1000}>da</AnimatedWord>
                  <AnimatedWord delay={1150}>VA</AnimatedWord>
                </div>
                <div className="text-5xl font-light leading-tight text-white/78">
                  <AnimatedWord delay={1400}>em</AnimatedWord>
                  <AnimatedWord delay={1550}>uma</AnimatedWord>
                  <AnimatedWord delay={1700}>única</AnimatedWord>
                  <AnimatedWord delay={1850}>plataforma.</AnimatedWord>
                </div>
              </h1>
              <h1 className="sr-only">Controle total da VA em uma única plataforma.</h1>
              <RevealBlock delay={2050} className="mt-5 max-w-lg text-base leading-7 text-white/58">
                Financeiro, vendas, CRM, metas, caixa e alertas protegidos por login de equipe.
              </RevealBlock>
              <div className="mt-8 grid max-w-lg gap-3 sm:grid-cols-3">
                {["Caixa", "Vendas", "CRM"].map((item, index) => (
                  <div
                    key={item}
                    className="word-animate login-reveal-block rounded-xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur"
                    data-delay={2300 + index * 160}
                    style={{
                      opacity: 0,
                      transform: "translateY(30px) scale(0.8)",
                      filter: "blur(10px)",
                    }}
                  >
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <p className="mt-3 text-sm font-medium text-white">{item}</p>
                    <p className="mt-1 text-xs text-white/45">Acesso seguro</p>
                  </div>
                ))}
              </div>
              <p className="mt-8 font-mono text-xs uppercase tracking-[0.24em] text-white/35">
                <AnimatedWord delay={2200}>Dados</AnimatedWord>
                <AnimatedWord delay={2380}>organizados,</AnimatedWord>
                <AnimatedWord delay={2560}>decisões</AnimatedWord>
                <AnimatedWord delay={2740}>mais</AnimatedWord>
                <AnimatedWord delay={2920}>rápidas.</AnimatedWord>
              </p>
            </div>
          </section>

          <section className="mx-auto w-full max-w-md">
            <div
              className="word-animate login-reveal-block rounded-[2rem] border border-white/10 bg-black/45 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
              data-delay={2150}
              style={{
                opacity: 0,
                transform: "translateY(30px) scale(0.8)",
                filter: "blur(10px)",
              }}
            >
              <AnimatePresence mode="wait">
                {step === "form" ? (
                  <motion.div
                    key="login-step"
                    initial={{ opacity: 0, x: -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="space-y-6 text-center"
                  >
                    <div className="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border border-primary/35 bg-black shadow-glow">
                      <img
                        src="/va-consultoria-logo-cropped.png"
                        alt="VA Consultoria"
                        className="h-16 w-16 object-contain"
                      />
                    </div>
                    <div className="space-y-2">
                      <h2 className="font-display text-3xl font-bold tracking-tight text-white">
                        Acesse o Manager
                      </h2>
                      <p className="text-sm text-white/52">
                        Entre com e-mail e senha cadastrados em Usuários.
                      </p>
                    </div>

                    <form onSubmit={handleLoginSubmit} className="space-y-3">
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                        <input
                          type="email"
                          placeholder="vinicius@vaconsultoria.com"
                          value={email}
                          onChange={(event) => {
                            setEmail(event.target.value);
                            setError("");
                          }}
                          className="h-12 w-full rounded-full border border-white/10 bg-white/[0.035] px-11 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-primary/60"
                          required
                        />
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Senha"
                          value={password}
                          onChange={(event) => {
                            setPassword(event.target.value);
                            setError("");
                          }}
                          className="h-12 w-full rounded-full border border-white/10 bg-white/[0.035] px-11 pr-14 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-primary/60"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((current) => !current)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/45 transition hover:text-white"
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {error && <p className="text-xs text-destructive">{error}</p>}
                      <LoginButton
                        type="submit"
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        Entrar no sistema
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </LoginButton>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div
                    key="success-step"
                    initial={{ opacity: 0, y: 25 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="space-y-6 text-center"
                  >
                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow">
                      <Check className="h-8 w-8" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="font-display text-3xl font-bold tracking-tight text-white">
                        Acesso liberado
                      </h2>
                      <p className="text-sm text-white/52">Abrindo o painel da VA Consultoria.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
