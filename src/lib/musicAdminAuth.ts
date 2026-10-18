import {createClient} from './supabase/server';

export async function musicAdminClient() {
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) return null;
  const {data, error} = await supabase.rpc('is_music_admin');
  return !error && data ? supabase : null;
}
