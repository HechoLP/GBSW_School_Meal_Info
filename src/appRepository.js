const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { DEFAULT_SPECIAL_OPTIONS } = require("./constants");

const DB_FILE_PATH = path.join(__dirname, "..", "data", "app.db");

function nowIso() {
  return new Date().toISOString();
}

class AppRepository {
  constructor(dbFilePath = DB_FILE_PATH) {
    this.db = new DatabaseSync(dbFilePath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");

    this.createSchema();
    this.seedSpecialVoteOptions();
    this.prepareStatements();
  }

  createSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_allergies (
        user_id TEXT NOT NULL,
        allergy_code INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, allergy_code)
      );

      CREATE TABLE IF NOT EXISTS special_vote_options (
        option_id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS special_votes (
        poll_date TEXT NOT NULL,
        user_id TEXT NOT NULL,
        option_id TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (poll_date, user_id)
      );

      CREATE TABLE IF NOT EXISTS meal_ratings (
        rating_date TEXT NOT NULL,
        user_id TEXT NOT NULL,
        score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
        updated_at TEXT NOT NULL,
        PRIMARY KEY (rating_date, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_user_allergies_user_id
      ON user_allergies (user_id);

      CREATE INDEX IF NOT EXISTS idx_special_votes_date_option
      ON special_votes (poll_date, option_id);

      CREATE INDEX IF NOT EXISTS idx_meal_ratings_date_score
      ON meal_ratings (rating_date, score);
    `);
  }

  seedSpecialVoteOptions() {
    const upsert = this.db.prepare(`
      INSERT INTO special_vote_options (option_id, label, sort_order, is_active)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(option_id)
      DO UPDATE SET
        label = excluded.label,
        sort_order = excluded.sort_order,
        is_active = 1
    `);

    DEFAULT_SPECIAL_OPTIONS.forEach((option, index) => {
      upsert.run(option.id, option.label, index + 1);
    });
  }

  prepareStatements() {
    this.stmt = {
      touchUserInsert: this.db.prepare(
        "INSERT INTO users (user_id, created_at, last_seen_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO NOTHING",
      ),
      touchUserUpdate: this.db.prepare("UPDATE users SET last_seen_at = ? WHERE user_id = ?"),

      getAllergies: this.db.prepare(
        "SELECT allergy_code FROM user_allergies WHERE user_id = ? ORDER BY allergy_code ASC",
      ),
      deleteAllergies: this.db.prepare("DELETE FROM user_allergies WHERE user_id = ?"),
      insertAllergy: this.db.prepare(
        "INSERT INTO user_allergies (user_id, allergy_code, created_at) VALUES (?, ?, ?)",
      ),

      activeVoteOptions: this.db.prepare(
        "SELECT option_id, label FROM special_vote_options WHERE is_active = 1 ORDER BY sort_order ASC, option_id ASC",
      ),
      voteOptionById: this.db.prepare(
        "SELECT option_id, label FROM special_vote_options WHERE option_id = ? AND is_active = 1",
      ),
      upsertVote: this.db.prepare(
        `INSERT INTO special_votes (poll_date, user_id, option_id, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(poll_date, user_id)
         DO UPDATE SET option_id = excluded.option_id, updated_at = excluded.updated_at`,
      ),
      voteSummaryByDate: this.db.prepare(
        "SELECT option_id, COUNT(*) AS count FROM special_votes WHERE poll_date = ? GROUP BY option_id",
      ),
      voteParticipantsByDate: this.db.prepare(
        "SELECT COUNT(*) AS count FROM special_votes WHERE poll_date = ?",
      ),
      latestVoteUpdatedAt: this.db.prepare(
        "SELECT MAX(updated_at) AS updated_at FROM special_votes WHERE poll_date = ?",
      ),
      myVoteByDate: this.db.prepare(
        "SELECT option_id FROM special_votes WHERE poll_date = ? AND user_id = ?",
      ),

      upsertRating: this.db.prepare(
        `INSERT INTO meal_ratings (rating_date, user_id, score, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(rating_date, user_id)
         DO UPDATE SET score = excluded.score, updated_at = excluded.updated_at`,
      ),
      ratingCountsByDate: this.db.prepare(
        "SELECT score, COUNT(*) AS count FROM meal_ratings WHERE rating_date = ? GROUP BY score",
      ),
      ratingParticipantsByDate: this.db.prepare(
        "SELECT COUNT(*) AS count FROM meal_ratings WHERE rating_date = ?",
      ),
      latestRatingUpdatedAt: this.db.prepare(
        "SELECT MAX(updated_at) AS updated_at FROM meal_ratings WHERE rating_date = ?",
      ),
      myRatingByDate: this.db.prepare(
        "SELECT score FROM meal_ratings WHERE rating_date = ? AND user_id = ?",
      ),
    };
  }

  normalizeUserId(userIdRaw) {
    const raw = String(userIdRaw || "").trim();
    if (!raw) {
      return null;
    }

    const normalized = raw.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 64);
    return normalized || null;
  }

  touchUser(userId) {
    const user = this.normalizeUserId(userId);
    if (!user) {
      return null;
    }

    const now = nowIso();
    this.stmt.touchUserInsert.run(user, now, now);
    this.stmt.touchUserUpdate.run(now, user);
    return user;
  }

  getUserAllergies(userId) {
    const user = this.touchUser(userId);
    if (!user) {
      return [];
    }

    const rows = this.stmt.getAllergies.all(user);
    return rows.map((row) => Number(row.allergy_code));
  }

  setUserAllergies(userId, allergies) {
    const user = this.touchUser(userId);
    if (!user) {
      return [];
    }

    const normalizedAllergies = [...new Set((Array.isArray(allergies) ? allergies : [])
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 19))].sort((a, b) => a - b);

    const now = nowIso();

    this.db.exec("BEGIN");
    try {
      this.stmt.deleteAllergies.run(user);
      normalizedAllergies.forEach((allergyCode) => {
        this.stmt.insertAllergy.run(user, allergyCode, now);
      });
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    return normalizedAllergies;
  }

  getSpecialVotePoll({ pollDate, userId } = {}) {
    const options = this.stmt.activeVoteOptions.all();
    const countsRows = this.stmt.voteSummaryByDate.all(pollDate);
    const participants = this.stmt.voteParticipantsByDate.get(pollDate)?.count || 0;
    const updatedAt = this.stmt.latestVoteUpdatedAt.get(pollDate)?.updated_at || null;
    const myChoice = userId ? this.stmt.myVoteByDate.get(pollDate, userId)?.option_id || null : null;

    const countMap = new Map(countsRows.map((row) => [row.option_id, Number(row.count || 0)]));
    const totalVotes = options.reduce((acc, option) => acc + (countMap.get(option.option_id) || 0), 0);

    return {
      title: "다음 주 특식 투표",
      pollDate,
      updatedAt,
      participantCount: Number(participants),
      totalVotes,
      myChoice,
      options: options.map((option) => {
        const count = countMap.get(option.option_id) || 0;
        const percent = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
        return {
          id: option.option_id,
          label: option.label,
          count,
          percent,
        };
      }),
    };
  }

  submitSpecialVote({ pollDate, userId, optionId }) {
    const user = this.touchUser(userId);
    if (!user) {
      const error = new Error("userId is required");
      error.statusCode = 400;
      throw error;
    }

    const option = this.stmt.voteOptionById.get(optionId);
    if (!option) {
      const error = new Error("invalid optionId");
      error.statusCode = 400;
      throw error;
    }

    this.stmt.upsertVote.run(pollDate, user, optionId, nowIso());
    return this.getSpecialVotePoll({ pollDate, userId: user });
  }

  getMealRatingSummary({ ratingDate, userId } = {}) {
    const rows = this.stmt.ratingCountsByDate.all(ratingDate);
    const participantCount = Number(this.stmt.ratingParticipantsByDate.get(ratingDate)?.count || 0);
    const updatedAt = this.stmt.latestRatingUpdatedAt.get(ratingDate)?.updated_at || null;
    const myScoreRaw = userId ? this.stmt.myRatingByDate.get(ratingDate, userId)?.score : null;
    const myScore = Number.isInteger(Number(myScoreRaw)) ? Number(myScoreRaw) : null;

    const counts = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    rows.forEach((row) => {
      const score = String(row.score);
      if (counts[score] !== undefined) {
        counts[score] = Number(row.count || 0);
      }
    });

    const total = Object.values(counts).reduce((acc, value) => acc + value, 0);
    const weighted = Object.entries(counts).reduce((acc, [score, count]) => acc + Number(score) * Number(count), 0);

    return {
      date: ratingDate,
      updatedAt,
      total,
      participantCount,
      average: total === 0 ? 0 : Number((weighted / total).toFixed(2)),
      myScore,
      counts,
    };
  }

  submitMealRating({ ratingDate, userId, score }) {
    const user = this.touchUser(userId);
    if (!user) {
      const error = new Error("userId is required");
      error.statusCode = 400;
      throw error;
    }

    const numericScore = Number(score);
    if (!Number.isInteger(numericScore) || numericScore < 1 || numericScore > 5) {
      const error = new Error("score must be an integer between 1 and 5");
      error.statusCode = 400;
      throw error;
    }

    this.stmt.upsertRating.run(ratingDate, user, numericScore, nowIso());
    return this.getMealRatingSummary({ ratingDate, userId: user });
  }
}

module.exports = {
  AppRepository,
  DB_FILE_PATH,
};
