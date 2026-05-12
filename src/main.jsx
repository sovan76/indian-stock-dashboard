import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Archive,
  Bell,
  Bold,
  CheckSquare,
  Clock3,
  FileText,
  Folder,
  Heart,
  Highlighter,
  Italic,
  LayoutGrid,
  Link,
  ListFilter,
  ListTodo,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Plus,
  Search,
  Star,
  Tag,
  Trash2,
  Undo2,
  X
} from 'lucide-react';
import './styles.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const colors = ['plain', 'mint', 'sky', 'amber', 'rose', 'violet'];
const emptyNote = {
  title: '',
  content: '',
  folder: 'Notes',
  tags: [],
  color: 'plain',
  pinned: false,
  favorite: false,
  archived: false,
  trashed: false,
  reminderAt: ''
};

function formatDate(value) {
  if (!value) return 'No edits yet';
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function markdownToHtml(value) {
  const escaped = value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^- \[x\] (.*)$/gim, '<label class="preview-check"><input type="checkbox" checked disabled />$1</label>')
    .replace(/^- \[ \] (.*)$/gim, '<label class="preview-check"><input type="checkbox" disabled />$1</label>')
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    .replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\n/g, '<br />');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function IconButton({ active, label, children, className = '', ...props }) {
  return (
    <button className={`icon-button ${active ? 'is-active' : ''} ${className}`} aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}

function Sidebar({ notes, view, setView, folder, setFolder, tag, setTag, collapsed, setCollapsed }) {
  const folders = unique(notes.filter((note) => !note.trashed).map((note) => note.folder));
  const tags = unique(notes.flatMap((note) => note.tags));
  const activeCount = notes.filter((note) => !note.archived && !note.trashed).length;
  const favoriteCount = notes.filter((note) => note.favorite && !note.trashed).length;
  const archiveCount = notes.filter((note) => note.archived && !note.trashed).length;
  const trashCount = notes.filter((note) => note.trashed).length;

  function pickView(nextView) {
    setView(nextView);
    setFolder('');
    setTag('');
  }

  return (
    <aside className={`sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="brand">
        <div className="brand-mark"><FileText size={20} /></div>
        <div>
          <strong>Noteflow</strong>
          <span>MERN workspace</span>
        </div>
        <IconButton label={collapsed ? 'Open sidebar' : 'Close sidebar'} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </IconButton>
      </div>

      <nav className="nav-list">
        <button className={view === 'active' && !folder && !tag ? 'active' : ''} onClick={() => pickView('active')}>
          <LayoutGrid size={18} /><span>All notes</span><em>{activeCount}</em>
        </button>
        <button className={view === 'favorite' ? 'active' : ''} onClick={() => pickView('favorite')}>
          <Heart size={18} /><span>Favorites</span><em>{favoriteCount}</em>
        </button>
        <button className={view === 'archive' ? 'active' : ''} onClick={() => pickView('archive')}>
          <Archive size={18} /><span>Archive</span><em>{archiveCount}</em>
        </button>
        <button className={view === 'trash' ? 'active' : ''} onClick={() => pickView('trash')}>
          <Trash2 size={18} /><span>Trash</span><em>{trashCount}</em>
        </button>
      </nav>

      <section className="side-section">
        <h2><Folder size={15} /> Folders</h2>
        {folders.map((item) => (
          <button key={item} className={folder === item ? 'active' : ''} onClick={() => {
            setView('active');
            setFolder(item);
            setTag('');
          }}>
            <span>{item}</span><em>{notes.filter((note) => note.folder === item && !note.trashed).length}</em>
          </button>
        ))}
      </section>

      <section className="side-section">
        <h2><Tag size={15} /> Tags</h2>
        <div className="tag-cloud">
          {tags.map((item) => (
            <button key={item} className={tag === item ? 'active' : ''} onClick={() => {
              setView('active');
              setTag(item);
              setFolder('');
            }}>
              #{item}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}

function NoteCard({ note, selected, onSelect }) {
  const firstLine = note.content.replace(/[#>*`-]/g, '').split('\n').find(Boolean) || 'No body text yet';

  return (
    <button className={`note-card color-${note.color} ${selected ? 'selected' : ''}`} onClick={() => onSelect(note.id)}>
      <div className="note-card-top">
        <strong>{note.title || 'Untitled note'}</strong>
        <span>{note.pinned && <Pin size={14} />}{note.favorite && <Heart size={14} />}</span>
      </div>
      <p>{firstLine}</p>
      <div className="card-meta">
        <span>{note.folder}</span>
        <span>{formatDate(note.updatedAt)}</span>
      </div>
      <div className="mini-tags">
        {note.tags.slice(0, 3).map((item) => <em key={item}>#{item}</em>)}
      </div>
    </button>
  );
}

function Editor({ draft, setDraft, saveNote, createNote, moveToTrash, permanentlyDelete, restoring }) {
  const [preview, setPreview] = useState(false);
  const contentRef = useRef(null);

  function insertText(before, after = '') {
    const target = contentRef.current;
    const start = target?.selectionStart ?? draft.content.length;
    const end = target?.selectionEnd ?? draft.content.length;
    const selected = draft.content.slice(start, end);
    const next = `${draft.content.slice(0, start)}${before}${selected}${after}${draft.content.slice(end)}`;
    setDraft({ ...draft, content: next });
  }

  function setTagValue(value) {
    setDraft({
      ...draft,
      tags: value.split(',').map((item) => item.trim()).filter(Boolean)
    });
  }

  if (!draft?.id) {
    return (
      <section className="editor empty-editor">
        <FileText size={42} />
        <h2>Select a note</h2>
        <p>Choose a note from the list or create a fresh one.</p>
        <button className="primary-button" onClick={createNote}><Plus size={18} /> New note</button>
      </section>
    );
  }

  return (
    <section className={`editor color-${draft.color}`}>
      <div className="editor-toolbar">
        <div className="tool-group">
          <IconButton label="Bold" onClick={() => insertText('**', '**')}><Bold size={17} /></IconButton>
          <IconButton label="Italic" onClick={() => insertText('*', '*')}><Italic size={17} /></IconButton>
          <IconButton label="Heading" onClick={() => insertText('## ')}><Highlighter size={17} /></IconButton>
          <IconButton label="Checklist" onClick={() => insertText('\n- [ ] ')}><CheckSquare size={17} /></IconButton>
          <IconButton label="Link" onClick={() => insertText('[', '](https://)')}><Link size={17} /></IconButton>
        </div>
        <div className="tool-group">
          <IconButton label="Pin note" active={draft.pinned} onClick={() => saveNote({ pinned: !draft.pinned })}><Pin size={17} /></IconButton>
          <IconButton label="Favorite note" active={draft.favorite} onClick={() => saveNote({ favorite: !draft.favorite })}><Star size={17} /></IconButton>
          <IconButton label={preview ? 'Edit note' : 'Preview note'} active={preview} onClick={() => setPreview(!preview)}><FileText size={17} /></IconButton>
          <IconButton label={draft.trashed ? 'Restore note' : 'Move to trash'} onClick={draft.trashed ? restoring : moveToTrash}>
            {draft.trashed ? <Undo2 size={17} /> : <Trash2 size={17} />}
          </IconButton>
          {draft.trashed && <IconButton label="Delete forever" className="danger" onClick={permanentlyDelete}><X size={17} /></IconButton>}
        </div>
      </div>

      <input
        className="title-input"
        value={draft.title}
        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        onBlur={() => saveNote({ title: draft.title })}
        placeholder="Untitled note"
      />

      <div className="property-grid">
        <label><Folder size={16} /><input value={draft.folder} onChange={(event) => setDraft({ ...draft, folder: event.target.value })} onBlur={() => saveNote({ folder: draft.folder })} /></label>
        <label><Tag size={16} /><input value={draft.tags.join(', ')} onChange={(event) => setTagValue(event.target.value)} onBlur={() => saveNote({ tags: draft.tags })} placeholder="tags, separated, by commas" /></label>
        <label><Bell size={16} /><input type="datetime-local" value={draft.reminderAt?.slice(0, 16) || ''} onChange={(event) => {
          const value = event.target.value ? new Date(event.target.value).toISOString() : '';
          setDraft({ ...draft, reminderAt: value });
          saveNote({ reminderAt: value });
        }} /></label>
      </div>

      <div className="color-row">
        {colors.map((item) => (
          <button key={item} className={`swatch color-${item} ${draft.color === item ? 'active' : ''}`} aria-label={`Set ${item} color`} onClick={() => saveNote({ color: item })} />
        ))}
      </div>

      {preview ? (
        <article className="preview" dangerouslySetInnerHTML={{ __html: markdownToHtml(draft.content || 'Nothing to preview yet.') }} />
      ) : (
        <textarea
          ref={contentRef}
          value={draft.content}
          onChange={(event) => setDraft({ ...draft, content: event.target.value })}
          onBlur={() => saveNote({ content: draft.content })}
          placeholder="Start writing..."
        />
      )}
    </section>
  );
}

function App() {
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState(emptyNote);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('active');
  const [folder, setFolder] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState('updated');
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const saveTimer = useRef(null);

  async function loadNotes() {
    setLoading(true);
    const response = await fetch(`${API_BASE}/api/notes?status=all`);
    const payload = await response.json();
    setNotes(payload.notes);
    setSelectedId((current) => current || payload.notes[0]?.id || '');
    setLoading(false);
  }

  useEffect(() => {
    loadNotes().catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const active = notes.find((note) => note.id === selectedId);
    setDraft(active || emptyNote);
  }, [notes, selectedId]);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);

  useEffect(() => {
    if (!draft.id) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveNote({ title: draft.title, content: draft.content, folder: draft.folder, tags: draft.tags }, false);
    }, 900);
    return () => window.clearTimeout(saveTimer.current);
  }, [draft.title, draft.content, draft.folder, draft.tags]);

  const filteredNotes = useMemo(() => {
    const lower = query.trim().toLowerCase();
    const list = notes.filter((note) => {
      if (view === 'active' && (note.archived || note.trashed)) return false;
      if (view === 'favorite' && (!note.favorite || note.trashed)) return false;
      if (view === 'archive' && (!note.archived || note.trashed)) return false;
      if (view === 'trash' && !note.trashed) return false;
      if (folder && note.folder !== folder) return false;
      if (tag && !note.tags.includes(tag)) return false;
      if (lower && ![note.title, note.content, note.folder, ...note.tags].join(' ').toLowerCase().includes(lower)) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sort === 'title') return (a.title || '').localeCompare(b.title || '');
      if (sort === 'created') return new Date(b.createdAt) - new Date(a.createdAt);
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }, [notes, query, view, folder, tag, sort]);

  const stats = useMemo(() => ({
    total: notes.filter((note) => !note.trashed).length,
    pinned: notes.filter((note) => note.pinned && !note.trashed).length,
    reminders: notes.filter((note) => note.reminderAt && !note.trashed).length,
    tasks: notes.reduce((count, note) => count + (note.content.match(/- \[ \]/g) || []).length, 0)
  }), [notes]);

  async function createNote() {
    const response = await fetch(`${API_BASE}/api/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...emptyNote, title: 'Untitled note', folder: folder || 'Notes', tags: tag ? [tag] : [] })
    });
    const payload = await response.json();
    setNotes((current) => [payload.note, ...current]);
    setSelectedId(payload.note.id);
  }

  async function saveNote(patch, syncDraft = true) {
    if (!draft.id) return;
    const next = { ...draft, ...patch, updatedAt: new Date().toISOString() };
    if (syncDraft) setDraft(next);
    setNotes((current) => current.map((note) => note.id === draft.id ? next : note));
    const response = await fetch(`${API_BASE}/api/notes/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    if (response.ok) {
      const payload = await response.json();
      setNotes((current) => current.map((note) => note.id === payload.note.id ? payload.note : note));
    }
  }

  async function moveToTrash() {
    await saveNote({ trashed: true, archived: false });
    setView('trash');
  }

  async function restoreNote() {
    await saveNote({ trashed: false, archived: false });
    setView('active');
  }

  async function permanentlyDelete() {
    if (!draft.id) return;
    await fetch(`${API_BASE}/api/notes/${draft.id}`, { method: 'DELETE' });
    setNotes((current) => current.filter((note) => note.id !== draft.id));
    setSelectedId(filteredNotes.find((note) => note.id !== draft.id)?.id || '');
  }

  return (
    <main className="app-shell">
      <Sidebar
        notes={notes}
        view={view}
        setView={setView}
        folder={folder}
        setFolder={setFolder}
        tag={tag}
        setTag={setTag}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      <section className="workspace">
        <header className="topbar">
          <div>
            <p>{loading ? 'Syncing workspace' : `${stats.total} notes stored`}</p>
            <h1>{folder || (tag ? `#${tag}` : view === 'active' ? 'All notes' : view)}</h1>
          </div>
          <div className="top-actions">
            <IconButton label="Toggle theme" onClick={() => setDark(!dark)}><Moon size={18} /></IconButton>
            <button className="primary-button" onClick={createNote}><Plus size={18} /> New note</button>
          </div>
        </header>

        <section className="command-bar">
          <label className="search-box">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes, tags, folders, or text" />
          </label>
          <label className="sort-control">
            <ListFilter size={17} />
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="updated">Updated</option>
              <option value="created">Created</option>
              <option value="title">Title</option>
            </select>
          </label>
        </section>

        <section className="stat-strip">
          <span><Pin size={16} /> {stats.pinned} pinned</span>
          <span><Bell size={16} /> {stats.reminders} reminders</span>
          <span><ListTodo size={16} /> {stats.tasks} open tasks</span>
          <span><Clock3 size={16} /> Autosave on</span>
        </section>

        <div className="content-layout">
          <section className="notes-column">
            {filteredNotes.length ? filteredNotes.map((note) => (
              <NoteCard key={note.id} note={note} selected={note.id === selectedId} onSelect={setSelectedId} />
            )) : (
              <div className="empty-list">
                <MoreHorizontal size={32} />
                <strong>No notes here</strong>
                <p>Try a different filter or create a new note.</p>
              </div>
            )}
          </section>

          <Editor
            draft={draft}
            setDraft={setDraft}
            saveNote={saveNote}
            createNote={createNote}
            moveToTrash={moveToTrash}
            permanentlyDelete={permanentlyDelete}
            restoring={restoreNote}
          />
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
