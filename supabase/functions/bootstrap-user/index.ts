import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Dial code → currency code mapping
const DIAL_TO_CURRENCY: Record<string, string> = {
  '+1': 'USD', '+44': 'GBP', '+234': 'NGN', '+233': 'GHS', '+254': 'KES',
  '+27': 'ZAR', '+255': 'TZS', '+256': 'UGX', '+250': 'RWF', '+251': 'ETB',
  '+237': 'XAF', '+225': 'XOF', '+221': 'XOF', '+243': 'CDF', '+258': 'MZN',
  '+260': 'ZMW', '+265': 'MWK', '+267': 'BWP', '+91': 'INR', '+92': 'PKR',
  '+880': 'BDT', '+63': 'PHP', '+55': 'BRL', '+52': 'MXN', '+49': 'EUR',
  '+33': 'EUR', '+34': 'EUR', '+39': 'EUR', '+351': 'EUR', '+971': 'AED',
  '+966': 'SAR', '+20': 'EGP', '+212': 'MAD', '+61': 'AUD', '+81': 'JPY',
  '+86': 'CNY', '+7': 'RUB', '+90': 'TRY',
};

function getCurrencyFromPhone(phone: string | null): string {
  if (!phone) return 'USD';
  for (let len = 4; len >= 1; len--) {
    const prefix = phone.substring(0, len + 1);
    if (DIAL_TO_CURRENCY[prefix]) return DIAL_TO_CURRENCY[prefix];
  }
  return 'USD';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Backend is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use the user's JWT to identify them
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role for safe server-side writes
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if profile exists
    const { data: existingProfile, error: existingProfileError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .limit(1)
      .maybeSingle();

    if (existingProfileError) {
      console.error("bootstrap-user profile lookup error", existingProfileError);
      return new Response(JSON.stringify({ error: "Failed to check profile" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure wallet exists
    const phone = (user.user_metadata?.phone as string | undefined) ?? null;
    const detectedCurrency = getCurrencyFromPhone(phone);

    const ensureWallet = async () => {
      const { data: existingWallet, error: walletLookupError } = await admin
        .from("wallets")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (walletLookupError) throw walletLookupError;

      if (!existingWallet) {
        const { error: walletInsertError } = await admin.from("wallets").insert({
          user_id: user.id,
          balance: 0.0,
          currency: detectedCurrency,
        });
        if (walletInsertError) throw walletInsertError;
      }
    };

    // Ensure role exists
    const ensureRole = async (defaultRole: "user" | "admin" | "master") => {
      const { data: existingRole, error: roleLookupError } = await admin
        .from("user_roles")
        .select("id, role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (roleLookupError) throw roleLookupError;

      if (!existingRole) {
        const { error: roleInsertError } = await admin.from("user_roles").insert({
          user_id: user.id,
          role: defaultRole,
        });
        if (roleInsertError) throw roleInsertError;
      }
    };

    if (!existingProfile) {
      // Determine if this is the first user (bootstrap master)
      const { count: profilesCount, error: countError } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true });

      if (countError) {
        console.error("bootstrap-user count profiles error", countError);
        return new Response(JSON.stringify({ error: "Failed to bootstrap" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const assignedRole = (profilesCount || 0) === 0 ? "master" : "user";
      const email = user.email || (user.user_metadata?.email as string | undefined) || "";

      if (!email) {
        return new Response(JSON.stringify({ error: "User email missing" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // phone already extracted above
      const username =
        (user.user_metadata?.username as string | undefined) || email.split("@")[0];

      const { error: profileInsertError } = await admin.from("profiles").insert({
        id: user.id,
        email,
        phone,
        username,
      });

      if (profileInsertError) {
        console.error("bootstrap-user profile insert error", profileInsertError);
        return new Response(JSON.stringify({ error: "Failed to create profile" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await ensureRole(assignedRole);
      await ensureWallet();

      return new Response(
        JSON.stringify({ ok: true, created: true, role: assignedRole }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Profile exists; just ensure supporting records exist
    await ensureRole("user");
    await ensureWallet();

    return new Response(JSON.stringify({ ok: true, created: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("bootstrap-user error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
