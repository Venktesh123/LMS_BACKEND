// repository/userRepository.js
const { User, Teacher, Student } = require("../models");
const { Op } = require("sequelize");

class UserRepository {
  async create(userData, options = {}) {
    return await User.create(userData, options);
  }

  async findById(id) {
    return await User.findByPk(id);
  }

  async findByEmail(email) {
    return await User.findOne({ where: { email } });
  }

  async findAllTeachers() {
    return await User.findAll({
      where: { role: "teacher" },
      include: [{ model: Teacher, as: "teacher" }],
    });
  }

  async findAllStudents() {
    return await User.findAll({
      where: { role: "student" },
      include: [{ model: Student, as: "student" }],
    });
  }

  async bulkCreate(users, options = {}) {
    return await User.bulkCreate(users, {
      validate: true,
      ...options,
    });
  }
}

module.exports = new UserRepository();