const {
  Course,
  Teacher,
  Semester,
  Student,
  Lecture,
  Assignment,
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
    const { CourseOutcome } = require("../models");
    return await CourseOutcome.create({
      courseId,
      outcomes: outcomesData,
    });
  }

  async createCourseSchedule(courseId, scheduleData) {
    const { CourseSchedule } = require("../models");
    return await CourseSchedule.create({
      courseId,
      ...scheduleData,
    });
  }

  async createCourseSyllabus(courseId, modulesData) {
    const { CourseSyllabus } = require("../models");
    return await CourseSyllabus.create({
      courseId,
      modules: modulesData,
    });
  }

  async createWeeklyPlan(courseId, weeksData) {
    const { WeeklyPlan } = require("../models");
    return await WeeklyPlan.create({
      courseId,
      weeks: weeksData,
    });
  }

  async createCreditPoints(courseId, creditPointsData) {
    const { CreditPoints } = require("../models");
    return await CreditPoints.create({
      courseId,
      ...creditPointsData,
    });
  }

  async createCourseAttendance(courseId, sessionsData) {
    const { CourseAttendance } = require("../models");
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
