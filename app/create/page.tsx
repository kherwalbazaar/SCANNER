"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  CircleAlert,
  Info,
  Landmark,
  Mail,
  MapPin,
  Phone,
  QrCode,
  Settings,
  User,
  UserPlus,
  X,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import {
  registerScannerMember,
  useNextScannerId,
} from "@/lib/scanner-member";

const GATES = ["Not assigned", "Gate 1", "Gate 2", "Gate 3"] as const;

type FormState = {
  fullName: string;
  mobile: string;
  email: string;
  gate: string;
  address: string;
};

const INITIAL_FORM: FormState = {
  fullName: "",
  mobile: "",
  email: "",
  gate: GATES[0],
  address: "",
};

export default function CreateScannerPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextScannerId = useNextScannerId();

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [photo, setPhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdScannerId, setCreatedScannerId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo);
    };
  }, [photo]);

  const update = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (photo) URL.revokeObjectURL(photo);
    setPhoto(URL.createObjectURL(file));
  };

  const validate = () => {
    const next: Partial<Record<keyof FormState, string>> = {};

    if (form.fullName.trim().length < 2) {
      next.fullName = "Please enter your full name";
    }
    if (!/^[0-9+\-\s]{10,15}$/.test(form.mobile.trim())) {
      next.mobile = "Please enter a valid mobile number";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = "Please enter a valid email address";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const result = await registerScannerMember({
      name: form.fullName,
      mobile: form.mobile,
      email: form.email,
      address: form.address,
      assignedGateId: form.gate,
      profilePhoto: photo || "",
    });

    setIsSubmitting(false);

    if (result.ok) {
      setCreatedScannerId(result.scannerId);
    } else {
      setSubmitError(result.error || "Failed to create scanner account. Please try again.");
    }
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="relative shrink-0 overflow-hidden bg-indigo-950 px-4 pt-6 pb-5 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            background:
              "radial-gradient(ellipse at top, #c084fc 0%, #4338ca 45%, #0f172a 100%)",
          }}
        />

        <div className="relative z-10 mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="Go back"
            onClick={goBack}
            className="text-white transition-colors hover:text-indigo-200 focus:outline-none"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/20 p-1.5">
              <QrCode className="h-4 w-4 text-amber-300" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight tracking-wide">
                JATRA TICKET
              </h1>
              <p className="text-[10px] font-semibold tracking-wider text-amber-300">
                SCANNER
              </p>
            </div>
          </div>

          <span className="w-5" />
        </div>

        <p className="relative z-10 mt-1 text-center text-[11px] font-medium tracking-wider text-indigo-200">
          Scan &bull; Verify &bull; Gate Entry
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="relative z-20 -mt-3 flex flex-1 flex-col overflow-hidden rounded-t-[24px] bg-white shadow-inner"
      >
        <div className="flex-1 space-y-4 overflow-y-auto px-4 pt-4 pb-24">
          <div>
            <div className="mb-1 flex items-center gap-2 text-indigo-900">
              <UserPlus className="h-4 w-4" />
              <h2 className="text-lg font-bold text-slate-800">
                Create Scanner Account
              </h2>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Fill in your details to request scanner access. Your account will
              be reviewed and approved by administrator.
            </p>
          </div>

          {createdScannerId ? (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <h4 className="text-xs font-bold text-emerald-800">
                  Request Submitted ({createdScannerId})
                </h4>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                  Your scanner account has been created and is pending
                  administrator approval.
                </p>
              </div>
            </div>
          ) : null}

          {/* Photo */}
          <div className="flex items-center gap-4 pt-1">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-slate-200 text-slate-400">
                {photo ? (
                  <img
                    src={photo}
                    alt="Selected profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8 mt-2" />
                )}
              </div>
              <div className="absolute right-0 bottom-0 rounded-full border-2 border-white bg-indigo-900 p-1 text-[10px] text-white shadow-sm">
                <Camera className="h-3 w-3" />
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800">Profile Photo</h3>
              <p className="mb-2 text-[11px] text-slate-500">Upload your photo</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-900 transition-colors hover:bg-indigo-100"
              >
                <Camera className="h-3 w-3" />
                <span>{photo ? "Change Photo" : "Choose Photo"}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handlePhoto}
              />
            </div>
          </div>

          {/* Full name */}
          <Field
            id="fullName"
            label="Full Name"
            required
            error={errors.fullName}
            icon={<User className="h-4 w-4" />}
          >
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder="Enter your full name"
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              className={inputClass(errors.fullName)}
            />
          </Field>

          {/* Mobile */}
          <Field
            id="mobile"
            label="Mobile Number"
            required
            error={errors.mobile}
            icon={<Phone className="h-4 w-4" />}
          >
            <input
              id="mobile"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Enter your mobile number"
              value={form.mobile}
              onChange={(e) => update("mobile", e.target.value)}
              className={inputClass(errors.mobile)}
            />
          </Field>

          {/* Email */}
          <Field
            id="email"
            label="Email"
            required
            error={errors.email}
            icon={<Mail className="h-4 w-4" />}
          >
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email address"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className={inputClass(errors.email)}
            />
          </Field>

          {/* Gate */}
          <Field
            id="gate"
            label="Assigned Gate"
            icon={<Landmark className="h-4 w-4" />}
          >
            <div className="relative flex items-center">
              <select
                id="gate"
                value={form.gate}
                onChange={(e) => update("gate", e.target.value)}
                className={`${inputClass()} appearance-none pr-8`}
              >
                {GATES.map((gate) => (
                  <option key={gate} value={gate}>
                    {gate}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-400" />
            </div>
          </Field>

          {/* Address */}
          <Field
            id="address"
            label="Address"
            icon={<MapPin className="h-4 w-4" />}
          >
            <textarea
              id="address"
              rows={2}
              placeholder="Enter your address"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              className={`${inputClass()} resize-none`}
            />
          </Field>

          {/* Scanner ID */}
          <div>
            <label
              htmlFor="scannerId"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Scanner ID{" "}
              <span className="text-[10px] font-normal text-slate-400">
                (Auto Generated)
              </span>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex flex-1 items-center">
                <span className="absolute left-3 text-slate-400">
                  <QrCode className="h-4 w-4" />
                </span>
                <input
                  id="scannerId"
                  type="text"
                  value={nextScannerId}
                  readOnly
                  disabled
                  className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 py-2.5 pr-3 pl-9 text-xs font-semibold text-slate-600"
                />
              </div>
              <div className="flex shrink-0 items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] font-semibold text-emerald-700">
                <Settings className="h-3 w-3" />
                <span>Auto Generated</span>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {submitError && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <p className="text-[11px] leading-relaxed text-rose-700">
                {submitError}
              </p>
            </div>
          )}

          {/* Info */}
          <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/80 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <p className="text-[11px] leading-relaxed text-slate-600">
              After submitting, your account will be in{" "}
              <span className="font-bold text-amber-600">Pending</span> status.
              You can scan tickets only after administrator approval.
            </p>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-slate-200 bg-white p-3">
          <button
            type="button"
            onClick={goBack}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
            <span>Cancel</span>
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-900 px-4 py-3 text-xs font-semibold text-white shadow-md shadow-indigo-900/20 transition-colors hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                <span>Submitting…</span>
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                <span>Create Account</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Success Modal */}
      {createdScannerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">
              Scanner Account Registered!
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Your registration was synced with Supabase & Admin.
            </p>

            <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3.5">
              <p className="text-[11px] font-semibold text-indigo-700">
                Your Assigned Scanner ID
              </p>
              <p className="mt-0.5 text-xl font-extrabold tracking-wider text-indigo-950">
                {createdScannerId}
              </p>
              <p className="mt-2 text-[10px] text-amber-700 bg-amber-50 rounded-lg p-2 border border-amber-200/80">
                Status: <strong>Pending Admin Approval</strong>. The event admin
                can now see and approve your profile in the Admin Panel.
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => router.push(`/login?id=${createdScannerId}`)}
                className="w-full rounded-xl bg-indigo-900 py-3 text-xs font-semibold text-white shadow-md shadow-indigo-900/20 transition-colors hover:bg-indigo-800"
              >
                Go to Scanner Login
              </button>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full rounded-xl bg-slate-100 py-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function inputClass(error?: string) {
  return [
    "w-full rounded-xl border bg-slate-50 py-2.5 pr-3 pl-9 text-xs text-slate-800 transition-all",
    "placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none",
    error ? "border-rose-400" : "border-slate-200",
  ].join(" ");
}

function Field({
  id,
  label,
  required,
  error,
  icon,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-semibold text-slate-700"
      >
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </label>
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-3 text-slate-400">
          {icon}
        </span>
        {children}
      </div>
      {error ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-500">
          <CircleAlert className="h-3 w-3" /> {error}
        </p>
      ) : null}
    </div>
  );
}

