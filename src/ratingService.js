const { toDateKey } = require("./mealService");

class RatingService {
  constructor(repository) {
    this.repository = repository;
  }

  getSummary({ date, userId } = {}) {
    const ratingDate = toDateKey(date);
    return this.repository.getMealRatingSummary({ ratingDate, userId });
  }

  submitRating({ date, userId, score }) {
    const ratingDate = toDateKey(date);
    return this.repository.submitMealRating({ ratingDate, userId, score });
  }
}

module.exports = {
  RatingService,
};
