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
  async create(courseData) {
    return await Course.create(courseData);
  }

  async findById(id, options = {}) {
    const defaultOptions = {
      include: [
        {
          model: Teacher,
          as: "teacher",
          include: [{ model: User, as: "user" }],
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
  async createCourseOutcome(courseId, outcomesData) {
    return await CourseOutcome.create({
      courseId,
      outcomes: outcomesData,
    });
  }

  async createCourseSchedule(courseId, scheduleData) {
    return await CourseSchedule.create({
      courseId,
      ...scheduleData,
    });
  }

  async createCourseSyllabus(courseId, modulesData) {
    return await CourseSyllabus.create({
      courseId,
      modules: modulesData,
    });
  }

  async createWeeklyPlan(courseId, weeksData) {
    return await WeeklyPlan.create({
      courseId,
      weeks: weeksData,
    });
  }

  async createCreditPoints(courseId, creditPointsData) {
    return await CreditPoints.create({
      courseId,
      ...creditPointsData,
    });
  }

  async createCourseAttendance(courseId, sessionsData) {
    return await CourseAttendance.create({
      courseId,
      sessions: sessionsData,
    });
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
