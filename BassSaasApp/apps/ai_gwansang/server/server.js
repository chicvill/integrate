import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: 'D:\\Workstation\\MQnet\\.env' });

const app = express();
const PORT = 4000;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const rateLimitMap = new Map();

const plans = {
  starter: { id: 'starter', name: 'Starter', price: 29000, limit: 50 },
  pro: { id: 'pro', name: 'Pro', price: 99000, limit: 500 },
  enterprise: { id: 'enterprise', name: 'Enterprise', price: 299000, limit: '무제한' },
};

const tenants = new Map();
const tokens = new Map();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

const hashPassword = (password) =>
  crypto.createHash('sha256').update(password).digest('hex');

const createToken = () => crypto.randomUUID();

const ensureTenant = (tenantId) => {
  const normalized = String(tenantId || '').trim();

  if (!normalized) {
    throw new Error('tenantId가 필요합니다.');
  }

  if (!tenants.has(normalized)) {
    tenants.set(normalized, {
      tenantId: normalized,
      createdAt: new Date().toISOString(),
      users: new Map(),
      sessions: [],
      planId: 'starter',
      billingStatus: 'trial',
    });
  }

  return tenants.get(normalized);
};

const resolveUserFromToken = (authorizationHeader) => {
  const token = authorizationHeader?.replace('Bearer ', '').trim();
  if (!token || !tokens.has(token)) return null;

  return tokens.get(token);
};

const buildSafeUser = (user) => ({
  id: user.id,
  tenantId: user.tenantId,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  planId: user.planId || 'starter',
  billingStatus: user.billingStatus || 'trial',
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const generateMockAnalysis = (userName) => ({
  animalType: '지혜로운 백조상',
  animalDescription: '눈매가 차분하고 고요하며 얼굴선이 정돈되어 있어 마음의 여유와 신뢰감을 느끼게 합니다.',
  overallScore: 92,
  personality: '차분하고 신중하며, 주변 사람들에게 안정감을 주는 성격입니다.',
  wealthLuck: userName + '님은 꾸준한 노력으로 재물을 안정적으로 쌓는 흐름을 보입니다.',
  careerLuck: '명확한 판단력과 리더십이 있어 장기적으로 성과를 만들어내는 직업운이 좋습니다.',
  loveLuck: '인연을 천천히 바라보는 타입이라 깊고 믿음직한 관계를 만들어갑니다.',
  advice: '오늘의 선택은 장기적인 흐름을 보는 데 유리합니다. 차분하게 실행하면 큰 결과가 이어집니다.',
});

const generateGeminiAnalysis = async (userName, imageData) => {
  if (!gemini || !imageData) {
    return generateMockAnalysis(userName);
  }

  const cleanBase64 = imageData.split(',')[1] || imageData;

  const response = await gemini.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: cleanBase64,
          },
        },
        {
          text: `당신은 한국 최고의 전통 관상가입니다. 이 사진의 인물을 세밀하게 관찰해 아래 JSON 형식으로 분석해 주세요. 필수 키: animalType, animalDescription, overallScore, personality, wealthLuck, careerLuck, loveLuck, advice. 한국어로 작성해 주세요. ${userName}의 얼굴입니다.`
        },
      ],
    },
    config: {
      temperature: 0.8,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          animalType: { type: Type.STRING },
          animalDescription: { type: Type.STRING },
          overallScore: { type: Type.NUMBER },
          personality: { type: Type.STRING },
          wealthLuck: { type: Type.STRING },
          careerLuck: { type: Type.STRING },
          loveLuck: { type: Type.STRING },
          advice: { type: Type.STRING },
        },
        required: ['animalType', 'animalDescription', 'overallScore', 'personality', 'wealthLuck', 'careerLuck', 'loveLuck', 'advice'],
      },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
    },
  });

  const parsed = JSON.parse(response.text || '{}');
  return {
    animalType: parsed.animalType || '지혜로운 백조상',
    animalDescription: parsed.animalDescription || '안정적이고 신뢰감 있는 인상입니다.',
    overallScore: Number(parsed.overallScore || 90),
    personality: parsed.personality || '차분하고 신뢰감을 주는 유형입니다.',
    wealthLuck: parsed.wealthLuck || '꾸준한 재물 형성과 성장이 예상됩니다.',
    careerLuck: parsed.careerLuck || '업무 흐름이 안정적이고 성과를 만들기 좋습니다.',
    loveLuck: parsed.loveLuck || '깊고 신뢰의 관계를 만들어갑니다.',
    advice: parsed.advice || '차분하게 실력을 쌓아가면 좋은 결과가 이어집니다.',
  };
};

const saveUserToDb = async (tenantId, user) => {
  if (!supabase) return null;
  const { data, error } = await supabase.from('gwansang_users').upsert({
    id: user.id,
    tenant_id: tenantId,
    full_name: user.fullName,
    email: user.email,
    role: user.role,
    plan_id: user.planId,
    billing_status: user.billingStatus,
    password_hash: user.passwordHash,
    created_at: user.createdAt,
  }).select();

  if (error) console.error('Supabase user save error', error);
  return data?.[0] || null;
};

const saveSessionToDb = async (tenantId, session) => {
  if (!supabase) return null;
  const { data, error } = await supabase.from('gwansang_sessions').insert({
    id: session.sessionId,
    tenant_id: tenantId,
    user_name: session.userName,
    created_by: session.createdBy,
    created_at: session.createdAt,
  }).select();

  if (error) console.error('Supabase session save error', error);
  return data?.[0] || null;
};

const handleStripeCheckout = async (planId, tenantId) => {
  if (!stripe) {
    return {
      ok: true,
      checkout: {
        planId,
        planName: plans[planId]?.name || 'Starter',
        price: plans[planId]?.price || 29000,
        status: 'simulated_checkout_success',
        invoiceId: `INV-${Date.now()}`,
      },
    };
  }

  const selectedPlan = plans[planId];
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price_data: { currency: 'krw', product_data: { name: selectedPlan.name }, unit_amount: selectedPlan.price }, quantity: 1 }],
    success_url: `${frontendUrl}/billing/success?tenantId=${tenantId}`,
    cancel_url: `${frontendUrl}/billing/cancel?tenantId=${tenantId}`,
    metadata: { tenantId, planId },
  });

  return {
    ok: true,
    checkout: {
      planId,
      planName: selectedPlan.name,
      price: selectedPlan.price,
      status: 'stripe_checkout_created',
      sessionId: session.id,
      url: session.url,
    },
  };
};

app.use(cors({ origin: true, credentials: true }));
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use((req, res, next) => {
  const now = Date.now();
  const key = `${req.ip}:${req.path}`;
  const record = rateLimitMap.get(key) || { count: 0, resetAt: now + 60000 };

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + 60000;
  }

  record.count += 1;
  rateLimitMap.set(key, record);

  if (record.count > 120) {
    return res.status(429).json({ message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
  }

  const start = Date.now();
  res.on('finish', () => {
    const elapsed = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${elapsed}ms`);
  });

  next();
});

app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ai-physiognomy-saas',
    timestamp: new Date().toISOString(),
    activeTenants: tenants.size,
    activeUsers: [...tokens.values()].length,
    integrations: {
      supabase: Boolean(supabase),
      stripe: Boolean(stripe),
      gemini: Boolean(gemini),
    },
  });
});

app.get('/api/plans', (req, res) => {
  res.json({ plans: Object.values(plans) });
});

app.post('/api/auth/signup', async (req, res) => {
  const { tenantId, fullName, email, password, planId = 'starter' } = req.body || {};

  if (!tenantId || !fullName || !email || !password) {
    return res.status(400).json({ message: 'tenantId, fullName, email, password가 필요합니다.' });
  }

  if (!plans[planId]) {
    return res.status(400).json({ message: '지원하지 않는 요금제입니다.' });
  }

  try {
    const tenant = ensureTenant(tenantId);

    if ([...tenant.users.values()].some((user) => user.email === email)) {
      return res.status(409).json({ message: '이미 가입된 이메일입니다.' });
    }

    const userId = uuidv4();
    const user = {
      id: userId,
      tenantId,
      fullName,
      email,
      role: 'admin',
      planId,
      billingStatus: 'trial',
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    tenant.users.set(userId, user);
    tenant.planId = planId;
    tenant.billingStatus = 'trial';

    await saveUserToDb(tenantId, user);

    const token = createToken();
    const safeUser = buildSafeUser(user);
    tokens.set(token, safeUser);

    return res.status(201).json({ token, user: safeUser });
  } catch (error) {
    return res.status(400).json({ message: error.message || '회원가입 처리 중 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { tenantId, email, password } = req.body || {};

  if (!tenantId || !email || !password) {
    return res.status(400).json({ message: 'tenantId, email, password가 필요합니다.' });
  }

  const tenant = ensureTenant(tenantId);
  const user = [...tenant.users.values()].find(
    (item) => item.email === email && item.passwordHash === hashPassword(password)
  );

  if (!user) {
    return res.status(401).json({ message: '로그인 정보가 올바르지 않습니다.' });
  }

  const token = createToken();
  const safeUser = buildSafeUser(user);
  tokens.set(token, safeUser);

  return res.json({ token, user: safeUser });
});

app.get('/api/me', (req, res) => {
  const user = resolveUserFromToken(req.headers.authorization);

  if (!user) {
    return res.status(401).json({ message: '인증이 필요합니다.' });
  }

  const tenant = ensureTenant(user.tenantId);

  return res.json({
    user: {
      ...user,
      planName: plans[user.planId]?.name || 'Starter',
      billingStatus: tenant.billingStatus,
    },
  });
});

app.post('/api/billing/checkout', async (req, res) => {
  const { planId } = req.body || {};

  if (!req.user) {
    return res.status(401).json({ message: '인증이 필요합니다.' });
  }

  const selectedPlan = plans[planId];
  if (!selectedPlan) {
    return res.status(400).json({ message: '유효하지 않은 플랜입니다.' });
  }

  const tenant = ensureTenant(req.user.tenantId);
  tenant.planId = planId;
  tenant.billingStatus = 'active';

  const result = await handleStripeCheckout(planId, req.user.tenantId);
  return res.json(result);
});

app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  if (req.path.startsWith('/api/auth') || req.path === '/api/health' || req.path === '/api/plans') {
    return next();
  }

  const user = resolveUserFromToken(req.headers.authorization);
  if (!user) {
    return res.status(401).json({ message: '인증 토큰이 없습니다.' });
  }

  req.user = user;
  next();
});

app.post('/api/sessions', async (req, res) => {
  const { tenantId, userName } = req.body || {};

  if (!tenantId || !userName) {
    return res.status(400).json({ message: 'tenantId와 userName이 필요합니다.' });
  }

  if (req.user?.tenantId !== tenantId) {
    return res.status(403).json({ message: '해당 테넌트에 접근할 권한이 없습니다.' });
  }

  const tenant = ensureTenant(tenantId);
  const sessionId = uuidv4();
  const session = {
    sessionId,
    tenantId,
    userName,
    createdBy: req.user.email,
    createdAt: new Date().toISOString(),
  };

  tenant.sessions.push(session);
  await saveSessionToDb(tenantId, session);

  return res.status(201).json(session);
});

app.post('/api/analyze', async (req, res) => {
  const { tenantId, sessionId, userName, imageData } = req.body || {};

  if (!tenantId || !sessionId || !userName) {
    return res.status(400).json({ message: 'tenantId, sessionId, userName이 필요합니다.' });
  }

  if (req.user?.tenantId !== tenantId) {
    return res.status(403).json({ message: '이 테넌트의 분석을 실행할 권한이 없습니다.' });
  }

  const tenant = ensureTenant(tenantId);
  const session = tenant.sessions.find((item) => item.sessionId === sessionId);

  if (!session) {
    return res.status(404).json({ message: '존재하지 않는 세션입니다.' });
  }

  try {
    const result = await generateGeminiAnalysis(userName, imageData);
    session.lastResult = result;
    return res.json({ ok: true, result });
  } catch (error) {
    console.error('[GEMINI_ERROR]', error);
    const fallback = generateMockAnalysis(userName);
    session.lastResult = fallback;
    return res.json({ ok: true, result: fallback, warning: 'Gemini 연결 실패, mock 결과를 반환했습니다.' });
  }
});

app.get('/api/tenants/:tenantId/sessions', (req, res) => {
  const { tenantId } = req.params;

  if (req.user?.tenantId !== tenantId) {
    return res.status(403).json({ message: '테넌트 접근 권한이 없습니다.' });
  }

  const tenant = ensureTenant(tenantId);

  return res.json({
    tenantId,
    sessions: tenant.sessions,
  });
});

// Serve frontend in production
app.use(express.static(path.join(__dirname, '../dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.use((req, res) => {
  res.status(404).json({ message: '요청한 경로를 찾을 수 없습니다.' });
});

app.use((error, req, res, next) => {
  console.error('[UNHANDLED_ERROR]', error);
  res.status(500).json({ message: '서버 처리 중 오류가 발생했습니다.' });
});

app.listen(PORT, () => {
  console.log(`SaaS API server running on http://localhost:${PORT}`);
  console.log('Integrations:', {
    supabase: Boolean(supabase),
    stripe: Boolean(stripe),
    gemini: Boolean(gemini),
  });
});
