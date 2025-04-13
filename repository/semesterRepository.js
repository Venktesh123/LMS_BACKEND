const { Semester, Course } = require("../models");

class SemesterRepository {
  async create(semesterData) {
    return await Semester.create(semesterData);
  }

  async findAll() {
    return await Semester.findAll({
      include: [{ model: Course, as: "courses" }],
    });
  }

  async findById(id) {
    return await Semester.findByPk(id, {
      include: [{ model: Course, as: "courses" }],
    });
  }
}

module.exports = new SemesterRepository();
