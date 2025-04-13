const { Student, User, Teacher, Course, Submission } = require("../models");
const { Op } = require("sequelize");

class StudentRepository {
  async create(studentData) {
    return await Student.create(studentData);
  }

  async findById(id) {
    return await Student.findByPk(id, {
      include: [
        { model: User, as: "user" },
        {
          model: Teacher,
          as: "teacher",
          include: [{ model: User, as: "user" }],
        },
      ],
    });
  }

  async findByUserId(userId) {
    return await Student.findOne({
      where: { userId },
      include: [
        { model: User, as: "user" },
        {
          model: Teacher,
          as: "teacher",
          include: [{ model: User, as: "user" }],
        },
      ],
    });
  }

  async findByTeacherId(teacherId) {
    return await Student.findAll({
      where: { teacherId },
      include: [{ model: User, as: "user" }],
    });
  }

  async enrollInCourse(studentId, courseId) {
    const student = await Student.findByPk(studentId);
    const course = await Course.findByPk(courseId);

    if (!student || !course) {
      throw new Error("Student or course not found");
    }

    await student.addCourse(course, {
      through: {
        enrollmentDate: new Date(),
        status: "active",
      },
    });

    return { student, course };
  }

  async getEnrolledCourses(studentId) {
    const student = await Student.findByPk(studentId, {
      include: [
        {
          model: Course,
          as: "courses",
          through: { attributes: ["enrollmentDate", "status"] },
        },
      ],
    });

    return student ? student.courses : [];
  }

  async getSubmissions(studentId) {
    return await Submission.findAll({
      where: { studentId },
      include: [{ model: Assignment, as: "assignment" }],
    });
  }
}

module.exports = new StudentRepository();
