const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Environment variables from your Supabase dashboard
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables!');
  console.log('Please add the following to your .env file:');
  console.log('SUPABASE_URL=your_supabase_url');
  console.log('SUPABASE_ANON_KEY=your_supabase_anon_key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };
