"use client";
import { ThemeProvider as Provider, useTheme } from "next-themes";
export function ThemeProvider({children}:{children:React.ReactNode}) { return <Provider attribute="class" defaultTheme="system" enableSystem>{children}</Provider>; }
export function ThemeToggle(){ const {resolvedTheme,setTheme}=useTheme(); return <button type="button" className="quiet-button" onClick={()=>setTheme(resolvedTheme==="dark"?"light":"dark")} aria-label="Switch light or dark theme">◐ <span>Theme</span></button>; }
