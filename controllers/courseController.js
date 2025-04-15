// controllers/courseController.js
const courseRepository = require("../repository/courseRepository");
const teacherRepository = require("../repository/teacherRepository");
const studentRepository = require("../repository/studentRepository");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { ErrorHandler } = require("../middleware/errorHandler");
const { sequelize } = require("../config/database");
const { uploadFileToS3, deleteFileFromS3 } = require("../utils/s3Helper");
const db = require("../models");

// Better logging setup - replace with your preferred logging library
const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  error: (message, error) => console.error(`[ERROR] ${message}`, error),
};

// Ensure all models are properly referenced
const User = db.User;
const Course = db.Course;
const Teacher = db.Teacher;
const Student = db.Student;
const Semester = db.Semester;
const Lecture = db.Lecture;
const Assignment = db.Assignment;
const Enrollment = db.Enrollment;

// Helper function to format course data
const formatCourseData = (course) => {
  if (!course) return null;

  // Extract course components data
  const creditPoints = course.creditPoints
    ? {
        lecture: course.creditPoints.lecture,
        tutorial: course.creditPoints.tutorial,
        practical: course.creditPoints.practical,
        project: course.creditPoints.project,
      }
    : {
        lecture: 0,
        tutorial: 0,
        practical: 0,
        project: 0,
      };

  // Format lectures
  let lectures = [];
  if (course.lectures && course.lectures.length > 0) {
    lectures = course.lectures.map((lecture) => ({
      id: lecture.id,
      title: lecture.title,
      content: lecture.content,
      videoUrl: lecture.videoUrl,
      isReviewed: lecture.isReviewed,
      reviewDeadline: lecture.reviewDeadline,
      createdAt: lecture.createdAt,
      updatedAt: lecture.updatedAt,
    }));
  }

  // Format assignments
  let assignments = [];
  if (course.assignments && course.assignments.length > 0) {
    assignments = course.assignments.map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      dueDate: assignment.dueDate,
      totalPoints: assignment.totalPoints,
      isActive: assignment.isActive,
      attachments: assignment.attachments,
      createdAt: assignment.createdAt,
    }));
  }

  return {
    id: course.id,
    title: course.title,
    aboutCourse: course.aboutCourse,
    semester: course.semester
      ? {
          id: course.semester.id,
          name: course.semester.name,
          startDate: course.semester.startDate,
          endDate: course.semester.endDate,
        }
      : null,
    teacher: course.teacher,
    creditPoints: creditPoints,
    learningOutcomes: course.outcomes ? course.outcomes.outcomes : [],
    weeklyPlan: course.weeklyPlan
      ? course.weeklyPlan.weeks.map((week) => ({
          weekNumber: week.weekNumber,
          topics: week.topics,
        }))
      : [],
    syllabus: course.syllabus
      ? course.syllabus.modules.map((module) => ({
          moduleNumber: module.moduleNumber,
          moduleTitle: module.moduleTitle,
          topics: module.topics,
        }))
      : [],
    courseSchedule: course.schedule
      ? {
          classStartDate: course.schedule.classStartDate,
          classEndDate: course.schedule.classEndDate,
          midSemesterExamDate: course.schedule.midSemesterExamDate,
          endSemesterExamDate: course.schedule.endSemesterExamDate,
          classDaysAndTimes: course.schedule.classDaysAndTimes,
        }
      : null,
    lectures: lectures,
    assignments: assignments,
    attendance: course.attendance ? course.attendance.sessions : {},
  };
};

// Get courses for currently authenticated user
const getUserCourses = catchAsyncErrors(async (req, res, next) => {
  try {
    logger.info(`Fetching courses for user with ID: ${req.user.id}`);
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole === "teacher") {
      // Get courses where user is a teacher
      const teacher = await teacherRepository.findByUserId(userId);

      if (!teacher) {
        logger.error(`Teacher profile not found for user ID: ${userId}`);
        return next(new ErrorHandler("Teacher profile not found", 404));
      }

      // Count students under this teacher
      const students = await studentRepository.findByTeacherId(teacher.id);
      const studentCount = students ? students.length : 0;

      // Get all courses taught by this teacher
      const courses = await courseRepository.findByTeacherId(teacher.id);

      logger.info(`Found ${courses.length} courses for teacher: ${teacher.id}`);

      return res.json({
        user: {
          id: teacher.id,
          name: teacher.user.name,
          email: teacher.user.email,
          role: "teacher",
          totalStudents: studentCount,
          totalCourses: courses.length || 0,
        },
        courses: courses.map((course) => ({
          id: course.id,
          title: course.title,
          aboutCourse: course.aboutCourse,
          semester: course.semester
            ? {
                id: course.semester.id,
                name: course.semester.name,
                startDate: course.semester.startDate,
                endDate: course.semester.endDate,
              }
            : null,
        })),
      });
    } else if (userRole === "student") {
      // Get courses where user is enrolled as a student
      const student = await studentRepository.findByUserId(userId);

      if (!student) {
        logger.error(`Student profile not found for user ID: ${userId}`);
        return next(new ErrorHandler("Student profile not found", 404));
      }

      // Get all courses for this student
      const courses = await courseRepository.findByStudentId(student.id);

      logger.info(`Found ${courses.length} courses for student: ${student.id}`);

      return res.json({
        user: {
          id: student.id,
          name: student.user.name,
          email: student.user.email,
          role: "student",
          totalCourses: courses.length || 0,
        },
        courses: courses.map((course) => ({
          id: course.id,
          title: course.title,
          aboutCourse: course.aboutCourse,
          semester: course.semester
            ? {
                id: course.semester.id,
                name: course.semester.name,
                startDate: course.semester.startDate,
                endDate: course.semester.endDate,
              }
            : null,
        })),
      });
    } else {
      logger.error(`Invalid user role: ${userRole}`);
      return next(new ErrorHandler("Invalid user role", 403));
    }
  } catch (error) {
    logger.error("Error in getUserCourses:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get enrolled courses for a student
const getEnrolledCourses = catchAsyncErrors(async (req, res, next) => {
  try {
    logger.info(
      `Fetching enrolled courses for student with ID: ${req.user.id}`
    );
    const userId = req.user.id;

    // Ensure user is a student
    if (req.user.role !== "student") {
      logger.error(`User ${userId} is not a student`);
      return next(
        new ErrorHandler("Access denied. Student role required", 403)
      );
    }

    // Find student profile
    const student = await studentRepository.findByUserId(userId);

    if (!student) {
      logger.error(`Student not found for user ID: ${userId}`);
      return next(new ErrorHandler("Student not found", 404));
    }

    // Get all enrollments for this student
    const courses = await courseRepository.findByStudentId(student.id);

    logger.info(
      `Found ${courses.length} enrolled courses for student: ${student.id}`
    );

    if (courses.length === 0) {
      return res.json({
        user: {
          id: student.id,
          name: student.user.name,
          email: student.user.email,
          role: "student",
          totalCourses: 0,
        },
        courses: [],
      });
    }

    return res.json({
      user: {
        id: student.id,
        name: student.user.name,
        email: student.user.email,
        role: "student",
        totalCourses: courses.length,
      },
      courses: courses.map((course) => ({
        id: course.id,
        title: course.title,
        aboutCourse: course.aboutCourse,
        semester: course.semester
          ? {
              id: course.semester.id,
              name: course.semester.name,
              startDate: course.semester.startDate,
              endDate: course.semester.endDate,
            }
          : null,
      })),
    });
  } catch (error) {
    logger.error("Error in getEnrolledCourses:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get specific course by ID
const getCourseById = catchAsyncErrors(async (req, res, next) => {
  try {
    logger.info(
      `Fetching course ID: ${req.params.courseId} for user: ${req.user.id}`
    );
    const { courseId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Find the course with its relationships
    const course = await courseRepository.findById(courseId, {
      include: [
        { model: Semester, as: "semester" },
        {
          model: Teacher,
          as: "teacher",
          include: [{ model: User, attributes: ["name", "email"], as: "user" }],
        },
        { model: Lecture, as: "lectures" },
        { model: Assignment, as: "assignments" },
      ],
    });

    if (!course) {
      logger.error(`Course not found with ID: ${courseId}`);
      return next(new ErrorHandler("Course not found", 404));
    }

    // Check if user has access to this course
    let hasAccess = false;
    let userDetails = null;
    let students = [];

    if (userRole === "teacher") {
      // For teacher: check if they're the course teacher
      const teacher = await teacherRepository.findByUserId(userId);
      if (teacher && teacher.id === course.teacherId) {
        hasAccess = true;
        userDetails = {
          id: teacher.id,
          name: teacher.user.name,
          email: teacher.user.email,
        };

        // Get students enrolled in this course
        students = await courseRepository.getEnrolledStudents(course.id);
        students = students.map((student, index) => ({
          id: student.id,
          rollNo: `CS${String(index + 101).padStart(3, "0")}`,
          name: student.user.name || "Unknown",
          program: student.program || "Computer Science",
          email: student.user.email || "",
        }));
      }
    } else if (userRole === "student") {
      // For student: check if they're enrolled in the course
      const student = await studentRepository.findByUserId(userId);

      if (student) {
        // Check if student is enrolled in this course
        const enrollments = await Enrollment.findOne({
          where: {
            studentId: student.id,
            courseId: course.id,
          },
        });

        if (enrollments) {
          hasAccess = true;
          userDetails = {
            id: student.id,
            name: student.user.name,
            email: student.user.email,
          };

          // Get teacher info for this course
          const courseTeacher = await teacherRepository.findById(
            course.teacherId
          );

          if (courseTeacher) {
            userDetails.teacher = {
              id: courseTeacher.id,
              name: courseTeacher.user.name,
              email: courseTeacher.user.email,
            };
          }
        }
      }
    }

    if (!hasAccess) {
      logger.error(`User ${userId} does not have access to course ${courseId}`);
      return next(
        new ErrorHandler("You don't have access to this course", 403)
      );
    }

    // Auto-update any lectures that have passed their review deadline
    const now = new Date();
    if (course.lectures && course.lectures.length > 0) {
      const updatePromises = course.lectures
        .filter(
          (lecture) =>
            !lecture.isReviewed &&
            lecture.reviewDeadline &&
            now >= lecture.reviewDeadline
        )
        .map(async (lecture) => {
          lecture.isReviewed = true;
          return await lecture.save();
        });

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        logger.info(
          `Auto-updated review status for ${updatePromises.length} lectures`
        );
      }
    }

    logger.info(`Found course: ${course.title}`);

    // Format the course data for response
    const formattedCourse = formatCourseData(course);

    // Add user-specific data
    if (userRole === "teacher") {
      formattedCourse.teacher = userDetails;
      formattedCourse.students = students;
    } else if (userRole === "student") {
      formattedCourse.student = userDetails;
    }

    res.json(formattedCourse);
  } catch (error) {
    logger.error("Error in getCourseById:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Create a new course
const createCourse = catchAsyncErrors(async (req, res, next) => {
  let transaction = null;

  try {
    logger.info("Starting createCourse controller function");

    transaction = await sequelize.transaction();

    const { title, aboutCourse, semesterId } = req.body;
    const userId = req.user.id;

    // Find the teacher
    const teacher = await teacherRepository.findByUserId(userId);

    if (!teacher) {
      logger.error(`Teacher not found for user ID: ${userId}`);
      throw new ErrorHandler("Teacher profile not found", 404);
    }

    // Find the semester
    const semester = await Semester.findByPk(semesterId, { transaction });
    if (!semester) {
      logger.error(`Semester not found with ID: ${semesterId}`);
      throw new ErrorHandler("Semester not found", 404);
    }

    // Create the course
    const course = await courseRepository.create(
      {
        title,
        aboutCourse,
        semesterId,
        teacherId: teacher.id,
      },
      transaction
    );

    logger.info(`Main course created with ID: ${course.id}`);

    // If learning outcomes are provided, create them
    if (req.body.learningOutcomes && req.body.learningOutcomes.length > 0) {
      logger.info("Creating learning outcomes");
      await courseRepository.createCourseOutcome(
        course.id,
        req.body.learningOutcomes,
        transaction
      );
    }

    // If course schedule is provided, create it
    if (req.body.courseSchedule) {
      logger.info("Creating course schedule");
      await courseRepository.createCourseSchedule(
        course.id,
        req.body.courseSchedule,
        transaction
      );
    }

    // If syllabus is provided, create it
    if (req.body.syllabus && req.body.syllabus.length > 0) {
      logger.info("Creating course syllabus");
      await courseRepository.createCourseSyllabus(
        course.id,
        req.body.syllabus,
        transaction
      );
    }

    // If weekly plan is provided, create it
    if (req.body.weeklyPlan && req.body.weeklyPlan.length > 0) {
      logger.info("Creating weekly plan");
      await courseRepository.createWeeklyPlan(
        course.id,
        req.body.weeklyPlan,
        transaction
      );
    }

    // If credit points are provided, create them
    if (req.body.creditPoints) {
      logger.info("Creating credit points");
      await courseRepository.createCreditPoints(
        course.id,
        req.body.creditPoints,
        transaction
      );
    }

    // If attendance is provided, create it
    if (req.body.attendance && req.body.attendance.sessions) {
      logger.info("Creating course attendance");
      await courseRepository.createCourseAttendance(
        course.id,
        req.body.attendance.sessions,
        transaction
      );
    }

    // If lectures are provided in the request, create them
    if (req.body.lectures && Array.isArray(req.body.lectures)) {
      logger.info("Creating lectures for the course");
      const lecturePromises = req.body.lectures.map((lectureData) => {
        return Lecture.create(
          {
            title: lectureData.title,
            content: lectureData.content || lectureData.title,
            videoUrl: lectureData.videoUrl || null,
            courseId: course.id,
            isReviewed: lectureData.isReviewed || false,
            reviewDeadline:
              lectureData.reviewDeadline ||
              new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
          { transaction }
        );
      });

      await Promise.all(lecturePromises);
      logger.info(`Created lectures for the course`);
    }

    // Get students assigned to this teacher and enroll them in the course
    const students = await studentRepository.findByTeacherId(teacher.id);

    if (students.length > 0) {
      logger.info("Enrolling students in the new course");

      // Enrollment records to create
      const enrollmentData = students.map((student) => ({
        studentId: student.id,
        courseId: course.id,
        enrollmentDate: new Date(),
        status: "active",
      }));

      // Bulk create enrollments
      await Enrollment.bulkCreate(enrollmentData, { transaction });
      logger.info(`Enrolled ${students.length} students in the course`);
    }

    await transaction.commit();
    transaction = null;
    logger.info("Transaction committed successfully");

    // Return the created course with its relationships
    const createdCourse = await courseRepository.findById(course.id, {
      include: [
        { model: Semester, as: "semester" },
        { model: Lecture, as: "lectures" },
        {
          model: Teacher,
          as: "teacher",
          include: [{ model: User, attributes: ["name", "email"], as: "user" }],
        },
      ],
    });

    return res.status(201).json({
      success: true,
      course: formatCourseData(createdCourse),
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    logger.error("Error in createCourse:", error);
    return next(
      error.statusCode ? error : new ErrorHandler(error.message, 400)
    );
  }
});

// Update a course
const updateCourse = catchAsyncErrors(async (req, res, next) => {
  let transaction = null;

  try {
    logger.info(`Updating course ID: ${req.params.courseId}`);

    transaction = await sequelize.transaction();

    const { courseId } = req.params;
    const { title, aboutCourse, semesterId } = req.body;
    const userId = req.user.id;

    // Find the teacher
    const teacher = await teacherRepository.findByUserId(userId);

    if (!teacher) {
      logger.error(`Teacher not found for user ID: ${userId}`);
      throw new ErrorHandler("Teacher profile not found", 404);
    }

    // Find the course and check ownership
    const course = await courseRepository.findById(courseId);

    if (!course || course.teacherId !== teacher.id) {
      logger.error(
        `Course not found or unauthorized for course ID: ${courseId}`
      );
      throw new ErrorHandler("Course not found or unauthorized", 404);
    }

    // Update course fields
    const updateData = {};
    if (title) updateData.title = title;
    if (aboutCourse) updateData.aboutCourse = aboutCourse;

    // Update semester if provided and exists
    if (semesterId) {
      const semester = await Semester.findByPk(semesterId, { transaction });
      if (!semester) {
        throw new ErrorHandler("Semester not found", 404);
      }
      updateData.semesterId = semesterId;
    }

    // Update the course basic info
    await courseRepository.update(course.id, updateData);
    logger.info("Updated main course fields");

    // Update learning outcomes if provided
    if (req.body.learningOutcomes) {
      logger.info("Updating learning outcomes");
      // This would need a method in your repository to update outcomes
      // await courseRepository.updateCourseOutcome(course.id, req.body.learningOutcomes, transaction);
    }

    // Update course schedule if provided
    if (req.body.courseSchedule) {
      logger.info("Updating course schedule");
      // This would need a method in your repository to update schedule
      // await courseRepository.updateCourseSchedule(course.id, req.body.courseSchedule, transaction);
    }

    // Update syllabus if provided
    if (req.body.syllabus) {
      logger.info("Updating syllabus");
      // This would need a method in your repository to update syllabus
      // await courseRepository.updateCourseSyllabus(course.id, req.body.syllabus, transaction);
    }

    // Update weekly plan if provided
    if (req.body.weeklyPlan) {
      logger.info("Updating weekly plan");
      // This would need a method in your repository to update weekly plan
      // await courseRepository.updateWeeklyPlan(course.id, req.body.weeklyPlan, transaction);
    }

    // Update credit points if provided
    if (req.body.creditPoints) {
      logger.info("Updating credit points");
      // This would need a method in your repository to update credit points
      // await courseRepository.updateCreditPoints(course.id, req.body.creditPoints, transaction);
    }

    // Update attendance if provided
    if (req.body.attendance && req.body.attendance.sessions) {
      logger.info("Updating attendance");
      // This would need a method in your repository to update attendance
      // await courseRepository.updateCourseAttendance(course.id, req.body.attendance.sessions, transaction);
    }

    await transaction.commit();
    transaction = null;
    logger.info("Transaction committed successfully");

    // Return the updated course with its relationships
    const updatedCourse = await courseRepository.findById(course.id, {
      include: [
        { model: Semester, as: "semester" },
        { model: Lecture, as: "lectures" },
        {
          model: Teacher,
          as: "teacher",
          include: [{ model: User, attributes: ["name", "email"], as: "user" }],
        },
      ],
    });

    return res.json({
      success: true,
      course: formatCourseData(updatedCourse),
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    logger.error("Error in updateCourse:", error);
    return next(
      error.statusCode ? error : new ErrorHandler(error.message, 400)
    );
  }
});

// Delete a course
const deleteCourse = catchAsyncErrors(async (req, res, next) => {
  let transaction = null;

  try {
    logger.info(`Deleting course ID: ${req.params.courseId}`);

    transaction = await sequelize.transaction();

    const { courseId } = req.params;
    const userId = req.user.id;

    // Find the teacher
    const teacher = await teacherRepository.findByUserId(userId);

    if (!teacher) {
      logger.error(`Teacher not found for user ID: ${userId}`);
      throw new ErrorHandler("Teacher profile not found", 404);
    }

    // Find the course and check ownership
    const course = await courseRepository.findById(courseId);

    if (!course || course.teacherId !== teacher.id) {
      logger.error(
        `Course not found or unauthorized for course ID: ${courseId}`
      );
      throw new ErrorHandler("Course not found or unauthorized", 404);
    }

    // Delete all enrollments
    await Enrollment.destroy({
      where: { courseId },
      transaction,
    });
    logger.info("Deleted all course enrollments");

    // Delete all lectures
    const lectures = await Lecture.findAll({
      where: { courseId },
      transaction,
    });

    // Delete video files from S3 for lectures with videoKeys
    for (const lecture of lectures) {
      if (lecture.videoKey) {
        try {
          await deleteFileFromS3(lecture.videoKey);
          logger.info(`Deleted video from S3: ${lecture.videoKey}`);
        } catch (error) {
          logger.error(`Error deleting video: ${lecture.videoKey}`, error);
          // Continue with course deletion even if S3 delete fails
        }
      }
    }

    await Lecture.destroy({
      where: { courseId },
      transaction,
    });
    logger.info("Deleted all course lectures");

    // Delete all assignments and their submissions
    const assignments = await Assignment.findAll({
      where: { courseId },
      transaction,
    });

    for (const assignment of assignments) {
      // Delete submission files from S3
      const submissions = await sequelize.models.Submission.findAll({
        where: { assignmentId: assignment.id },
        transaction,
      });

      for (const submission of submissions) {
        if (
          submission.submissionFile &&
          submission.submissionFile.includes("amazonaws.com")
        ) {
          try {
            // Extract key from URL
            const key = submission.submissionFile.split("/").slice(3).join("/");
            await deleteFileFromS3(key);
            logger.info(`Deleted submission file from S3: ${key}`);
          } catch (error) {
            logger.error(
              `Error deleting submission file: ${submission.submissionFile}`,
              error
            );
            // Continue with deletion even if S3 delete fails
          }
        }
      }

      // Delete submissions
      await sequelize.models.Submission.destroy({
        where: { assignmentId: assignment.id },
        transaction,
      });

      // Delete assignment attachments from S3
      if (assignment.attachments && assignment.attachments.length > 0) {
        for (const attachment of assignment.attachments) {
          if (attachment.url && attachment.url.includes("amazonaws.com")) {
            try {
              await deleteFileFromS3(attachment.key);
              logger.info(
                `Deleted assignment attachment from S3: ${attachment.key}`
              );
            } catch (error) {
              logger.error(
                `Error deleting attachment: ${attachment.key}`,
                error
              );
              // Continue with deletion even if S3 delete fails
            }
          }
        }
      }
    }

    // Delete all assignments
    await Assignment.destroy({
      where: { courseId },
      transaction,
    });
    logger.info("Deleted all course assignments and submissions");

    // Delete the course
    await courseRepository.delete(course.id);
    logger.info(`Deleted course: ${courseId}`);

    await transaction.commit();
    transaction = null;
    logger.info("Transaction committed successfully");

    return res.json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    logger.error("Error in deleteCourse:", error);
    return next(
      error.statusCode ? error : new ErrorHandler(error.message, 400)
    );
  }
});

module.exports = {
  getUserCourses,
  getEnrolledCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
};
