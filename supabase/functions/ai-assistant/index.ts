import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_FEE_PERCENTAGE = 0.10; // 10% fee
const BASE_FEE = 0.50; // $0.50 base fee per message

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const authorization = req.headers.get("Authorization") || "";
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Backend is not configured");
    }
    if (!authorization.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate the bearer token and derive identity from Supabase Auth, never from request JSON.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // Service-role client is used only after the caller has been authenticated.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if user is admin or master (free AI access)
    const { data: isAdminOrMaster } = await supabase.rpc("is_admin_or_master", { _user_id: userId });

    // Check if user is within free trial (10 days from account creation)
    let isFreeTrial = false;
    if (!isAdminOrMaster) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("created_at")
        .eq("id", userId)
        .single();

      const FREE_TRIAL_DAYS = 10;
      if (profile?.created_at) {
        const createdAt = new Date(profile.created_at);
        const diffDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        isFreeTrial = diffDays <= FREE_TRIAL_DAYS;
      }
    }

    const isFreeAccess = !!isAdminOrMaster || isFreeTrial;

    // Get user's wallet balance
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single();

    if (walletError || !wallet) {
      console.error("Wallet error:", walletError);
      return new Response(JSON.stringify({ error: "User wallet not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentBalance = parseFloat(wallet.balance);
    
    // Only check balance if not free access
    if (!isFreeAccess && currentBalance < BASE_FEE) {
      return new Response(JSON.stringify({ error: "Insufficient balance" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call AI Gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are LINKABET's AI betting assistant. You help users with:
- Understanding odds and betting strategies
- Analyzing matches and providing insights
- Explaining betting terms and concepts
- Giving general sports knowledge
- Providing responsible gambling advice

Be concise, helpful, and always encourage responsible betting. Never guarantee wins or encourage excessive gambling.`
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    // Atomic charge uses the caller's verified JWT, so auth.uid() is authoritative.
    let fee = 0;
    if (!isFreeAccess) {
      const { data: chargedFee, error: chargeError } = await userClient.rpc("charge_ai_fee", {
        p_description: "AI assistant virtual-points usage",
      });
      if (chargeError) {
        return new Response(JSON.stringify({ error: chargeError.message || "Insufficient virtual points" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      fee = Number(chargedFee ?? BASE_FEE);
    }

    // Log AI usage
    const userMessage = messages[messages.length - 1]?.content || "";
    await supabase.from("ai_usage").insert({
      user_id: userId,
      prompt: userMessage.substring(0, 500),
      tokens_used: 0,
      fee_charged: fee,
    });

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("AI assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
