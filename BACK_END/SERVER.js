require('dotenv').config();

const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const frontendPath = path.join(__dirname, '..', 'FRENT_END');

app.use(express.json({ limit: '500kb' }));

const templeSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  temple_name: { type: String, required: true },
  location: {
    state: { type: String, required: true },
    city: { type: String, required: true }
  },
  religion: { type: String, default: 'Not specified' },
  site_type: { type: String, default: 'Temple' },
  wikidata_id: { type: String, default: '' },
  source_url: { type: String, default: '' },
  deity: { type: String, required: true },
  historical_background: { type: String, required: true },
  darshan_timings: { type: String, required: true },
  festivals: { type: [String], required: true },
  visitor_guidelines: { type: [String], required: true },
  image_url: { type: String, required: true },
  image_attribution: { type: String, default: '' },
  image_license: { type: String, default: '' },
  image_license_url: { type: String, default: '' },
  image_source_url: { type: String, default: '' },
  booking_information: { type: String, required: true },
  official_links: [{
    label: { type: String, required: true },
    url: { type: String, required: true }
  }]
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  usernameKey: { type: String, required: true, unique: true },
  passwordSalt: { type: String, required: true },
  passwordHash: { type: String, required: true },
  avatar: { type: String, default: '' },
  displayName: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  savedSiteSlugs: { type: [String], default: [] }
});

const sessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  expiresAt: { type: Date, required: true, expires: 0 }
});

const Temple = mongoose.model('Temple', templeSchema);
const User = mongoose.model('User', userSchema);
const UserSession = mongoose.model('UserSession', sessionSchema);

function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey.toString('hex'));
    });
  });
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

app.get('/api/temples/:slug', async (req, res, next) => {
  try {
    const temple = await Temple.findOne({ slug: req.params.slug })
      .select('-_id -__v')
      .lean();
    if (!temple) {
      return res.status(404).json({ error: 'Place of worship not found.' });
    }
    res.json({ temple });
  } catch (error) {
    next(error);
  }
});

app.get('/api/temples', async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim().slice(0, 100);
    const state = String(req.query.state || '').trim().slice(0, 80);
    const filter = {};

    if (query) {
      const search = new RegExp(escapeRegex(query), 'i');
      filter.$or = [
        { temple_name: search },
        { 'location.city': search },
        { 'location.state': search },
        { religion: search },
        { site_type: search },
        { deity: search },
        { historical_background: search },
        { festivals: search },
        { visitor_guidelines: search }
      ];
    }
    if (state) {
      filter['location.state'] = new RegExp(`^${escapeRegex(state)}$`, 'i');
    }

    const temples = await Temple.find(filter)
      .select('-_id -__v')
      .sort({ temple_name: 1 })
      .lean();
    res.json({ temples });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/signup', async (req, res, next) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const avatar = typeof req.body.avatar === 'string' ? req.body.avatar : '';

    if (!/^[a-zA-Z0-9_-]{3,40}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-40 characters using letters, numbers, _ or -.' });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    }
    if (avatar && (!/^data:image\/(?:jpeg|png|webp|gif);base64,/.test(avatar) || avatar.length > 400000)) {
      return res.status(400).json({ error: 'Profile photo must be a supported image under 300 KB.' });
    }

    const usernameKey = username.toLowerCase();
    if (await User.exists({ usernameKey })) {
      return res.status(409).json({ error: 'That username is already registered.' });
    }

    const passwordSalt = crypto.randomBytes(16).toString('hex');
    const passwordHash = await hashPassword(password, passwordSalt);
    const user = await User.create({ username, usernameKey, passwordSalt, passwordHash, avatar });
    res.status(201).json({ message: 'Account created. You can now log in.', username: user.username });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'That username is already registered.' });
    }
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const user = await User.findOne({ usernameKey: username.toLowerCase() });

    const passwordHash = user ? await hashPassword(password, user.passwordSalt) : '';
    const passwordMatches = user
      && crypto.timingSafeEqual(Buffer.from(passwordHash, 'hex'), Buffer.from(user.passwordHash, 'hex'));
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Username or password is incorrect.' });
    }

    const token = createSessionToken();
    await UserSession.create({
      tokenHash: hashSessionToken(token),
      userId: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    res.json({
      token,
      user: { username: user.username, avatar: user.avatar }
    });
  } catch (error) {
    next(error);
  }
});

async function requireSession(req, res, next) {
  try {
    const authorization = req.get('authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) {
      return res.status(401).json({ error: 'Please log in to continue.' });
    }

    const session = await UserSession.findOne({
      tokenHash: hashSessionToken(token),
      expiresAt: { $gt: new Date() }
    });
    if (!session) {
      return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
    }

    const user = await User.findById(session.userId)
      .select('username avatar displayName phone email savedSiteSlugs');
    if (!user) {
      return res.status(401).json({ error: 'Your account is no longer available.' });
    }
    res.set('Cache-Control', 'no-store');
    req.user = user;
    req.session = session;
    next();
  } catch (error) {
    next(error);
  }
}

app.get('/api/auth/me', requireSession, (req, res) => {
  res.json({
    user: {
      username: req.user.username,
      avatar: req.user.avatar,
      displayName: req.user.displayName,
      phone: req.user.phone,
      email: req.user.email
    }
  });
});

app.get('/api/account/profile', requireSession, (req, res) => {
  res.json({
    profile: {
      username: req.user.username,
      displayName: req.user.displayName,
      phone: req.user.phone,
      email: req.user.email,
      avatar: req.user.avatar
    }
  });
});

app.put('/api/account/profile', requireSession, async (req, res, next) => {
  try {
    const displayName = typeof req.body.displayName === 'string' ? req.body.displayName.trim() : null;
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : null;
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : req.user.email;
    const avatar = typeof req.body.avatar === 'string' ? req.body.avatar : null;

    if (displayName === null || displayName.length > 80) {
      return res.status(400).json({ error: 'Name must be 80 characters or fewer.' });
    }
    if (phone === null || (phone && !/^[+0-9().\-\s]{7,25}$/.test(phone))) {
      return res.status(400).json({ error: 'Enter a phone number using 7-25 digits and common phone symbols.' });
    }
    if (email === null || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (avatar === null || (avatar && (!/^data:image\/(?:jpeg|png|webp|gif);base64,/.test(avatar) || avatar.length > 400000))) {
      return res.status(400).json({ error: 'Profile photo must be a supported image under 300 KB.' });
    }

    req.user.displayName = displayName;
    req.user.phone = phone;
    req.user.email = email;
    req.user.avatar = avatar;
    await req.user.save();
    res.json({
      message: 'Your details have been saved.',
      profile: {
        username: req.user.username,
        displayName: req.user.displayName,
        phone: req.user.phone,
        email: req.user.email,
        avatar: req.user.avatar
      }
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/account/password', requireSession, async (req, res, next) => {
  try {
    const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
    const confirmPassword = typeof req.body.confirmPassword === 'string' ? req.body.confirmPassword : '';

    if (!currentPassword || currentPassword.length > 128) {
      return res.status(400).json({ error: 'Enter your current password.' });
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ error: 'Your new password must be between 8 and 128 characters.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'The new passwords do not match.' });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ error: 'Choose a new password different from your current password.' });
    }

    const user = await User.findById(req.user._id).select('passwordSalt passwordHash');
    if (!user) {
      return res.status(401).json({ error: 'Your account is no longer available.' });
    }

    const currentHash = await hashPassword(currentPassword, user.passwordSalt);
    const passwordMatches = crypto.timingSafeEqual(
      Buffer.from(currentHash, 'hex'),
      Buffer.from(user.passwordHash, 'hex')
    );
    if (!passwordMatches) {
      return res.status(400).json({ error: 'Your current password is incorrect.' });
    }

    user.passwordSalt = crypto.randomBytes(16).toString('hex');
    user.passwordHash = await hashPassword(newPassword, user.passwordSalt);
    await user.save();
    res.json({ message: 'Your password has been updated.' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/account/saved-sites', requireSession, async (req, res, next) => {
  try {
    const savedSiteSlugs = req.user.savedSiteSlugs || [];
    const sites = await Temple.find({ slug: { $in: savedSiteSlugs } })
      .select('-_id -__v')
      .lean();
    const sitesBySlug = new Map(sites.map((site) => [site.slug, site]));
    res.json({
      savedSlugs: savedSiteSlugs,
      temples: savedSiteSlugs.map((slug) => sitesBySlug.get(slug)).filter(Boolean)
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/account/saved-sites/:slug', requireSession, async (req, res, next) => {
  try {
    const siteExists = await Temple.exists({ slug: req.params.slug });
    if (!siteExists) {
      return res.status(404).json({ error: 'Place of worship not found.' });
    }
    const savedSlugs = req.user.savedSiteSlugs || [];
    if (!savedSlugs.includes(req.params.slug) && savedSlugs.length >= 200) {
      return res.status(400).json({ error: 'Your saved list is full. Remove a saved place before adding another.' });
    }
    await User.updateOne(
      { _id: req.user._id },
      { $addToSet: { savedSiteSlugs: req.params.slug } }
    );
    res.json({ message: 'Place added to your saved list.', saved: true });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/account/saved-sites/:slug', requireSession, async (req, res, next) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $pull: { savedSiteSlugs: req.params.slug } }
    );
    res.json({ message: 'Place removed from your saved list.', saved: false });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', requireSession, async (req, res, next) => {
  try {
    await req.session.deleteOne();
    res.json({ message: 'Logged out.' });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(frontendPath));
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use((error, req, res, next) => {
  console.error('API error:', error.message);
  if (res.headersSent) {
    return next(error);
  }
  res.status(500).json({ error: 'The server could not complete the request.' });
});

async function startServer() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri || mongoUri.includes('user_123')) {
    throw new Error('Set a valid MONGODB_URI in BACK_END/.env before starting the server.');
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
