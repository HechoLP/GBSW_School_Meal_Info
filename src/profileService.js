class ProfileService {
  constructor(repository) {
    this.repository = repository;
  }

  getAllergies(userId) {
    return this.repository.getUserAllergies(userId);
  }

  setAllergies({ userId, allergies }) {
    if (!Array.isArray(allergies)) {
      const error = new Error("allergies must be an array");
      error.statusCode = 400;
      throw error;
    }

    return this.repository.setUserAllergies(userId, allergies);
  }
}

module.exports = {
  ProfileService,
};
