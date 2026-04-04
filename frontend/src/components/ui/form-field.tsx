"use client";
import { forwardRef } from "react";
import { FieldError } from "./field-error";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label:  string;
  error?: string;
  hint?:  string;
}
export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, hint, className, ...props }, ref) => (
    <div>
      <label className="label">{label}</label>
      <input
        ref={ref}
        {...props}
        className={`input${error ? " input-error" : ""}${className ? " " + className : ""}`}
      />
      {hint && !error && (
        <p style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{hint}</p>
      )}
      <FieldError message={error} />
    </div>
  )
);
FormField.displayName = "FormField";

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label:    string;
  error?:   string;
  children: React.ReactNode;
}
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, children, className, ...props }, ref) => (
    <div>
      <label className="label">{label}</label>
      <select
        ref={ref}
        {...props}
        className={`input${error ? " input-error" : ""}${className ? " " + className : ""}`}
      >
        {children}
      </select>
      <FieldError message={error} />
    </div>
  )
);
SelectField.displayName = "SelectField";
