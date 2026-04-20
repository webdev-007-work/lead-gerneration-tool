const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://pwqufnpryfeyawbfkwaf.supabase.co";
const supabaseKey = "sb_publishable_lvUSDjHubrGWSvwHlnb3rw_107P9IMJ";

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;