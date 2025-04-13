const { Teacher, User, Student, Course } = require("../models");
const { Op } = require("sequelize");

class TeacherRepository {
  async create(teacherData) {
    return await Teacher.create(teacherData);
  }

  async findById(id) {
    return await Teacher.findByPk(id, {
      include: [{ model: User, as: "user" }],
    });
  }

  async findByUserId(userId) {
    return await Teacher.findOne({
      where: { userId },
      include: [{ model: User, as: "user" }],
    });
  }

  async findByEmail(email) {
    return await Teacher.findOne({
      where: { email },
      include: [{ model: User, as: "user" }],
    });
  }

  async findStudents(teacherId) {
    return await Student.findAll({
      where: { teacherId },
      include: [{ model: User, as: "user" }],
    });
  }

  async findCourses(teacherId) {
    return await Course.findAll({
      where: { teacherId },
    });
  }
}

module.exports = new TeacherRepository();
