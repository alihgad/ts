import assert from 'node:assert/strict';
import { after, before, test, mock } from 'node:test';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
process.env.MONGODB_URI = 'mongodb://127.0.0.1/test';

let mongo: MongoMemoryServer;
let app: import('express').Express;
let database: typeof import('../src/config/database').default;
let users: typeof import('../src/models/user.model').default;

before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  database = (await import('../src/config/database')).default;
  users = (await import('../src/models/user.model')).default;
  app = (await import('../src/app')).default.app;
  await database.connect();
});

after(async () => {
  await database?.disconnect();
  await mongo?.stop();
});

test('health endpoint reports MongoDB readiness', async () => {
  const response = await request(app).get('/health').expect(200);
  assert.deepEqual(response.body, { status: 'ok', database: 'connected' });
  assert.equal(response.headers['cache-control'], 'no-store');
  const health = mock.method(database, 'isHealthy', async () => false);
  try {
    const unavailable = await request(app).get('/health').expect(503);
    assert.deepEqual(unavailable.body, { status: 'unavailable', database: 'unavailable' });
  } finally {
    health.mock.restore();
  }
});

test('signup and login use normalized email, hashed password and a valid token', async () => {
  const signup = await request(app).post('/api/users/signup').send({
    name: ' Ali ', email: ' ALI@example.com ', password: 'strong-password',
  }).expect(201);
  assert.deepEqual(signup.body.user, {
    id: signup.body.user.id, name: 'Ali', email: 'ali@example.com',
  });
  assert.deepEqual(Object.keys(signup.body).sort(), ['token', 'user']);
  const decoded = jwt.verify(signup.body.token, process.env.JWT_SECRET!, { algorithms: ['HS256'] });
  assert.equal(typeof decoded === 'object' && decoded.sub, signup.body.user.id);
  const user = await users.model.findOne({ email: 'ali@example.com' }).select('+passwordHash');
  assert.ok(user);
  assert.notEqual(user.passwordHash, 'strong-password');
  assert.ok(await bcrypt.compare('strong-password', user.passwordHash));
  assert.equal((await users.model.findById(user._id))?.passwordHash, undefined);
  const login = await request(app).post('/api/users/login').send({
    email: 'ALI@example.com', password: 'strong-password',
  }).expect(200);
  assert.deepEqual(login.body.user, signup.body.user);
  await request(app).post('/api/users/signup').send({
    name: 'Ali', email: 'ali@example.com', password: 'strong-password',
  }).expect(409);
});

test('invalid credentials return the same generic response', async () => {
  for (const email of ['ali@example.com', 'missing@example.com']) {
    const response = await request(app).post('/api/users/login').send({ email, password: 'wrong' }).expect(401);
    assert.equal(response.body.message, 'Invalid email or password');
  }
});

test('invalid input and malformed JSON are rejected', async () => {
  for (const body of [
    {}, { name: 'Ali', email: 'invalid', password: 'strong-password' },
    { name: 'Ali', email: 'a@example.com', password: 'short' },
    { name: 'Ali', email: 'a@example.com', password: '😀'.repeat(20) },
    { name: 'Ali', email: { $ne: null }, password: 'strong-password' },
  ]) {
    await request(app).post('/api/users/signup').send(body).expect(400);
  }
  await request(app).post('/api/users/login').set('Content-Type', 'application/json').send('{').expect(400);
  await request(app).get('/missing').expect(404);
});

test('concurrent signup for one email creates only one user', async () => {
  const body = { name: 'Race', email: 'race@example.com', password: 'strong-password' };
  const responses = await Promise.all([
    request(app).post('/api/users/signup').send(body),
    request(app).post('/api/users/signup').send(body),
  ]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  assert.equal(await users.model.countDocuments({ email: body.email }), 1);
});

test('Bearer middleware accepts signup/login tokens and rejects deleted users', async () => {
  const body = { name: 'Protected', email: 'protected@example.com', password: 'strong-password' };
  const signup = await request(app).post('/api/users/signup').send(body).expect(201);
  const login = await request(app).post('/api/users/login').send(body).expect(200);
  for (const token of [signup.body.token, login.body.token]) {
    const response = await request(app).get('/api/users/me')
      .set('Authorization', `Bearer ${token}`).expect(200);
    assert.deepEqual(response.body, { user: signup.body.user });
  }
  await users.model.findByIdAndDelete(signup.body.user.id);
  await request(app).get('/api/users/me')
    .set('Authorization', `Bearer ${login.body.token}`).expect(401);
});

test('Bearer middleware rejects missing, malformed, forged and expired tokens', async () => {
  const secret = process.env.JWT_SECRET!;
  const subject = '507f1f77bcf86cd799439011';
  const tokens = [
    'not-a-token',
    jwt.sign({}, 'another-secret-that-is-long-enough', { subject, expiresIn: '1h' }),
    jwt.sign({}, secret, { subject, expiresIn: -1 }),
    jwt.sign({}, secret, { subject, expiresIn: '1h', algorithm: 'HS384' }),
    jwt.sign({}, secret, { subject: 'invalid-id', expiresIn: '1h' }),
    jwt.sign({}, secret, { subject }),
    jwt.sign({}, secret, { expiresIn: '1h' }),
    jwt.sign({}, secret, { subject, expiresIn: '1h' }),
  ];
  for (const header of ['', 'Basic abc', 'Bearer', 'Bearer one two', ...tokens.map(token => `Bearer ${token}`)]) {
    const response = await request(app).get('/api/users/me').set('Authorization', header).expect(401);
    assert.ok(response.headers['www-authenticate']?.startsWith('Bearer'));
    assert.equal(response.body.user, undefined);
  }
});
