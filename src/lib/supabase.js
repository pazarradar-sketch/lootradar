import { createClient } from "@supabase/supabase-js";
import cfg from "../../supabase/public-config.json";
export const SB_URL = import.meta.env.VITE_SUPABASE_URL || cfg.url;
export const SB_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || cfg.anonKey;
export const supabase = SB_URL && SB_ANON ? createClient(SB_URL, SB_ANON, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
export const TG_BOT = cfg.telegramBot || "";
