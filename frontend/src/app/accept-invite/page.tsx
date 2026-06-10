"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import apiClient from "@/lib/api";

export default function Page() {
  const params = useSearchParams();

  const token =
    params.get("token") || "";

  const [password, setPassword] =
    useState("");

  const submit = async () => {
    await apiClient.post(
      "/auth/accept-invite",
      {
        token,
        password,
      },
    );

    alert(
      "Account activated. Please login.",
    );
  };

  return (
    <div className="max-w-md mx-auto p-8">
      <h1>Accept Invitation</h1>

      <input
        type="password"
        value={password}
        onChange={(e) =>
          setPassword(e.target.value)
        }
        placeholder="Password"
      />

      <button onClick={submit}>
        Activate Account
      </button>
    </div>
  );
}
