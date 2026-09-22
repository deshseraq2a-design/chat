import { supabase } from './supabase'

export type DatabaseGroup = {
  id: string
  name: string
  description: string
  icon: string
  category: string
  language: string
  region: string
  member_count: number
  online_count: number
  is_public: boolean
  rules: string[]
  created_at: string
}

export type DatabaseMessage = {
  id: string
  group_id: string
  anonymous_display_name: string
  anonymous_avatar: string
  type: 'text' | 'gif' | 'sticker'
  text: string | null
  gif_url: string | null
  sticker_id: string | null
  created_at: string
  reactions: Record<string, number>
}

export async function fetchPublicGroups(): Promise<DatabaseGroup[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('groups')
    .select('id,name,description,icon,category,language,region,member_count,online_count,is_public,rules,created_at')
    .eq('is_public', true)
    .order('member_count', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function fetchGroupMessages(groupId: string, limit = 50): Promise<DatabaseMessage[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('public_messages')
    .select('id,group_id,anonymous_display_name,anonymous_avatar,type,text,gif_url,sticker_id,created_at,reactions')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).reverse()
}

export async function createMessage(input: {
  groupId: string
  type: 'text' | 'gif' | 'sticker'
  text?: string
  gifUrl?: string
  stickerId?: string
}) {
  if (!supabase) return
  const { error } = await supabase.from('messages').insert({
    group_id: input.groupId,
    type: input.type,
    text: input.text ?? null,
    gif_url: input.gifUrl ?? null,
    sticker_id: input.stickerId ?? null,
  })
  if (error) throw error
}

export function subscribeToGroupMessages(groupId: string, onMessage: () => void) {
  const client = supabase
  if (!client) return () => undefined
  const channel = client
    .channel(`group:${groupId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` }, onMessage)
    .subscribe()

  return () => {
    void client.removeChannel(channel)
  }
}
