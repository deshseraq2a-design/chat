import { useEffect, useMemo, useState } from 'react'
import { fetchGroupMessages, fetchPublicGroups, subscribeToGroupMessages, type DatabaseGroup, type DatabaseMessage } from './lib/database'
import { isSupabaseConfigured } from './lib/supabase'

type Section = 'home' | 'discover' | 'groups' | 'notifications' | 'settings'
type MessageKind = 'text' | 'gif' | 'sticker'
type Theme = 'light' | 'dark'

type Group = {
  id: string
  name: string
  icon: string
  description: string
  category: string
  language: string
  region: string
  members: number
  online: number
  accent: string
  joined?: boolean
  trending?: boolean
}

type Message = {
  id: number
  author: string
  avatar: string
  time: string
  body?: string
  kind: MessageKind
  media?: string
  reactions: Record<string, number>
  mine?: boolean
}

const groups: Group[] = [
  { id: 'global', name: 'Global Chat', icon: '🌎', description: 'A friendly corner of the internet for curious minds everywhere.', category: 'General', language: 'English', region: 'Global', members: 12840, online: 842, accent: 'coral', joined: true, trending: true },
  { id: 'tech', name: 'Technology', icon: '💻', description: 'Ideas, tools and the future we are building together.', category: 'Technology', language: 'English', region: 'Global', members: 8420, online: 392, accent: 'blue', joined: true, trending: true },
  { id: 'gaming', name: 'Late Night Gaming', icon: '🎮', description: 'Find your squad, share a clip, or talk about your next quest.', category: 'Gaming', language: 'English', region: 'Global', members: 6240, online: 281, accent: 'purple', trending: true },
  { id: 'bd', name: 'Bangladesh', icon: '🇧🇩', description: 'Adda, stories and community from Bangladesh and beyond.', category: 'Community', language: 'বাংলা', region: 'South Asia', members: 4680, online: 156, accent: 'green' },
  { id: 'study', name: 'Study Room', icon: '📚', description: 'Quiet accountability and tiny wins, one session at a time.', category: 'Learning', language: 'English', region: 'Global', members: 3950, online: 112, accent: 'yellow' },
  { id: 'music', name: 'Music Lovers', icon: '🎵', description: 'What is on repeat? Discover sounds from every corner of the world.', category: 'Music', language: 'English', region: 'Global', members: 3220, online: 88, accent: 'pink' },
]

const initialMessages: Record<string, Message[]> = {
  global: [
    { id: 1, author: 'Anonymous Panda', avatar: '🐼', time: '10:42 AM', body: 'Morning from Dhaka! What is everyone up to today? 👋', kind: 'text', reactions: { '👋': 8, '❤️': 3 } },
    { id: 2, author: 'Maya', avatar: 'M', time: '10:44 AM', body: 'Working on a tiny garden project. Sending good energy to everyone 🌱', kind: 'text', reactions: { '❤️': 12 } },
    { id: 3, author: 'Anonymous Fox', avatar: '🦊', time: '10:46 AM', body: 'That sounds lovely! I just found this and it made my day.', kind: 'text', media: 'https://media.giphy.com/media/26uf9MHun4C7HAB20/giphy.gif', reactions: { '😂': 14, '🎉': 2 } },
    { id: 4, author: 'Anonymous #2941', avatar: '✦', time: '10:48 AM', body: 'Anyone watching the match tonight?', kind: 'text', reactions: {} },
    { id: 5, author: 'Alex', avatar: 'A', time: '10:49 AM', body: 'Absolutely. It should be a good one ⚽', kind: 'text', reactions: { '👍': 5 }, mine: true },
  ],
  tech: [
    { id: 11, author: 'Anonymous Otter', avatar: '🦦', time: '9:12 AM', body: 'What are you all building this week?', kind: 'text', reactions: { '💡': 4 } },
    { id: 12, author: 'Nora', avatar: 'N', time: '9:14 AM', body: 'A tiny design system for a community app. The hard part is keeping it friendly.', kind: 'text', reactions: { '❤️': 6 } },
    { id: 13, author: 'Anonymous Moon', avatar: '☾', time: '9:20 AM', body: 'Friendly is a feature. Love that.', kind: 'text', reactions: {} },
  ],
}

const emojiSet = ['😊', '😂', '🥹', '😍', '🤔', '🙌', '🔥', '💡', '🎉', '❤️', '👋', '🌱']
const gifs = ['https://media.giphy.com/media/26uf9MHun4C7HAB20/giphy.gif', 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif', 'https://media.giphy.com/media/3o7TKt5Yl2s1D5G6yY/giphy.gif']
const stickers = ['🌈', '🍀', '✨', '🫶', '🌻', '🐸', '🚀', '🍜']

function mapGroup(group: DatabaseGroup): Group {
  return {
    id: group.id,
    name: group.name,
    icon: group.icon,
    description: group.description,
    category: group.category,
    language: group.language,
    region: group.region,
    members: group.member_count,
    online: group.online_count,
    accent: 'blue',
  }
}

function mapMessage(message: DatabaseMessage): Message {
  return {
    id: Number.parseInt(message.id.replace(/-/g, '').slice(0, 12), 16),
    author: message.anonymous_display_name,
    avatar: message.anonymous_avatar,
    time: new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    body: message.text ?? undefined,
    kind: message.type,
    media: message.gif_url ?? message.sticker_id ?? undefined,
    reactions: message.reactions ?? {},
  }
}

function formatMembers(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 1 : 1)}k` : value.toString()
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: 'M3 10.5 12 3l9 7.5M5.5 9v10h13V9M9.5 19v-5h5v5',
    compass: 'm14.5 9.5-2.2 4.5-4.5 2.2 2.2-4.5 4.5-2.2ZM12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
    users: 'M16 20c0-2.2-1.8-4-4-4s-4 1.8-4 4M12 12a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM18 9a2.5 2.5 0 0 1 0 5M19 16c1.8.5 3 1.9 3 4M6 9a2.5 2.5 0 0 0 0 5M5 16c-1.8.5-3 1.9-3 4',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4',
    settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.6 1.6-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2H13v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.6-1.6.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H7v-2.3h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L10 7.1l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h2.3v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.6 1.6-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2V14h-.2a1.7 1.7 0 0 0-1.7 1Z',
    search: 'm20 20-4.5-4.5M10.8 17a6.2 6.2 0 1 0 0-12.4 6.2 6.2 0 0 0 0 12.4Z',
    info: 'M12 17v-5M12 8h.01M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0Z',
    smile: 'M8.5 13.5s1.2 2 3.5 2 3.5-2 3.5-2M9 9h.01M15 9h.01M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0Z',
    image: 'M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13ZM8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM5 18l4.5-4.5 3 3 2-2 4.5 4.5',
    send: 'm21 3-8.7 18-3.2-7.1L2 10.7 21 3ZM9.1 13.9 21 3',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    plus: 'M12 5v14M5 12h14',
    moon: 'M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5Z',
    shield: 'M12 21s8-3.8 8-10V5l-8-3-8 3v6c0 6.2 8 10 8 10Z',
  }
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] ?? paths.info} /></svg>
}

function App() {
  const [section, setSection] = useState<Section>('home')
  const [activeGroupId, setActiveGroupId] = useState('global')
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('gather-theme') as Theme) || 'light')
  const [messages, setMessages] = useState<Record<string, Message[]>>(initialMessages)
  const [draft, setDraft] = useState('')
  const [panel, setPanel] = useState<'emoji' | 'gif' | 'sticker' | null>(null)
  const [query, setQuery] = useState('')
  const [showMobileInfo, setShowMobileInfo] = useState(false)
  const [notice, setNotice] = useState('')
  const [isJoined, setIsJoined] = useState(true)
  const [liveGroups, setLiveGroups] = useState<Group[]>(groups)
  const [liveError, setLiveError] = useState('')
  const activeGroup = liveGroups.find((group) => group.id === activeGroupId) ?? liveGroups[0]
  const activeMessages = messages[activeGroupId] ?? []

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    void fetchPublicGroups()
      .then((data) => {
        if (cancelled) return
        const nextGroups = data.map(mapGroup)
        setLiveGroups(nextGroups)
        if (nextGroups.length > 0) {
          setActiveGroupId((current) => nextGroups.some((group) => group.id === current) ? current : nextGroups[0].id)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLiveError(error instanceof Error ? error.message : 'Unable to load groups from Supabase.')
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !activeGroup) return
    let cancelled = false
    const refreshMessages = () => {
      void fetchGroupMessages(activeGroup.id)
        .then((data) => {
          if (!cancelled) setMessages((current) => ({ ...current, [activeGroup.id]: data.map(mapMessage) }))
        })
        .catch((error: unknown) => {
          if (!cancelled) setLiveError(error instanceof Error ? error.message : 'Unable to load messages from Supabase.')
        })
    }
    refreshMessages()
    const unsubscribe = subscribeToGroupMessages(activeGroup.id, refreshMessages)
    return () => { cancelled = true; unsubscribe() }
  }, [activeGroup?.id])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('gather-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  const filteredGroups = useMemo(() => liveGroups.filter((group) => `${group.name} ${group.description} ${group.category}`.toLowerCase().includes(query.toLowerCase())), [liveGroups, query])

  function openGroup(group: Group) {
    setActiveGroupId(group.id)
    setIsJoined(group.joined === true || group.id === 'global' || group.id === 'tech')
    setSection('home')
    setPanel(null)
  }

  function sendMessage(kind: MessageKind = 'text', body = draft, media?: string) {
    if (!isJoined) {
      setNotice('Join this group to start chatting.')
      return
    }
    if (isSupabaseConfigured) {
      setNotice('Sign in and choose an anonymous identity before sending messages.')
      return
    }
    if (kind === 'text' && !body.trim()) return
    const newMessage: Message = {
      id: Date.now(),
      author: 'Alex',
      avatar: 'A',
      time: 'Just now',
      body: kind === 'text' ? body.trim() : undefined,
      kind,
      media,
      reactions: {},
      mine: true,
    }
    setMessages((current) => ({ ...current, [activeGroupId]: [...(current[activeGroupId] ?? []), newMessage] }))
    setDraft('')
    setPanel(null)
  }

  function addReaction(messageId: number, reaction: string) {
    setMessages((current) => ({
      ...current,
      [activeGroupId]: (current[activeGroupId] ?? []).map((message) => message.id === messageId ? { ...message, reactions: { ...message.reactions, [reaction]: (message.reactions[reaction] ?? 0) + 1 } } : message),
    }))
  }

  function toggleJoin() {
    setIsJoined((joined) => !joined)
    setNotice(isJoined ? `You left ${activeGroup.name}.` : `Welcome to ${activeGroup.name}!`)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">g</div><span>gather</span></div>
        <button className="profile-chip" onClick={() => setSection('settings')}><span className="avatar avatar-coral">A</span><span><strong>Alex</strong><small>Online</small></span><span className="chevron">⌄</span></button>
        <nav className="nav">
          <p className="nav-label">Workspace</p>
          <NavItem icon="home" label="Home" active={section === 'home'} onClick={() => setSection('home')} />
          <NavItem icon="compass" label="Discover" active={section === 'discover'} onClick={() => setSection('discover')} />
          <NavItem icon="users" label="My groups" active={section === 'groups'} onClick={() => setSection('groups')} count="2" />
          <NavItem icon="bell" label="Notifications" active={section === 'notifications'} onClick={() => setSection('notifications')} count="3" />
          <p className="nav-label nav-label-spaced">Account</p>
          <NavItem icon="settings" label="Settings" active={section === 'settings'} onClick={() => setSection('settings')} />
        </nav>
        <div className="sidebar-bottom">
          <div className="safety-note"><span className="safety-icon"><Icon name="shield" /></span><span><strong>Your space, your rules</strong><small>Anonymous by default</small></span></div>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}><span>{theme === 'light' ? '☾' : '☀'}</span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</button>
          <small className="version">gather v0.1 · Built for everyone</small>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-mark">g</div><span>gather</span></div>
          <div className="breadcrumbs"><span>{section === 'home' ? 'Home' : section[0].toUpperCase() + section.slice(1)}</span>{section === 'home' && <><b>/</b><strong>{activeGroup.name}</strong></>}</div>
          <div className="top-actions"><div className="search-box"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search groups" /></div><button className="icon-button notification-button" onClick={() => setSection('notifications')}><Icon name="bell" /><i>3</i></button><button className="avatar avatar-coral mobile-avatar" onClick={() => setSection('settings')}>A</button></div>
        </header>

        {liveError && <div className="live-error" role="alert">Live database error: {liveError}</div>}
        {section === 'home' && activeGroup && <ChatView activeGroup={activeGroup} activeMessages={activeMessages} isJoined={isJoined} draft={draft} setDraft={setDraft} panel={panel} setPanel={setPanel} sendMessage={sendMessage} addReaction={addReaction} onToggleJoin={toggleJoin} onToggleInfo={() => setShowMobileInfo((value) => !value)} />}
        {section === 'discover' && <DiscoverView groups={filteredGroups} query={query} setQuery={setQuery} onOpen={openGroup} />}
          {section === 'groups' && <MyGroupsView groups={liveGroups.filter((group) => group.joined)} onOpen={openGroup} onDiscover={() => setSection('discover')} />}
        {section === 'notifications' && <NotificationsView />}
        {section === 'settings' && <SettingsView theme={theme} setTheme={setTheme} />}
      </main>
      {showMobileInfo && <button className="mobile-backdrop" onClick={() => setShowMobileInfo(false)} aria-label="Close group details" />}
      {notice && <div className="toast">{notice}</div>}
    </div>
  )
}

function NavItem({ icon, label, active, count, onClick }: { icon: string; label: string; active?: boolean; count?: string; onClick: () => void }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}><Icon name={icon} /><span>{label}</span>{count && <em>{count}</em>}</button>
}

function ChatView({ activeGroup, activeMessages, isJoined, draft, setDraft, panel, setPanel, sendMessage, addReaction, onToggleJoin, onToggleInfo }: { activeGroup: Group; activeMessages: Message[]; isJoined: boolean; draft: string; setDraft: (value: string) => void; panel: 'emoji' | 'gif' | 'sticker' | null; setPanel: (value: 'emoji' | 'gif' | 'sticker' | null) => void; sendMessage: (kind?: MessageKind, body?: string, media?: string) => void; addReaction: (id: number, reaction: string) => void; onToggleJoin: () => void; onToggleInfo: () => void }) {
  return <div className="chat-layout">
    <section className="chat-column">
      <div className="chat-header">
        <div className={`group-icon group-icon-${activeGroup.accent}`}>{activeGroup.icon}</div>
        <div className="group-heading"><div><h1>{activeGroup.name}</h1><span className="status-dot" /> <span>{formatMembers(activeGroup.online)} online</span></div><p>{formatMembers(activeGroup.members)} members · {activeGroup.category}</p></div>
        <div className="chat-header-actions"><button className="join-button" onClick={onToggleJoin}>{isJoined ? 'Joined' : 'Join group'} {isJoined && '✓'}</button><button className="icon-button info-button" onClick={onToggleInfo}><Icon name="info" /></button></div>
      </div>
      <div className="room-notice"><span>✦</span><p><strong>Welcome to the global conversation.</strong> Be kind, stay curious, and remember: you are anonymous here.</p><button>View rules <Icon name="arrow" /></button></div>
      <div className="message-scroll">
        <div className="date-divider"><span>Today</span></div>
        <div className="typing"><span className="typing-dots"><i /><i /><i /></span> Anonymous Panda is typing...</div>
        {activeMessages.map((message) => <MessageBubble key={message.id} message={message} onReact={addReaction} />)}
      </div>
      <Composer draft={draft} setDraft={setDraft} panel={panel} setPanel={setPanel} onSend={() => sendMessage()} onSendMedia={sendMessage} />
    </section>
    <GroupInfo group={activeGroup} />
  </div>
}

function MessageBubble({ message, onReact }: { message: Message; onReact: (id: number, reaction: string) => void }) {
  return <article className={`message-row ${message.mine ? 'mine' : ''}`}><div className={`avatar message-avatar ${message.mine ? 'avatar-coral' : 'avatar-soft'}`}>{message.avatar}</div><div className="message-content"><div className="message-meta"><strong>{message.author}</strong>{message.mine && <span className="you-label">you</span>}<time>{message.time}</time></div>{message.body && <p>{message.body}</p>}{message.media && (message.kind === 'gif' || message.kind === 'text') && <img className="gif-message" src={message.media} alt="Shared GIF" />}{message.kind === 'sticker' && <div className="sticker-message">{message.media}</div>}{Object.keys(message.reactions).length > 0 && <div className="reaction-row">{Object.entries(message.reactions).map(([emoji, count]) => <button key={emoji} onClick={() => onReact(message.id, emoji)}>{emoji} <span>{count}</span></button>)}<button className="add-reaction" onClick={() => onReact(message.id, '❤️')}>＋</button></div>}</div></article>
}

function Composer({ draft, setDraft, panel, setPanel, onSend, onSendMedia }: { draft: string; setDraft: (value: string) => void; panel: 'emoji' | 'gif' | 'sticker' | null; setPanel: (value: 'emoji' | 'gif' | 'sticker' | null) => void; onSend: () => void; onSendMedia: (kind: MessageKind, body?: string, media?: string) => void }) {
  return <div className="composer-wrap">{panel && <div className="picker-popover">{panel === 'emoji' && <div className="emoji-picker"><div className="picker-head"><strong>Pick an emoji</strong><span>⌄</span></div><div className="emoji-grid">{emojiSet.map((emoji) => <button key={emoji} onClick={() => { setDraft(`${draft}${emoji}`); setPanel(null) }}>{emoji}</button>)}</div></div>}{panel === 'gif' && <div className="gif-picker"><div className="picker-head"><strong>GIFs</strong><span className="gif-powered">powered by GIPHY</span></div><div className="gif-search"><Icon name="search" /><span>Search reactions, moods...</span></div><div className="gif-grid">{gifs.map((gif) => <button key={gif} onClick={() => onSendMedia('gif', undefined, gif)}><img src={gif} alt="GIF option" /></button>)}</div></div>}{panel === 'sticker' && <div className="sticker-picker"><div className="picker-head"><strong>Sticker shelf</strong><span>✨ Daily pack</span></div><div className="sticker-grid">{stickers.map((sticker) => <button key={sticker} onClick={() => onSendMedia('sticker', undefined, sticker)}>{sticker}</button>)}</div></div>}</div>}
    <div className="composer"><div className="composer-tools"><button className={panel === 'emoji' ? 'tool-active' : ''} onClick={() => setPanel(panel === 'emoji' ? null : 'emoji')}><Icon name="smile" /></button><button className={panel === 'gif' ? 'tool-active' : ''} onClick={() => setPanel(panel === 'gif' ? null : 'gif')}><span className="gif-label">GIF</span></button><button className={panel === 'sticker' ? 'tool-active' : ''} onClick={() => setPanel(panel === 'sticker' ? null : 'sticker')}><span className="sticker-label">✦</span></button></div><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSend() }} placeholder="Say something kind..." /><button className="send-button" onClick={onSend} disabled={!draft.trim()}><Icon name="send" /></button></div><div className="composer-hint"><span>Messages are limited to text, GIFs and stickers.</span><span><kbd>↵</kbd> to send</span></div>
  </div>
}

function GroupInfo({ group }: { group: Group }) {
  return <aside className="group-info"><div className="info-title"><h2>About this group</h2><button className="icon-button"><Icon name="info" /></button></div><div className={`info-cover cover-${group.accent}`}><span>{group.icon}</span></div><h3>{group.name}</h3><p className="info-description">{group.description}</p><div className="info-stats"><div><strong>{formatMembers(group.members)}</strong><span>Members</span></div><div><strong>{formatMembers(group.online)}</strong><span>Online now</span></div><div><strong>🌎</strong><span>{group.region}</span></div></div><div className="info-section"><h4>Group rules</h4><ul><li>Be respectful and curious</li><li>No spam or harassment</li><li>Keep it safe for everyone</li></ul><button className="text-button">View all rules <Icon name="arrow" /></button></div><div className="info-section"><h4>Active now <span>●</span></h4><div className="online-avatars"><span>🐼</span><span className="small-avatar avatar-blue">M</span><span className="small-avatar avatar-purple">K</span><span className="small-avatar avatar-yellow">J</span><b>+ 839 others</b></div></div></aside>
}

function DiscoverView({ groups: visibleGroups, query, setQuery, onOpen }: { groups: Group[]; query: string; setQuery: (value: string) => void; onOpen: (group: Group) => void }) {
  return <div className="page-content discover-page"><div className="page-hero"><div><span className="eyebrow">YOUR NEXT CONVERSATION</span><h1>Find your people.</h1><p>Explore open rooms, meet curious minds, and join a conversation that feels like yours.</p></div><div className="hero-orb">✦</div></div><div className="discover-toolbar"><div className="large-search"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search groups, topics, or places..." /></div><button className="filter-button">Category <span>⌄</span></button><button className="filter-button">Language <span>⌄</span></button></div><div className="section-heading"><div><h2>Trending now</h2><p>Conversations with a little extra energy.</p></div><button className="text-button">View all <Icon name="arrow" /></button></div><div className="group-grid">{visibleGroups.map((group) => <GroupCard key={group.id} group={group} onOpen={onOpen} />)}</div></div>
}

function GroupCard({ group, onOpen }: { group: Group; onOpen: (group: Group) => void }) {
  return <button className="group-card" onClick={() => onOpen(group)}><div className={`card-icon group-icon-${group.accent}`}>{group.icon}</div><div className="card-main"><div className="card-top"><h3>{group.name}</h3>{group.trending && <span className="trending">Trending</span>}</div><p>{group.description}</p><div className="card-meta"><span><i className="status-dot" />{formatMembers(group.online)} online</span><span>{formatMembers(group.members)} members</span><span>{group.category}</span></div></div><span className="card-arrow"><Icon name="arrow" /></span></button>
}

function MyGroupsView({ groups: joinedGroups, onOpen, onDiscover }: { groups: Group[]; onOpen: (group: Group) => void; onDiscover: () => void }) {
  return <div className="page-content"><div className="page-heading"><div><span className="eyebrow">YOUR CORNERS OF THE WORLD</span><h1>My groups</h1><p>Pick up a conversation where you left off.</p></div><button className="primary-button" onClick={onDiscover}><Icon name="plus" /> Discover groups</button></div><div className="group-list">{joinedGroups.map((group) => <button className="joined-row" key={group.id} onClick={() => onOpen(group)}><div className={`card-icon group-icon-${group.accent}`}>{group.icon}</div><div><h3>{group.name}</h3><p>{group.description}</p></div><div className="joined-meta"><span><i className="status-dot" />{formatMembers(group.online)} online</span><Icon name="arrow" /></div></button>)}</div></div>
}

function NotificationsView() {
  return <div className="page-content narrow-page"><div className="page-heading"><div><span className="eyebrow">STAY IN THE LOOP</span><h1>Notifications</h1><p>Little signals from your communities.</p></div><button className="text-button">Mark all read</button></div><div className="notification-list"><Notification icon="🎉" title="Maya reacted to your message" text="“Working on a tiny garden project...”" time="2 min ago" unread /><Notification icon="👋" title="Welcome to Technology" text="You joined a new group." time="1 hr ago" unread /><Notification icon="🛡️" title="Your report was reviewed" text="Thanks for helping keep Gather kind." time="Yesterday" /></div></div>
}

function Notification({ icon, title, text, time, unread }: { icon: string; title: string; text: string; time: string; unread?: boolean }) {
  return <div className={`notification-row ${unread ? 'unread' : ''}`}><span className="notification-icon">{icon}</span><div><strong>{title}</strong><p>{text}</p></div><time>{time}</time>{unread && <i className="unread-dot" />}</div>
}

function SettingsView({ theme, setTheme }: { theme: Theme; setTheme: (theme: Theme) => void }) {
  return <div className="page-content narrow-page settings-page"><div className="page-heading"><div><span className="eyebrow">MAKE IT YOURS</span><h1>Settings</h1><p>Control your privacy and the way Gather feels.</p></div></div><div className="settings-card"><div className="settings-profile"><span className="avatar avatar-coral large-avatar">A</span><div><h3>Alex</h3><p>Member since September 2024</p></div><button className="text-button">Edit profile</button></div><div className="settings-group"><h4>Privacy & identity</h4><SettingRow title="Anonymous mode" description="Use a different identity in each group" control={<Toggle enabled />} /><SettingRow title="Show online status" description="Let other people see when you are around" control={<Toggle enabled />} /><SettingRow title="Allow mentions" description="Receive a notification when someone mentions you" control={<Toggle enabled />} /></div><div className="settings-group"><h4>Appearance</h4><SettingRow title="Theme" description="Choose how Gather looks to you" control={<div className="segmented"><button className={theme === 'light' ? 'selected' : ''} onClick={() => setTheme('light')}>Light</button><button className={theme === 'dark' ? 'selected' : ''} onClick={() => setTheme('dark')}>Dark</button></div>} /></div><div className="settings-group danger-zone"><h4>Account</h4><SettingRow title="Blocked users" description="Manage people you have blocked" control={<Icon name="arrow" />} /><SettingRow title="Delete account" description="Permanently remove your Gather account" control={<span className="danger-text">Delete</span>} /></div></div></div>
}

function SettingRow({ title, description, control }: { title: string; description: string; control: React.ReactNode }) {
  return <div className="setting-row"><div><strong>{title}</strong><p>{description}</p></div>{control}</div>
}

function Toggle({ enabled }: { enabled: boolean }) { return <span className={`toggle ${enabled ? 'on' : ''}`}><i /></span> }

export default App
