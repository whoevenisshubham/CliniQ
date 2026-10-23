"use client";

import React, { useState,useEffect } from "react";
import { motion } from "framer-motion";
import { AppSidebar } from "./AppSidebar";
import type { UserRole } from "@/lib/types";
import { useConsultationStore } from "@/store/consultationStore";
import { configureOfflineActor } from "@/lib/offline-queue";

interface DashboardShellProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatar_url?: string;
  };
  children: React.ReactNode;
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  useEffect(()=>{configureOfflineActor(user.id);return ()=>configureOfflineActor(null);},[user.id]);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setSignOutError(null);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      configureOfflineActor(null);
      useConsultationStore.getState().resetAll();
      window.location.assign("/login");
    } catch { setSignOutError("Sign-out could not be completed. Please try again."); }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <AppSidebar user={user} onSignOut={handleSignOut} />
      <main className="flex-1 overflow-y-auto">
        {signOutError && <p role="alert" className="p-3 text-sm text-red-400">{signOutError}</p>}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="h-full"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
