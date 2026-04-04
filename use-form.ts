/**
 * use-form.ts — Phase 3 form validation system
 * Place in src/lib/use-form.ts
 *
 * Wraps React Hook Form + Zod. All pages import from here.
 * Replaces: HTML5 required attrs + window.alert() error handling.
 *
 * Usage:
 *   const { register, handleSubmit, errors, isSubmitting } = useSchoolForm(schema);
 */

// ─────────────────────────────────────────────────────────────────────────────
// INSTALL: npm install react-hook-form @hookform/resolvers zod
// ─────────────────────────────────────────────────────────────────────────────

import { useForm, type UseFormReturn, type FieldValues, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

export { z };

// ── Core hook ─────────────────────────────────────────────────────────────────
export function useSchoolForm<T extends FieldValues>(
  schema: z.ZodType<T>,
  defaultValues?: DefaultValues<T>,
): UseFormReturn<T> & { errors: Record<string, any>; isSubmitting: boolean } {
  const form = useForm<T>({
    resolver:      zodResolver(schema),
    defaultValues,
    mode:          "onBlur",    // validate on blur for better UX
    reValidateMode:"onChange",
  });

  return {
    ...form,
    errors:      form.formState.errors as Record<string, any>,
    isSubmitting: form.formState.isSubmitting,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas for all common forms
// ─────────────────────────────────────────────────────────────────────────────

// ── Common fields ─────────────────────────────────────────────────────────────
const phoneIN = z.string()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");

const email = z.string()
  .email("Enter a valid email address")
  .toLowerCase();

const name = (field: string) =>
  z.string()
    .min(2, `${field} must be at least 2 characters`)
    .max(50, `${field} must be at most 50 characters`)
    .regex(/^[a-zA-Z\s'.,-]+$/, `${field} contains invalid characters`);

const admissionNumber = z.string()
  .min(3, "Admission number must be at least 3 characters")
  .max(20, "Admission number is too long")
  .regex(/^[A-Z0-9/-]+$/i, "Only letters, numbers, / and - allowed");

// ── Student form ───────────────────────────────────────────────────────────────
export const studentSchema = z.object({
  firstName:       name("First name"),
  lastName:        name("Last name"),
  admissionNumber: admissionNumber,
  academicYear:    z.string().min(1, "Select an academic year"),
  branchId:        z.string().min(1, "Select a branch"),
  gender:          z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
  sectionId:       z.string().optional(),
  dateOfBirth:     z.string().optional().refine(val => {
    if (!val) return true;
    const d = new Date(val);
    const minAge = new Date(); minAge.setFullYear(minAge.getFullYear() - 25);
    const maxAge = new Date(); maxAge.setFullYear(maxAge.getFullYear() - 2);
    return d >= minAge && d <= maxAge;
  }, "Date of birth seems invalid (must be 2–25 years ago)"),
  // Guardian
  guardianFirstName: name("Guardian first name").optional().or(z.literal("")),
  guardianLastName:  name("Guardian last name").optional().or(z.literal("")),
  guardianPhone:     phoneIN.optional().or(z.literal("")),
  guardianEmail:     email.optional().or(z.literal("")),
  guardianRelation:  z.string().optional(),
});
export type StudentFormData = z.infer<typeof studentSchema>;

// ── Staff form ────────────────────────────────────────────────────────────────
export const staffSchema = z.object({
  firstName:    name("First name"),
  lastName:     name("Last name"),
  email:        email,
  phone:        phoneIN.optional().or(z.literal("")),
  role:         z.string().min(1, "Select a role"),
  designation:  z.string().min(2, "Designation is required").max(60),
  department:   z.string().optional(),
  employeeId:   z.string().min(2, "Employee ID is required").max(20),
  joiningDate:  z.string().min(1, "Joining date is required"),
  password:     z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
});
export type StaffFormData = z.infer<typeof staffSchema>;

// ── Login form ────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  schoolSlug: z.string()
    .min(3, "School ID must be at least 3 characters")
    .max(60, "School ID too long")
    .regex(/^[a-z0-9-]+$/, "School ID can only contain lowercase letters, numbers and hyphens"),
  email:    email,
  password: z.string().min(1, "Password is required"),
});
export type LoginFormData = z.infer<typeof loginSchema>;

// ── Fee plan form ─────────────────────────────────────────────────────────────
export const feePlanSchema = z.object({
  name:        z.string().min(2, "Plan name is required").max(60),
  sessionId:   z.string().min(1, "Select a session"),
  academicYear:z.string().min(1, "Academic year is required"),
  grade:       z.string().optional(),
  currency:    z.enum(["INR", "USD", "GBP", "EUR", "AED"]).default("INR"),
  items: z.array(z.object({
    name:   z.string().min(1, "Item name is required"),
    amount: z.coerce.number().positive("Amount must be positive"),
    gstRate:z.coerce.number().min(0).max(28).optional(),
  })).min(1, "Add at least one fee item"),
});
export type FeePlanFormData = z.infer<typeof feePlanSchema>;

// ── Admission form ────────────────────────────────────────────────────────────
export const admissionSchema = z.object({
  firstName:        name("First name"),
  lastName:         name("Last name"),
  phone:            phoneIN,
  email:            email.optional().or(z.literal("")),
  applyingForClass: z.string().min(1, "Class is required"),
  academicYear:     z.string().min(1, "Academic year is required"),
  source:           z.enum(["GOOGLE","REFERRAL","WALK_IN","SOCIAL_MEDIA","DIRECT","EVENT","OTHER"]).default("DIRECT"),
  notes:            z.string().max(500).optional(),
});
export type AdmissionFormData = z.infer<typeof admissionSchema>;

// ── Password reset forms ──────────────────────────────────────────────────────
export const forgotPasswordSchema = z.object({
  email:      email,
  schoolSlug: z.string().min(3, "School ID required"),
});

export const resetPasswordSchema = z.object({
  otp:            z.string().length(6, "Enter the 6-digit code from your email"),
  newPassword:    z.string().min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
  confirmPassword:z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path:    ["confirmPassword"],
});

// ─────────────────────────────────────────────────────────────────────────────
// FieldError component — renders inline error below a field
// Place in src/components/ui/field-error.tsx
// ─────────────────────────────────────────────────────────────────────────────
/*
import { AlertCircle } from "lucide-react";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 mt-1.5" style={{ fontSize: 11, color: "var(--text-danger)" }}>
      <AlertCircle style={{ width: 12, height: 12, flexShrink: 0 }} />
      {message}
    </p>
  );
}
*/

// ─────────────────────────────────────────────────────────────────────────────
// FormField wrapper — label + input + error in one component
// Place in src/components/ui/form-field.tsx
// ─────────────────────────────────────────────────────────────────────────────
/*
import { forwardRef } from "react";
import { FieldError } from "./field-error";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label:   string;
  error?:  string;
  hint?:   string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, hint, className, ...props }, ref) => (
    <div>
      <label className="label">{label}</label>
      <input
        ref={ref}
        {...props}
        className={`input ${error ? "input-error" : ""} ${className ?? ""}`}
      />
      {hint && !error && (
        <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{hint}</p>
      )}
      <FieldError message={error} />
    </div>
  )
);
FormField.displayName = "FormField";
*/

// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION GUIDE: converting existing pages to use-form
// ─────────────────────────────────────────────────────────────────────────────
/*
BEFORE (students/page.tsx):
  const [form, setForm] = useState({ firstName: "", ... });
  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const createStudent = async (e) => {
    e.preventDefault();
    // no validation
    await apiClient.post("/students", form);
  };

  <input required value={form.firstName} onChange={f("firstName")} />

AFTER:
  import { useSchoolForm, studentSchema } from "@/lib/use-form";
  import { FormField } from "@/components/ui/form-field";

  const { register, handleSubmit, errors, isSubmitting } =
    useSchoolForm(studentSchema, { firstName: "", lastName: "", ... });

  const onSubmit = async (data) => {
    await apiClient.post("/students", data);
  };

  <form onSubmit={handleSubmit(onSubmit)}>
    <FormField
      label="First Name *"
      {...register("firstName")}
      error={errors.firstName?.message}
    />
  </form>

BENEFIT:
  ✅ Inline field errors instead of window.alert()
  ✅ Phone number format validated before submission
  ✅ Email format validated
  ✅ Type-safe form data
  ✅ Loading state from react-hook-form (no manual setSaving)
*/
