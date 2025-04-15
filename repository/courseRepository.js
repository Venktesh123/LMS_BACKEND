// repository/courseRepository.js
const {
  Course,
  Teacher,
  User,
  Semester,
  Student,
  Lecture,
  Assignment,
  CourseOutcome,
  CourseSchedule,
  CourseSyllabus,
  WeeklyPlan,
  CreditPoints,
  CourseAttendance,
} = require("../models");
const { Op } = require("sequelize");

class CourseRepository {
  async create(courseData, transaction) {
    return await Course.create(courseData, { transaction });
  }

  async findById(id, options = {}) {
    const defaultOptions = {
      include: [
        {
          model: Teacher,
          as: "teacher",
          include: [{ model: User, as: "user", attributes: ["name", "email"] }],
        },
        { model: Semester, as: "semester" },
      ],
    };

    return await Course.findByPk(id, { ...defaultOptions, ...options });
  }

  async findByTeacherId(teacherId) {
    return await Course.findAll({
      where: { teacherId },
      include: [{ model: Semester, as: "semester" }],
    });
  }

  async findByStudentId(studentId) {
    const student = await Student.findByPk(studentId, {
      include: [
        {
          model: Course,
          as: "courses",
          include: [{ model: Semester, as: "semester" }],
        },
      ],
    });

    return student ? student.courses : [];
  }

  async update(id, courseData) {
    const course = await Course.findByPk(id);

    if (!course) {
      return null;
    }

    return await course.update(courseData);
  }

  async delete(id) {
    const course = await Course.findByPk(id);

    if (!course) {
      return false;
    }

    await course.destroy();
    return true;
  }

  // Course component methods
  async createCourseOutcome(courseId, outcomesData, transaction) {
    return await CourseOutcome.create(
      {
        courseId,
        outcomes: outcomesData,
      },
      { transaction }
    );
  }

  async createCourseSchedule(courseId, scheduleData, transaction) {
    return await CourseSchedule.create(
      {
        courseId,
        ...scheduleData,
      },
      { transaction }
    );
  }

  async createCourseSyllabus(courseId, modulesData, transaction) {
    return await CourseSyllabus.create(
      {
        courseId,
        modules: modulesData,
      },
      { transaction }
    );
  }

  async createWeeklyPlan(courseId, weeksData, transaction) {
    return await WeeklyPlan.create(
      {
        courseId,
        weeks: weeksData,
      },
      { transaction }
    );
  }

  async createCreditPoints(courseId, creditPointsData, transaction) {
    return await CreditPoints.create(
      {
        courseId,
        ...creditPointsData,
      },
      { transaction }
    );
  }

  async createCourseAttendance(courseId, sessionsData, transaction) {
    return await CourseAttendance.create(
      {
        courseId,
        sessions: sessionsData,
      },
      { transaction }
    );
  }

  async getEnrolledStudents(courseId) {
    const course = await Course.findByPk(courseId, {
      include: [
        {
          model: Student,
          as: "students",
          through: { attributes: ["enrollmentDate", "status"] },
          include: [{ model: User, as: "user" }],
        },
      ],
    });

    return course ? course.students : [];
  }
}

module.exports = new CourseRepository();
