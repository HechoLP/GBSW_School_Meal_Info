const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const express = require("express");
const { Server } = require("socket.io");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const dotenv = require("dotenv");

const ENV_PATH = path.join(__dirname, ".env");
const ENV_EXAMPLE_PATH = path.join(__dirname, ".env.example");
const resolvedEnvPath = fs.existsSync(ENV_PATH) ? ENV_PATH : ENV_EXAMPLE_PATH;
dotenv.config({ path: resolvedEnvPath });

let envExample = {};
if (fs.existsSync(ENV_EXAMPLE_PATH)) {
  try {
    envExample = dotenv.parse(fs.readFileSync(ENV_EXAMPLE_PATH, "utf8"));
  } catch {
    envExample = {};
  }
}

function readEnvWithExampleFallback(name, defaultValue = "") {
  const fromEnv = String(process.env[name] || "").trim();
  if (fromEnv) {
    return fromEnv;
  }

  const fromExample = String(envExample[name] || "").trim();
  if (fromExample) {
    return fromExample;
  }

  return defaultValue;
}

function readNumericEnv(name, defaultValue) {
  const value = Number(readEnvWithExampleFallback(name, String(defaultValue)));
  if (Number.isFinite(value)) {
    return value;
  }
  return defaultValue;
}

const { StateStore } = require("./src/stateStore");
const { AppRepository } = require("./src/appRepository");
const { fetchMeals, toDateKey } = require("./src/mealService");
const { CongestionService } = require("./src/congestionService");
const { VoteService } = require("./src/voteService");
const { RatingService } = require("./src/ratingService");
const { ProfileService } = require("./src/profileService");

const PORT = readNumericEnv("PORT", 3000);
const HOST = readEnvWithExampleFallback("HOST", "0.0.0.0");
const MAX_CAPACITY = readNumericEnv("MAX_CAFETERIA_CAPACITY", 132);
const SENSOR_AUTH_TOKEN = readEnvWithExampleFallback("SENSOR_AUTH_TOKEN");
const NEIS_API_KEY = readEnvWithExampleFallback("NEIS_API_KEY");
const NEIS_ATPT_CODE = readEnvWithExampleFallback("NEIS_ATPT_CODE", "R10");
const NEIS_SCHOOL_CODE = readEnvWithExampleFallback("NEIS_SCHOOL_CODE", "8750829");
const ENABLE_CONGESTION_SIMULATOR = String(readEnvWithExampleFallback("ENABLE_CONGESTION_SIMULATOR", "false")).toLowerCase() === "true";
const SIMULATOR_INTERVAL_MS = readNumericEnv("SIMULATOR_INTERVAL_MS", 5000);
const SESSION_SECRET = readEnvWithExampleFallback("SESSION_SECRET");
const COOKIE_SECURE = String(readEnvWithExampleFallback("COOKIE_SECURE", "false")).toLowerCase() === "true";
const GOOGLE_CLIENT_ID = readEnvWithExampleFallback("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = readEnvWithExampleFallback("GOOGLE_CLIENT_SECRET");
const GOOGLE_CALLBACK_URL = readEnvWithExampleFallback("GOOGLE_CALLBACK_URL", "auto");
const GOOGLE_ALLOWED_DOMAIN = readEnvWithExampleFallback("GOOGLE_ALLOWED_DOMAIN").toLowerCase();
const GOOGLE_CALLBACK_PATH = "/auth/google/callback";

const GOOGLE_AUTH_MISSING = [];
if (!SESSION_SECRET) {
  GOOGLE_AUTH_MISSING.push("SESSION_SECRET");
}
if (!GOOGLE_CLIENT_ID) {
  GOOGLE_AUTH_MISSING.push("GOOGLE_CLIENT_ID");
}
if (!GOOGLE_CLIENT_SECRET) {
  GOOGLE_AUTH_MISSING.push("GOOGLE_CLIENT_SECRET");
}
const GOOGLE_AUTH_ENABLED = GOOGLE_AUTH_MISSING.length === 0;

const store = new StateStore(MAX_CAPACITY);
const repository = new AppRepository();
const congestionService = new CongestionService(store);
const voteService = new VoteService(repository);
const ratingService = new RatingService(repository);
const profileService = new ProfileService(repository);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set("trust proxy", 1);

app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  name: "gbsw_sid",
  secret: SESSION_SECRET || "unsafe-dev-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, "public")));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

if (GOOGLE_AUTH_ENABLED) {
  passport.use(new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_PATH,
    },
    (accessToken, refreshToken, profile, done) => {
      const primaryEmail = profile.emails?.[0]?.value || "";
      const emailDomain = primaryEmail.split("@")[1]?.toLowerCase() || "";

      if (GOOGLE_ALLOWED_DOMAIN && emailDomain !== GOOGLE_ALLOWED_DOMAIN) {
        const error = new Error("허용되지 않은 Google 계정 도메인입니다.");
        error.statusCode = 403;
        return done(error);
      }

      return done(null, {
        userId: `google:${profile.id}`,
        provider: "google",
        displayName: profile.displayName || primaryEmail || "Google User",
        email: primaryEmail,
      });
    },
  ));
}

function sendApiError(res, error) {
  const status = error.statusCode || 500;
  res.status(status).json({
    ok: false,
    message: error.message || "internal server error",
  });
}

function resolveRequestOrigin(req) {
  const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const forwardedHost = String(req.get("x-forwarded-host") || "").split(",")[0].trim();
  const host = forwardedHost || String(req.get("host") || "").trim();
  const protocol = forwardedProto || req.protocol || "http";

  if (!host) {
    return "";
  }

  return `${protocol}://${host}`;
}

function resolveGoogleCallbackUrl(req) {
  const configured = String(GOOGLE_CALLBACK_URL || "").trim();
  const origin = resolveRequestOrigin(req) || `http://localhost:${PORT}`;

  if (!configured || configured.toLowerCase() === "auto") {
    return `${origin}${GOOGLE_CALLBACK_PATH}`;
  }

  if (configured.startsWith("/")) {
    return `${origin}${configured}`;
  }

  return configured;
}

function normalizeAuthUser(rawUser) {
  const userId = repository.normalizeUserId(rawUser?.userId);
  if (!userId) {
    return null;
  }

  return {
    userId,
    provider: String(rawUser?.provider || "google"),
    displayName: String(rawUser?.displayName || ""),
    email: String(rawUser?.email || ""),
  };
}

function resolveAuthenticatedUser(req) {
  return normalizeAuthUser(req.user);
}

function resolveRequiredUser(req) {
  const user = resolveAuthenticatedUser(req);
  if (user) {
    return user;
  }

  const error = new Error("Google 로그인 후 이용할 수 있습니다.");
  error.statusCode = 401;
  throw error;
}

function resolveProfileUserId(req) {
  const authUser = resolveAuthenticatedUser(req);
  if (authUser) {
    return authUser.userId;
  }

  return resolveUserId(req);
}

function getSensorTokenFromRequest(req) {
  const headerToken = req.get("x-sensor-token");
  if (headerToken) {
    return headerToken;
  }

  const authHeader = req.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  return "";
}

function requireSensorAuth(req, res, next) {
  if (!SENSOR_AUTH_TOKEN) {
    return next();
  }

  const token = getSensorTokenFromRequest(req);
  if (token !== SENSOR_AUTH_TOKEN) {
    return res.status(401).json({
      ok: false,
      message: "invalid sensor token",
    });
  }

  return next();
}

function fallbackUserId(req) {
  const ip = String(req.ip || req.socket?.remoteAddress || "unknown");
  const userAgent = String(req.get("user-agent") || "unknown");
  const digest = crypto.createHash("sha1").update(`${ip}|${userAgent}`).digest("hex").slice(0, 24);
  return `guest-${digest}`;
}

function resolveUserId(req) {
  const candidate = req.get("x-user-id") || req.body?.userId || req.query?.userId;
  const normalized = repository.normalizeUserId(candidate);
  if (normalized) {
    return normalized;
  }

  return fallbackUserId(req);
}

function getServerTodayDateKey() {
  return toDateKey(new Date());
}

function getLanUrls() {
  const interfaces = os.networkInterfaces();
  const urls = [];

  Object.values(interfaces).forEach((network) => {
    if (!Array.isArray(network)) {
      return;
    }

    network.forEach((detail) => {
      const isIPv4 = detail.family === "IPv4" || detail.family === 4;
      if (!isIPv4 || detail.internal || !detail.address) {
        return;
      }
      urls.push(`http://${detail.address}:${PORT}`);
    });
  });

  return Array.from(new Set(urls));
}

function getStartupUrls() {
  const normalizedHost = String(HOST || "").trim().toLowerCase();
  if (normalizedHost === "0.0.0.0" || normalizedHost === "::") {
    return [`http://localhost:${PORT}`, ...getLanUrls()];
  }

  return [`http://${HOST}:${PORT}`];
}

function emitCongestionUpdate() {
  io.emit("congestion:update", congestionService.getStatus());
}

function emitVoteUpdate(dateInput) {
  io.emit("vote:update", { date: toDateKey(dateInput) });
}

function emitRatingUpdate(dateInput) {
  io.emit("rating:update", { date: toDateKey(dateInput) });
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    now: new Date().toISOString(),
    simulator: ENABLE_CONGESTION_SIMULATOR,
    host: HOST,
    port: PORT,
    urls: getStartupUrls(),
  });
});

app.get("/api/auth/me", (req, res) => {
  const user = resolveAuthenticatedUser(req);
  res.json({
    ok: true,
    googleAuthEnabled: GOOGLE_AUTH_ENABLED,
    googleAuthMissing: GOOGLE_AUTH_MISSING,
    googleCallbackUrl: resolveGoogleCallbackUrl(req),
    authenticated: Boolean(user),
    user: user ? {
      displayName: user.displayName,
      email: user.email,
    } : null,
  });
});

app.get("/auth/google", (req, res, next) => {
  if (!GOOGLE_AUTH_ENABLED) {
    return res.status(503).json({
      ok: false,
      message: `Google OAuth 설정이 비활성 상태입니다. 누락: ${GOOGLE_AUTH_MISSING.join(", ")}`,
    });
  }

  const callbackURL = resolveGoogleCallbackUrl(req);
  return passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
    callbackURL,
  })(req, res, next);
});

app.get("/auth/google/callback", (req, res, next) => {
  if (!GOOGLE_AUTH_ENABLED) {
    return res.redirect("/?login=failed&reason=oauth_not_configured");
  }

  const callbackURL = resolveGoogleCallbackUrl(req);
  return passport.authenticate("google", { callbackURL }, (error, user) => {
    if (error || !user) {
      const reason = error?.message ? encodeURIComponent(error.message) : "oauth_failed";
      return res.redirect(`/?login=failed&reason=${reason}`);
    }

    return req.logIn(user, (loginError) => {
      if (loginError) {
        return next(loginError);
      }
      return res.redirect("/?login=success");
    });
  })(req, res, next);
});

app.post("/api/auth/logout", (req, res, next) => {
  req.logout((error) => {
    if (error) {
      return next(error);
    }

    return req.session.destroy(() => {
      res.clearCookie("gbsw_sid");
      res.json({ ok: true });
    });
  });
});

app.get("/api/meals", async (req, res) => {
  try {
    const data = await fetchMeals({
      apiKey: NEIS_API_KEY,
      atptCode: NEIS_ATPT_CODE,
      schoolCode: NEIS_SCHOOL_CODE,
      date: req.query.date,
    });

    res.json({ ok: true, ...data });
  } catch (error) {
    sendApiError(res, error);
  }
});

app.get("/api/congestion", (req, res) => {
  res.json({
    ok: true,
    data: congestionService.getStatus(),
  });
});

app.post("/api/congestion/event", requireSensorAuth, (req, res) => {
  try {
    const status = congestionService.applySensorEvent(req.body || {});
    emitCongestionUpdate();
    res.json({ ok: true, data: status });
  } catch (error) {
    sendApiError(res, error);
  }
});

app.post("/api/congestion/set", requireSensorAuth, (req, res) => {
  try {
    const count = Number(req.body?.count);
    if (!Number.isFinite(count)) {
      const error = new Error("count is required");
      error.statusCode = 400;
      throw error;
    }

    const status = congestionService.setCurrentCount(count, "manual-set");
    emitCongestionUpdate();
    res.json({ ok: true, data: status });
  } catch (error) {
    sendApiError(res, error);
  }
});

app.get("/api/profile/allergies", (req, res) => {
  try {
    const userId = resolveProfileUserId(req);
    const allergies = profileService.getAllergies(userId);

    res.json({
      ok: true,
      data: {
        userId,
        allergies,
      },
    });
  } catch (error) {
    sendApiError(res, error);
  }
});

app.put("/api/profile/allergies", (req, res) => {
  try {
    const userId = resolveProfileUserId(req);
    const allergies = profileService.setAllergies({
      userId,
      allergies: req.body?.allergies,
    });

    res.json({
      ok: true,
      data: {
        userId,
        allergies,
      },
    });
  } catch (error) {
    sendApiError(res, error);
  }
});

app.get("/api/votes/special", (req, res) => {
  try {
    const userId = resolveAuthenticatedUser(req)?.userId || null;
    const poll = voteService.getPoll({
      date: getServerTodayDateKey(),
      userId,
    });

    res.json({
      ok: true,
      data: poll,
    });
  } catch (error) {
    sendApiError(res, error);
  }
});

app.post("/api/votes/special", (req, res) => {
  try {
    const user = resolveRequiredUser(req);
    const userId = user.userId;
    const poll = voteService.submitVote({
      date: getServerTodayDateKey(),
      userId,
      optionId: req.body?.optionId,
    });

    emitVoteUpdate(poll.pollDate);

    res.json({
      ok: true,
      data: poll,
    });
  } catch (error) {
    sendApiError(res, error);
  }
});

app.get("/api/ratings", (req, res) => {
  try {
    const userId = resolveAuthenticatedUser(req)?.userId || null;
    const summary = ratingService.getSummary({
      date: getServerTodayDateKey(),
      userId,
    });

    res.json({
      ok: true,
      data: summary,
    });
  } catch (error) {
    sendApiError(res, error);
  }
});

app.post("/api/ratings", (req, res) => {
  try {
    const user = resolveRequiredUser(req);
    const userId = user.userId;
    const summary = ratingService.submitRating({
      date: getServerTodayDateKey(),
      userId,
      score: req.body?.score,
    });

    emitRatingUpdate(summary.date);

    res.json({
      ok: true,
      data: summary,
    });
  } catch (error) {
    sendApiError(res, error);
  }
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      ok: false,
      message: "not found",
    });
  }

  return res.sendFile(path.join(__dirname, "public", "index.html"));
});

io.on("connection", (socket) => {
  const today = toDateKey();
  socket.emit("congestion:update", congestionService.getStatus());
  socket.emit("vote:update", { date: today });
  socket.emit("rating:update", { date: today });
});

if (ENABLE_CONGESTION_SIMULATOR) {
  setInterval(() => {
    const dice = Math.random();
    const eventType = dice > 0.55 ? "entry" : "exit";

    try {
      congestionService.applySensorEvent({
        eventType,
        amount: 1,
        sensorId: "simulator",
        eventAt: new Date().toISOString(),
      });
      emitCongestionUpdate();
    } catch {
      // Ignore simulator event errors to keep service alive.
    }
  }, SIMULATOR_INTERVAL_MS);
}

server.listen(PORT, HOST, () => {
  const mode = ENABLE_CONGESTION_SIMULATOR ? "simulator:on" : "simulator:off";
  const urls = getStartupUrls();
  console.log(`Server running (${mode})`);
  urls.forEach((url) => {
    console.log(`- ${url}`);
  });
});
