import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const starterNotes = [
  {
    title: 'Launch plan',
    content: '## Today\n- [x] Sketch the workspace\n- [ ] Connect MongoDB\n- [ ] Invite collaborators\n\nKeep the first release focused, fast, and pleasant to use.',
    folder: 'Work',
    tags: ['planning', 'release'],
    color: 'mint',
    pinned: true,
    favorite: true,
    archived: false,
    trashed: false,
    reminderAt: new Date(Date.now() + 86400000).toISOString()
  },
  {
    title: 'Reading list',
    content: 'Books, articles, and loose ideas worth revisiting.\n\n> Capture first. Organize later.',
    folder: 'Personal',
    tags: ['ideas'],
    color: 'sky',
    pinned: false,
    favorite: false,
    archived: false,
    trashed: false,
    reminderAt: ''
  },
  {
    title: 'Meeting notes',
    content: '### Product sync\n\n**Decisions**\n- Ship notes MVP with offline-friendly fallback\n- Add keyboard-friendly search\n\n**Next**\n- Review API model\n- Polish empty states',
    folder: 'Work',
    tags: ['meeting', 'product'],
    color: 'amber',
    pinned: false,
    favorite: false,
    archived: false,
    trashed: false,
    reminderAt: ''
  }
];

function now() {
  return new Date().toISOString();
}

function makeNote(payload = {}) {
  const date = now();

  return {
    id: crypto.randomUUID(),
    title: payload.title?.trim() || 'Untitled note',
    content: payload.content || '',
    folder: payload.folder?.trim() || 'Notes',
    tags: Array.isArray(payload.tags) ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    color: payload.color || 'plain',
    pinned: Boolean(payload.pinned),
    favorite: Boolean(payload.favorite),
    archived: Boolean(payload.archived),
    trashed: Boolean(payload.trashed),
    reminderAt: payload.reminderAt || '',
    createdAt: date,
    updatedAt: date
  };
}

function normalizeNote(note) {
  const raw = note.toObject ? note.toObject() : note;
  return {
    ...raw,
    id: raw.id || raw._id?.toString()
  };
}

let NoteModel = null;
let memoryNotes = starterNotes.map(makeNote);

async function connectMongo() {
  if (!process.env.MONGODB_URI) {
    return;
  }

  try {
    const mongoose = await import('mongoose');
    await mongoose.connect(process.env.MONGODB_URI);

    const noteSchema = new mongoose.Schema(
      {
        title: { type: String, required: true, default: 'Untitled note' },
        content: { type: String, default: '' },
        folder: { type: String, default: 'Notes' },
        tags: { type: [String], default: [] },
        color: { type: String, default: 'plain' },
        pinned: { type: Boolean, default: false },
        favorite: { type: Boolean, default: false },
        archived: { type: Boolean, default: false },
        trashed: { type: Boolean, default: false },
        reminderAt: { type: String, default: '' }
      },
      {
        timestamps: true,
        toJSON: {
          virtuals: true,
          versionKey: false,
          transform: (_doc, ret) => {
            ret.id = ret._id.toString();
            delete ret._id;
          }
        }
      }
    );

    NoteModel = mongoose.models.Note || mongoose.model('Note', noteSchema);
    const count = await NoteModel.countDocuments();
    if (!count) {
      await NoteModel.insertMany(starterNotes);
    }
    console.log('MongoDB connected for notes storage');
  } catch (error) {
    console.warn(`MongoDB unavailable, using memory store: ${error.message}`);
  }
}

function sortNotes(notes) {
  return notes.sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
}

async function listNotes(query = {}) {
  if (NoteModel) {
    const mongoQuery = {};
    if (query.status === 'archive') mongoQuery.archived = true;
    if (query.status === 'trash') mongoQuery.trashed = true;
    if (!query.status || query.status === 'active') {
      mongoQuery.archived = false;
      mongoQuery.trashed = false;
    }
    if (query.folder) mongoQuery.folder = query.folder;
    if (query.tag) mongoQuery.tags = query.tag;
    if (query.favorite === 'true') mongoQuery.favorite = true;

    const notes = await NoteModel.find(mongoQuery).sort({ pinned: -1, updatedAt: -1 });
    return notes.map(normalizeNote);
  }

  return sortNotes(memoryNotes.filter((note) => {
    if (query.status === 'archive' && !note.archived) return false;
    if (query.status === 'trash' && !note.trashed) return false;
    if ((!query.status || query.status === 'active') && (note.archived || note.trashed)) return false;
    if (query.folder && note.folder !== query.folder) return false;
    if (query.tag && !note.tags.includes(query.tag)) return false;
    if (query.favorite === 'true' && !note.favorite) return false;
    return true;
  }));
}

async function findNote(id) {
  if (NoteModel) {
    const note = await NoteModel.findById(id);
    return note ? normalizeNote(note) : null;
  }

  return memoryNotes.find((note) => note.id === id) || null;
}

async function createNote(payload) {
  const note = makeNote(payload);
  if (NoteModel) {
    const created = await NoteModel.create(note);
    return normalizeNote(created);
  }

  memoryNotes.unshift(note);
  return note;
}

async function updateNote(id, payload) {
  const patch = {
    ...payload,
    tags: Array.isArray(payload.tags) ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean) : undefined,
    updatedAt: now()
  };

  Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);

  if (NoteModel) {
    const updated = await NoteModel.findByIdAndUpdate(id, patch, { new: true });
    return updated ? normalizeNote(updated) : null;
  }

  const index = memoryNotes.findIndex((note) => note.id === id);
  if (index === -1) return null;
  memoryNotes[index] = { ...memoryNotes[index], ...patch };
  return memoryNotes[index];
}

async function deleteNote(id) {
  if (NoteModel) {
    const deleted = await NoteModel.findByIdAndDelete(id);
    return Boolean(deleted);
  }

  const before = memoryNotes.length;
  memoryNotes = memoryNotes.filter((note) => note.id !== id);
  return before !== memoryNotes.length;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, database: NoteModel ? 'mongodb' : 'memory' });
});

app.get('/api/notes', async (req, res) => {
  const notes = await listNotes(req.query);
  res.json({ notes });
});

app.get('/api/notes/:id', async (req, res) => {
  const note = await findNote(req.params.id);
  if (!note) {
    return res.status(404).json({ message: 'Note not found' });
  }
  res.json({ note });
});

app.post('/api/notes', async (req, res) => {
  const note = await createNote(req.body);
  res.status(201).json({ note });
});

app.patch('/api/notes/:id', async (req, res) => {
  const note = await updateNote(req.params.id, req.body);
  if (!note) {
    return res.status(404).json({ message: 'Note not found' });
  }
  res.json({ note });
});

app.delete('/api/notes/:id', async (req, res) => {
  const deleted = await deleteNote(req.params.id);
  if (!deleted) {
    return res.status(404).json({ message: 'Note not found' });
  }
  res.status(204).end();
});

connectMongo().finally(() => {
  app.listen(PORT, () => {
    console.log(`Notes API running on http://localhost:${PORT}`);
  });
});
