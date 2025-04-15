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
  // Create methods
  async createCourseOutcome(courseId, outcomesData, transaction) {
    console.log(
      `Creating outcomes for course ${courseId}`,
      JSON.stringify(outcomesData, null, 2)
    );
    return await CourseOutcome.create(
      {
        courseId,
        outcomes: outcomesData,
      },
      { transaction }
    );
  }

  async createCourseSchedule(courseId, scheduleData, transaction) {
    console.log(
      `Creating schedule for course ${courseId}`,
      JSON.stringify(scheduleData, null, 2)
    );
    return await CourseSchedule.create(
      {
        courseId,
        classStartDate: scheduleData.classStartDate,
        classEndDate: scheduleData.classEndDate,
        midSemesterExamDate: scheduleData.midSemesterExamDate,
        endSemesterExamDate: scheduleData.endSemesterExamDate,
        classDaysAndTimes: scheduleData.classDaysAndTimes || [],
      },
      { transaction }
    );
  }

  async createCourseSyllabus(courseId, modulesData, transaction) {
    console.log(
      `Creating syllabus for course ${courseId}`,
      JSON.stringify(modulesData, null, 2)
    );
    return await CourseSyllabus.create(
      {
        courseId,
        modules: modulesData,
      },
      { transaction }
    );
  }

  async createWeeklyPlan(courseId, weeksData, transaction) {
    console.log(
      `Creating weekly plan for course ${courseId}`,
      JSON.stringify(weeksData, null, 2)
    );
    return await WeeklyPlan.create(
      {
        courseId,
        weeks: weeksData,
      },
      { transaction }
    );
  }

  async createCreditPoints(courseId, creditPointsData, transaction) {
    console.log(
      `Creating credit points for course ${courseId}`,
      JSON.stringify(creditPointsData, null, 2)
    );
    return await CreditPoints.create(
      {
        courseId,
        lecture: creditPointsData.lecture || 0,
        tutorial: creditPointsData.tutorial || 0,
        practical: creditPointsData.practical || 0,
        project: creditPointsData.project || 0,
      },
      { transaction }
    );
  }

  async createCourseAttendance(courseId, sessionsData, transaction) {
    console.log(
      `Creating attendance for course ${courseId}`,
      JSON.stringify(sessionsData, null, 2)
    );
    return await CourseAttendance.create(
      {
        courseId,
        sessions: sessionsData || {},
      },
      { transaction }
    );
  }

  // Update methods
  async updateCourseOutcome(courseId, outcomesData, transaction) {
    console.log(
      `Updating outcomes for course ${courseId}`,
      JSON.stringify(outcomesData, null, 2)
    );
    const courseOutcome = await CourseOutcome.findOne({
      where: { courseId },
      transaction,
    });

    if (courseOutcome) {
      return await courseOutcome.update(
        { outcomes: outcomesData },
        { transaction }
      );
    } else {
      return await this.createCourseOutcome(
        courseId,
        outcomesData,
        transaction
      );
    }
  }

  async updateCourseSchedule(courseId, scheduleData, transaction) {
    console.log(
      `Updating schedule for course ${courseId}`,
      JSON.stringify(scheduleData, null, 2)
    );
    const courseSchedule = await CourseSchedule.findOne({
      where: { courseId },
      transaction,
    });

    if (courseSchedule) {
      return await courseSchedule.update(
        {
          classStartDate: scheduleData.classStartDate,
          classEndDate: scheduleData.classEndDate,
          midSemesterExamDate: scheduleData.midSemesterExamDate,
          endSemesterExamDate: scheduleData.endSemesterExamDate,
          classDaysAndTimes: scheduleData.classDaysAndTimes || [],
        },
        { transaction }
      );
    } else {
      return await this.createCourseSchedule(
        courseId,
        scheduleData,
        transaction
      );
    }
  }

  async updateCourseSyllabus(courseId, modulesData, transaction) {
    console.log(
      `Updating syllabus for course ${courseId}`,
      JSON.stringify(modulesData, null, 2)
    );
    const courseSyllabus = await CourseSyllabus.findOne({
      where: { courseId },
      transaction,
    });

    if (courseSyllabus) {
      return await courseSyllabus.update(
        { modules: modulesData },
        { transaction }
      );
    } else {
      return await this.createCourseSyllabus(
        courseId,
        modulesData,
        transaction
      );
    }
  }

  async updateWeeklyPlan(courseId, weeksData, transaction) {
    console.log(
      `Updating weekly plan for course ${courseId}`,
      JSON.stringify(weeksData, null, 2)
    );
    const weeklyPlan = await WeeklyPlan.findOne({
      where: { courseId },
      transaction,
    });

    if (weeklyPlan) {
      return await weeklyPlan.update({ weeks: weeksData }, { transaction });
    } else {
      return await this.createWeeklyPlan(courseId, weeksData, transaction);
    }
  }

  async updateCreditPoints(courseId, creditPointsData, transaction) {
    console.log(
      `Updating credit points for course ${courseId}`,
      JSON.stringify(creditPointsData, null, 2)
    );
    const creditPoints = await CreditPoints.findOne({
      where: { courseId },
      transaction,
    });

    if (creditPoints) {
      return await creditPoints.update(
        {
          lecture: creditPointsData.lecture || 0,
          tutorial: creditPointsData.tutorial || 0,
          practical: creditPointsData.practical || 0,
          project: creditPointsData.project || 0,
        },
        { transaction }
      );
    } else {
      return await this.createCreditPoints(
        courseId,
        creditPointsData,
        transaction
      );
    }
  }

  async updateCourseAttendance(courseId, sessionsData, transaction) {
    console.log(
      `Updating attendance for course ${courseId}`,
      JSON.stringify(sessionsData, null, 2)
    );
    const courseAttendance = await CourseAttendance.findOne({
      where: { courseId },
      transaction,
    });

    if (courseAttendance) {
      return await courseAttendance.update(
        { sessions: sessionsData },
        { transaction }
      );
    } else {
      return await this.createCourseAttendance(
        courseId,
        sessionsData,
        transaction
      );
    }
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
