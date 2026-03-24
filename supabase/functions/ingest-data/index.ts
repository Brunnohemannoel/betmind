import { createClient } from 'jsr:@supabase/supabase-js@2'

const API_TOKEN = 'Brunn@80'

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-api-key, x-api-token, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: corsHeaders })
  }

  const token = req.headers.get('x-api-token') || req.headers.get('authorization')?.replace('Bearer ', '')
  if (token !== API_TOKEN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const body = await req.json()
  const { action } = body

  // Action: upsert_teams - retorna mapeamento nome->id
  if (action === 'upsert_teams') {
    const teams: { name: string }[] = body.teams || []
    if (!teams.length) return new Response(JSON.stringify({ mapping: {} }), { headers: corsHeaders })

    const { error } = await supabase.from('teams').upsert(
      teams.map(t => ({ name: t.name })),
      { onConflict: 'name', ignoreDuplicates: false }
    )

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
    }

    const names = teams.map(t => t.name)
    const { data: rows, error: err2 } = await supabase.from('teams').select('id, name').in('name', names)
    if (err2) {
      return new Response(JSON.stringify({ error: err2.message }), { status: 400, headers: corsHeaders })
    }

    const mapping: Record<string, string> = {}
    for (const row of rows || []) mapping[row.name] = row.id
    return new Response(JSON.stringify({ mapping }), { headers: corsHeaders })
  }

  // Action: insert_matches
  if (action === 'insert_matches') {
    const matches = body.matches || []
    if (!matches.length) return new Response(JSON.stringify({ inserted: 0 }), { headers: corsHeaders })

    const { data, error } = await supabase
      .from('matches_history')
      .upsert(matches, { onConflict: 'external_match_id', ignoreDuplicates: true })
      .select('id, external_match_id')

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
    }
    const mapping: Record<string, string> = {}
    for (const row of data || []) mapping[row.external_match_id] = row.id
    return new Response(JSON.stringify({ inserted: (data || []).length, mapping }), { headers: corsHeaders })
  }

  // Action: insert_events
  if (action === 'insert_events') {
    const events = body.events || []
    if (!events.length) return new Response(JSON.stringify({ inserted: 0 }), { headers: corsHeaders })

    const { error } = await supabase.from('events').insert(events)
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
    }
    return new Response(JSON.stringify({ inserted: events.length }), { headers: corsHeaders })
  }

  // Action: get_existing_matches
  if (action === 'get_existing_matches') {
    const { data, error } = await supabase.from('matches_history').select('id, external_match_id')
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
    }
    const mapping: Record<string, string> = {}
    for (const row of data || []) mapping[row.external_match_id] = row.id
    return new Response(JSON.stringify({ mapping }), { headers: corsHeaders })
  }

  // Action: check_events
  if (action === 'check_events') {
    const matchId: string = body.match_id
    const { count, error } = await supabase.from('events').select('id', { count: 'exact', head: true }).eq('match_id', matchId)
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
    }
    return new Response(JSON.stringify({ count }), { headers: corsHeaders })
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders })
})
