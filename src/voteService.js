const { toDateKey } = require("./mealService");

class VoteService {
  constructor(repository) {
    this.repository = repository;
  }

  getPoll({ date, userId } = {}) {
    const pollDate = toDateKey(date);
    return this.repository.getSpecialVotePoll({ pollDate, userId });
  }

  submitVote({ date, userId, optionId }) {
    if (!optionId) {
      const error = new Error("optionId is required");
      error.statusCode = 400;
      throw error;
    }

    const pollDate = toDateKey(date);
    return this.repository.submitSpecialVote({
      pollDate,
      userId,
      optionId,
    });
  }
}

module.exports = {
  VoteService,
};
