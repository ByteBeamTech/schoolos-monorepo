"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import apiClient from "@/lib/api";

export default function Page() {
  const params = useSearchParams();

  const token =
    params.get("token") || "";

  const [password, setPassword] =
    useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invitation token is missing.");
      return;
    }
    apiClient.get(`/auth/invitations/${encodeURIComponent(token)}`)
      .then((response) => {
        setFirstName(response.data?.firstName ?? "");
        setLastName(response.data?.lastName ?? "");
      })
      .catch((err: any) => {
        setError(err?.response?.data?.message ?? "This invitation is invalid or expired.");
      });
  }, [token]);

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      await apiClient.post(
        `/auth/invitations/${encodeURIComponent(token)}/accept`,
        { firstName, lastName, password },
      );
      alert("Account activated. Please login.");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Could not activate this invitation.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-8">
      <h1>Accept Invitation</h1>

      <input
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        placeholder="First name"
        required
      />
      <input
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        placeholder="Last name"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) =>
          setPassword(e.target.value)
        }
        placeholder="Password"
        required
      />

      {error && <p className="text-red-600">{error}</p>}
      <button onClick={submit} disabled={saving || !token || !firstName || !lastName || !password}>
        {saving ? "Activating..." : "Activate Account"}
      </button>
    </div>
  );
}
