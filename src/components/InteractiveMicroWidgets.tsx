import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent,
  type ChangeEvent,
  type ReactNode,
} from "react";

/* =========================================================================
   1. GLOWING COMET TAB BAR
   A glowing comet streaks to the active tab, leaving a fading tail of light.
   ========================================================================= */

export interface CometTab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
}

export interface CometTabBarProps {
  tabs: readonly CometTab[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function CometTabBar({ tabs, activeId, onChange, className = "" }: CometTabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cometStyle, setCometStyle] = useState<{ left: number; width: number; height: number; top: number }>({
    left: 0,
    width: 0,
    height: 0,
    top: 0,
  });
  const [isStreaking, setIsStreaking] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const activeEl = containerRef.current.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`);
    if (activeEl) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();

      setIsStreaking(true);
      setCometStyle({
        left: activeRect.left - containerRect.left,
        width: activeRect.width,
        height: activeRect.height,
        top: activeRect.top - containerRect.top,
      });

      const timer = setTimeout(() => {
        setIsStreaking(false);
      }, 650);
      return () => clearTimeout(timer);
    }
  }, [activeId, tabs]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={`comet-tab-bar ${className}`}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 6px",
        background: "var(--c-surface-soft)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--c-border)",
      }}
    >
      {/* Comet Streak with Fading Tail */}
      <div
        className={`comet-streak ${isStreaking ? "streaking" : ""}`}
        style={{
          position: "absolute",
          left: cometStyle.left,
          top: cometStyle.top,
          width: cometStyle.width,
          height: cometStyle.height,
          borderRadius: "calc(var(--radius) - 3px)",
          background: "var(--c-surface)",
          boxShadow: isStreaking
            ? "0 0 16px rgba(136, 124, 199, 0.55), 0 2px 8px rgba(90, 59, 188, 0.15)"
            : "0 2px 8px rgba(36, 28, 56, 0.08)",
          transition: "left 0.45s cubic-bezier(0.2, 0.9, 0.25, 1), width 0.35s ease, box-shadow 0.4s ease",
          pointerEvents: "none",
          zIndex: 1,
        }}
      >
        {/* Glowing comet head and trail */}
        <span
          className="comet-head"
          style={{
            position: "absolute",
            right: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "var(--c-accent)",
            boxShadow: "0 0 12px 3px var(--c-accent-2)",
            opacity: isStreaking ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
        />
        <span
          className="comet-tail"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            background: "linear-gradient(90deg, transparent 0%, rgba(222, 199, 248, 0.4) 60%, rgba(136, 124, 199, 0.35) 100%)",
            opacity: isStreaking ? 1 : 0,
            transition: "opacity 0.5s ease",
          }}
        />
      </div>

      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            data-tab-id={tab.id}
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            style={{
              position: "relative",
              zIndex: 2,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              background: "transparent",
              border: 0,
              borderRadius: "calc(var(--radius) - 3px)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? "var(--c-accent)" : "var(--c-text-2)",
              transition: "color 0.25s ease",
              outline: "none",
              whiteSpace: "nowrap",
            }}
          >
            {tab.icon && <span style={{ display: "inline-flex" }}>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "1px 7px",
                  borderRadius: "var(--radius-full)",
                  background: isActive ? "var(--c-accent)" : "rgba(136, 124, 199, 0.2)",
                  color: isActive ? "#FFFFFF" : "var(--c-text-2)",
                  transition: "background 0.25s, color 0.25s",
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* =========================================================================
   2. OTP / VERIFICATION CODE BOXES
   Six boxes fill one by one, then turn mint in a wave animation.
   ========================================================================= */

export interface OtpCodeInputProps {
  length?: number;
  onComplete?: (code: string) => void;
  label?: string;
  helperText?: string;
}

export function OtpCodeInput({
  length = 6,
  onComplete,
  label = "Verification Code",
  helperText = "Enter the 6-digit confirmation code",
}: OtpCodeInputProps) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const [isMintWave, setIsMintWave] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const handleDigitChange = (index: number, value: string) => {
    const char = value.slice(-1);
    if (char && !/^\d$/.test(char)) return;

    const next = [...digits];
    next[index] = char;
    setDigits(next);

    // Auto-focus next input
    if (char && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }

    // Check if fully completed
    const fullCode = next.join("");
    if (fullCode.length === length && next.every((d) => d !== "")) {
      // Trigger mint wave!
      setIsMintWave(true);
      if (onComplete) onComplete(fullCode);
    } else {
      setIsMintWave(false);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!paste) return;
    const next = [...digits];
    for (let i = 0; i < length; i++) {
      next[i] = paste[i] ?? "";
    }
    setDigits(next);
    if (paste.length === length) {
      setIsMintWave(true);
      if (onComplete) onComplete(paste);
      inputsRef.current[length - 1]?.focus();
    } else {
      inputsRef.current[paste.length]?.focus();
    }
  };

  const fillSampleCode = () => {
    const sample = "842916";
    const next = sample.split("");
    setDigits(next);
    setIsMintWave(true);
    if (onComplete) onComplete(sample);
  };

  const clearCode = () => {
    setDigits(Array(length).fill(""));
    setIsMintWave(false);
    inputsRef.current[0]?.focus();
  };

  return (
    <div className="otp-container" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>{label}</label>
        <button
          type="button"
          onClick={fillSampleCode}
          style={{
            fontSize: 12,
            color: "var(--c-accent)",
            background: "none",
            border: 0,
            cursor: "pointer",
            fontWeight: 500,
            textDecoration: "underline",
          }}
        >
          Fill Demo Code
        </button>
      </div>

      <div
        className="otp-boxes-row"
        style={{ display: "flex", gap: 8, justifyContent: "space-between", maxWidth: 360 }}
      >
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => (inputsRef.current[idx] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            aria-label={`Digit ${idx + 1}`}
            onChange={(e) => handleDigitChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={handlePaste}
            className={`otp-box ${isMintWave ? "mint-wave" : ""}`}
            style={{
              width: 48,
              height: 54,
              textAlign: "center",
              fontSize: 22,
              fontWeight: 700,
              color: isMintWave ? "var(--c-accent)" : "var(--c-text)",
              background: isMintWave ? "rgba(136, 124, 199, 0.18)" : digit ? "var(--c-surface)" : "var(--c-surface-soft)",
              border: isMintWave
                ? "2px solid var(--c-mint)"
                : digit
                ? "2px solid var(--c-accent)"
                : "1.5px solid var(--c-border)",
              borderRadius: "var(--radius)",
              boxShadow: isMintWave
                ? "0 0 14px var(--c-mint-glow)"
                : digit
                ? "0 2px 8px rgba(90, 59, 188, 0.12)"
                : "none",
              outline: "none",
              transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
              animationDelay: isMintWave ? `${idx * 75}ms` : "0ms",
              transform: digit && !isMintWave ? "scale(1.04)" : "scale(1)",
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ margin: 0, fontSize: 12, color: isMintWave ? "var(--c-mint)" : "var(--c-text-3)" }}>
          {isMintWave ? "Code verified successfully!" : helperText}
        </p>
        {digits.some((d) => d !== "") && (
          <button
            type="button"
            onClick={clearCode}
            style={{
              background: "none",
              border: 0,
              fontSize: 11,
              color: "var(--c-text-3)",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   3. CARD NUMBER INPUT
   Card digits group as you type; then the expiry and CVC fields slide in.
   ========================================================================= */

export interface CardData {
  number: string;
  expiry: string;
  cvc: string;
}

export interface CardNumberInputProps {
  onCardChange?: (data: CardData) => void;
}

export function CardNumberInput({ onCardChange }: CardNumberInputProps) {
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");

  // Clean raw digits
  const rawDigits = number.replace(/\s+/g, "");
  const isFullCard = rawDigits.length >= 16;

  // Format with space every 4 digits
  const formatCardNumber = (val: string) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 16);
    const parts = cleaned.match(/.{1,4}/g);
    return parts ? parts.join(" ") : cleaned;
  };

  const handleNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setNumber(formatted);
    if (onCardChange) {
      onCardChange({ number: formatted, expiry, cvc });
    }
  };

  const handleExpiryChange = (e: ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (val.length >= 3) {
      val = `${val.slice(0, 2)}/${val.slice(2)}`;
    }
    setExpiry(val);
    if (onCardChange) {
      onCardChange({ number, expiry: val, cvc });
    }
  };

  const handleCvcChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
    setCvc(val);
    if (onCardChange) {
      onCardChange({ number, expiry, cvc: val });
    }
  };

  // Detect card brand
  const brand = rawDigits.startsWith("4")
    ? "Visa"
    : rawDigits.startsWith("5")
    ? "Mastercard"
    : rawDigits.startsWith("3")
    ? "Amex"
    : "Card";

  return (
    <div
      className="card-input-wrapper"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        background: "var(--c-surface)",
        borderRadius: "var(--radius)",
        border: "1.5px solid var(--c-border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label htmlFor="card-number-input" style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>
          Card Details
        </label>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: "var(--radius-xs)",
            background: "var(--c-surface-soft)",
            color: "var(--c-accent)",
          }}
        >
          {brand}
        </span>
      </div>

      <div style={{ position: "relative" }}>
        <input
          id="card-number-input"
          type="text"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="4000 1234 5678 9010"
          value={number}
          onChange={handleNumberChange}
          style={{
            width: "100%",
            padding: "12px 14px",
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: "0.06em",
            color: "var(--c-text)",
            background: "var(--c-surface-soft)",
            border: "1.5px solid var(--c-border)",
            borderRadius: "var(--radius-sm)",
            outline: "none",
          }}
        />
      </div>

      {/* Expiry & CVC fields slide in smoothly when digits are typed */}
      <div
        className={`card-extra-fields ${isFullCard || rawDigits.length >= 8 ? "slide-in" : "slide-out"}`}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          overflow: "hidden",
          maxHeight: isFullCard || rawDigits.length >= 8 ? 100 : 0,
          opacity: isFullCard || rawDigits.length >= 8 ? 1 : 0,
          transform: isFullCard || rawDigits.length >= 8 ? "translateY(0)" : "translateY(-12px)",
          transition: "max-height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div>
          <label htmlFor="card-expiry-input" style={{ display: "block", fontSize: 12, color: "var(--c-text-2)", marginBottom: 4 }}>
            Expires
          </label>
          <input
            id="card-expiry-input"
            type="text"
            placeholder="MM/YY"
            value={expiry}
            onChange={handleExpiryChange}
            maxLength={5}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 14,
              color: "var(--c-text)",
              background: "var(--c-surface-soft)",
              border: "1.5px solid var(--c-border)",
              borderRadius: "var(--radius-sm)",
              outline: "none",
            }}
          />
        </div>
        <div>
          <label htmlFor="card-cvc-input" style={{ display: "block", fontSize: 12, color: "var(--c-text-2)", marginBottom: 4 }}>
            CVC
          </label>
          <input
            id="card-cvc-input"
            type="password"
            placeholder="•••"
            value={cvc}
            onChange={handleCvcChange}
            maxLength={4}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 14,
              color: "var(--c-text)",
              background: "var(--c-surface-soft)",
              border: "1.5px solid var(--c-border)",
              borderRadius: "var(--radius-sm)",
              outline: "none",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   4. FOUR-STEP PASSWORD STRENGTH METER
   Meter fills and recolors as the password grows.
   ========================================================================= */

export interface PasswordStrengthMeterProps {
  label?: string;
  onPasswordChange?: (pw: string) => void;
}

export function PasswordStrengthMeter({
  label = "Account Password",
  onPasswordChange,
}: PasswordStrengthMeterProps) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  // Calculate 0 to 4 strength score
  const score = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 6) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) s++;
    return s;
  })();

  const levels = [
    { label: "Too weak", color: "var(--c-neutral)" },
    { label: "Fair", color: "var(--c-lilac)" },
    { label: "Good", color: "var(--c-accent-2)" },
    { label: "Strong", color: "var(--c-accent)" },
  ];

  const currentLevel = score > 0 ? levels[score - 1] : { label: "Enter password", color: "var(--c-border)" };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    if (onPasswordChange) onPasswordChange(val);
  };

  return (
    <div className="password-strength-widget" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label htmlFor="pw-meter-input" style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>
          {label}
        </label>
        <span style={{ fontSize: 12, fontWeight: 600, color: currentLevel.color, transition: "color 0.3s ease" }}>
          {currentLevel.label}
        </span>
      </div>

      <div style={{ position: "relative" }}>
        <input
          id="pw-meter-input"
          type={show ? "text" : "password"}
          value={password}
          placeholder="Enter a secure passphrase"
          onChange={handleChange}
          style={{
            width: "100%",
            padding: "10px 42px 10px 14px",
            fontSize: 14,
            color: "var(--c-text)",
            background: "var(--c-surface-soft)",
            border: "1.5px solid var(--c-border)",
            borderRadius: "var(--radius-sm)",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          aria-label={show ? "Hide password" : "Show password"}
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: 0,
            cursor: "pointer",
            fontSize: 12,
            color: "var(--c-accent-2)",
            padding: 4,
          }}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>

      {/* 4-Step Dynamic Meter */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 4 }}>
        {[1, 2, 3, 4].map((step) => {
          const filled = score >= step;
          return (
            <div
              key={step}
              style={{
                height: 5,
                borderRadius: "var(--radius-full)",
                background: filled ? currentLevel.color : "var(--c-border)",
                boxShadow: filled ? `0 0 8px ${currentLevel.color}` : "none",
                transition: "all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================================
   5. AUTO-GROW NOTE FIELD
   Grows a line at a time with a soft spring transition.
   ========================================================================= */

export interface AutoGrowNoteProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  minRows?: number;
}

export function AutoGrowNote({
  id = "auto-grow-note",
  label = "Notes",
  value,
  onChange,
  placeholder = "Add shoot instructions, client preferences or delivery terms...",
  minRows = 3,
}: AutoGrowNoteProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.max(el.scrollHeight, minRows * 26 + 24);
    el.style.height = `${nextHeight}px`;
  }, [value, minRows]);

  return (
    <div className="autogrow-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && (
        <label htmlFor={id} style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>
          {label}
        </label>
      )}
      <textarea
        id={id}
        ref={textareaRef}
        rows={minRows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "12px 14px",
          fontSize: 14,
          lineHeight: 1.6,
          color: "var(--c-text)",
          background: "var(--c-surface-soft)",
          border: "1.5px solid var(--c-border)",
          borderRadius: "var(--radius-sm)",
          resize: "none",
          outline: "none",
          transition: "height 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.2s ease",
        }}
      />
    </div>
  );
}

/* =========================================================================
   6. TAG INPUT WITH POPPING CHIPS
   Each typed word pops into a chip you can remove with 'x'.
   ========================================================================= */

export interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  placeholder?: string;
}

export function TagInput({
  tags,
  onChange,
  label = "Tags",
  placeholder = "Type tag and press Space or Enter...",
}: TagInputProps) {
  const [input, setInput] = useState("");

  const addTag = (text: string) => {
    const trimmed = text.trim().replace(/^#/, "");
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === " " || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((t) => t !== tagToRemove));
  };

  return (
    <div className="tag-input-group" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>{label}</label>
      )}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          background: "var(--c-surface-soft)",
          border: "1.5px solid var(--c-border)",
          borderRadius: "var(--radius-sm)",
          minHeight: 46,
        }}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="pop-chip"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              background: "var(--c-surface)",
              color: "var(--c-accent)",
              border: "1px solid var(--c-border)",
              borderRadius: "var(--radius-full)",
              fontSize: 12,
              fontWeight: 600,
              boxShadow: "0 1px 3px rgba(36, 28, 56, 0.06)",
              animation: "popIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both",
            }}
          >
            #{tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "rgba(90, 59, 188, 0.1)",
                color: "var(--c-accent)",
                border: 0,
                cursor: "pointer",
                padding: 0,
                fontSize: 11,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </span>
        ))}

        <input
          type="text"
          value={input}
          placeholder={tags.length === 0 ? placeholder : "Add more..."}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(input)}
          style={{
            flex: 1,
            minWidth: 120,
            border: 0,
            background: "transparent",
            fontSize: 13,
            color: "var(--c-text)",
            outline: "none",
            padding: "2px 0",
          }}
        />
      </div>
    </div>
  );
}

/* =========================================================================
   7. GHOST COMPLETE INPUT
   A gray completion appears; tap it and it fills in white.
   ========================================================================= */

export interface GhostInputProps {
  value: string;
  onChange: (val: string) => void;
  suggestions: readonly string[];
  placeholder?: string;
  label?: string;
  id?: string;
}

export function GhostInput({
  value,
  onChange,
  suggestions,
  placeholder = "Search or type...",
  label,
  id = "ghost-input",
}: GhostInputProps) {
  // Find closest suggestion starting with typed value
  const matchedSuggestion = value.trim()
    ? suggestions.find((s) => s.toLowerCase().startsWith(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase())
    : undefined;

  const ghostSuffix = matchedSuggestion ? matchedSuggestion.slice(value.length) : "";

  const acceptGhost = () => {
    if (matchedSuggestion) {
      onChange(matchedSuggestion);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Tab" || e.key === "ArrowRight") && matchedSuggestion) {
      e.preventDefault();
      acceptGhost();
    }
  };

  return (
    <div className="ghost-input-container" style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
      {label && (
        <label htmlFor={id} style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text)" }}>
          {label}
        </label>
      )}

      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        {/* Real Input */}
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%",
            padding: "10px 14px",
            fontSize: 14,
            fontWeight: 500,
            color: "var(--c-text)",
            background: "var(--c-surface)",
            border: "1.5px solid var(--c-border)",
            borderRadius: "var(--radius-sm)",
            outline: "none",
            zIndex: 2,
          }}
        />

        {/* Gray Completion Overlay (Tap to fill in white) */}
        {ghostSuffix && (
          <div
            onClick={acceptGhost}
            title="Click or press Tab to autocomplete"
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 3,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              background: "rgba(140, 132, 158, 0.15)",
              borderRadius: "var(--radius-xs)",
              color: "#8C849E",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
              userSelect: "none",
            }}
          >
            <span>{ghostSuffix}</span>
            <span
              style={{
                fontSize: 10,
                background: "var(--c-accent)",
                color: "#FFFFFF",
                padding: "1px 4px",
                borderRadius: 3,
                fontWeight: 600,
              }}
            >
              Tab ⇥
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
