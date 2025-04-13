// controllers/studentController.js
const { Student, User, Course, Teacher, sequelize } = require("../models");
const studentRepository = require("../repository/studentRepository");
const courseRepository = require("../repository/courseRepository");
const assignmentRepository = require("../repository/assignmentRepository");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { ErrorHandler } = require("../middleware/errorHandler");

// Enroll in a course
exports.enrollCourse = catchAsyncErrors(async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Find student profile
    const student = await studentRepository.findByUserId(userId);

    if (!student) {
      await transaction.rollback();
      return next(new ErrorHandler("Student profile not found", 404));
    }

    // Find the course
    const course = await courseRepository.findById(courseId);

    if (!course) {
      await transaction.rollback();
      return next(new ErrorHandler("Course not found", 404));
    }

    // Check if the student's teacher matches the course's teacher
    if (student.teacherId !== course.teacherId) {
      await transaction.rollback();
      return next(
        new ErrorHandler(
          "You can only enroll in courses taught by your assigned teacher",
          403
        )
      );
    }

    // Check if student is already enrolled
    const existingEnrollment = await sequelize.models.Enrollment.findOne({
      where: {
        studentId: student.id,
        courseId: course.id,
      },
      transaction,
    });

    if (existingEnrollment) {
      await transaction.rollback();
      return next(new ErrorHandler("Already enrolled in this course", 400));
    }

    // Create enrollment
    await sequelize.models.Enrollment.create(
      {
        studentId: student.id,
        courseId: course.id,
        enrollmentDate: new Date(),
        status: "active",
      },
      { transaction }
    );

    await transaction.commit();

    // Get course details for response
    const enrolledCourse = await courseRepository.findById(course.id, {
      include: [
        {
          model: Teacher,
          include: [{ model: User, attributes: ["name", "email"] }],
        },
        { model: sequelize.models.Semester },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Successfully enrolled in the course",
      course: {
        id: enrolledCourse.id,
        title: enrolledCourse.title,
        aboutCourse: enrolledCourse.aboutCourse,
        teacher: enrolledCourse.teacher
          ? {
              name: enrolledCourse.teacher.user
                ? enrolledCourse.teacher.user.name
                : null,
              email: enrolledCourse.teacher.user
                ? enrolledCourse.teacher.user.email
                : null,
            }
          : null,
        semester: enrolledCourse.Semester
          ? {
              name: enrolledCourse.Semester.name,
              startDate: enrolledCourse.Semester.startDate,
              endDate: enrolledCourse.Semester.endDate,
            }
          : null,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in enrollCourse:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Unenroll from a course
exports.unenrollCourse = catchAsyncErrors(async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Find student profile
    const student = await studentRepository.findByUserId(userId);

    if (!student) {
      await transaction.rollback();
      return next(new ErrorHandler("Student profile not found", 404));
    }

    // Check if student is enrolled in this course
    const enrollment = await sequelize.models.Enrollment.findOne({
      where: {
        studentId: student.id,
        courseId,
      },
      transaction,
    });

    if (!enrollment) {
      await transaction.rollback();
      return next(new ErrorHandler("Not enrolled in this course", 400));
    }

    // Delete enrollment
    await enrollment.destroy({ transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Successfully unenrolled from the course",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in unenrollCourse:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get student profile
exports.getProfile = catchAsyncErrors(async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Find student with relations
    const student = await studentRepository.findByUserId(userId);

    if (!student) {
      return next(new ErrorHandler("Student profile not found", 404));
    }

    // Get enrolled courses count
    const enrollmentCount = await sequelize.models.Enrollment.count({
      where: { studentId: student.id },
    });

    // Format the response
    const profile = {
      id: student.id,
      name: student.user.name,
      email: student.user.email,
      program: student.program,
      semester: student.semester,
      teacher: student.teacher
        ? {
            id: student.teacher.id,
            name: student.teacher.user ? student.teacher.user.name : null,
            email: student.teacher.email,
          }
        : null,
      coursesEnrolled: enrollmentCount,
    };

    return res.status(200).json({
      success: true,
      student: profile,
    });
  } catch (error) {
    console.error("Error in getProfile:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get student submissions
exports.getSubmissions = catchAsyncErrors(async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Find student
    const student = await studentRepository.findByUserId(userId);

    if (!student) {
      return next(new ErrorHandler("Student profile not found", 404));
    }

    // Get submissions for this student
    const submissions = await assignmentRepository.getSubmissionsByStudent(
      student.id
    );

    return res.status(200).json({
      success: true,
      count: submissions.length,
      submissions: submissions.map((submission) => ({
        id: submission.id,
        assignmentId: submission.assignmentId,
        assignmentTitle: submission.assignment
          ? submission.assignment.title
          : null,
        submissionDate: submission.submissionDate,
        submissionFile: submission.submissionFile,
        grade: submission.grade,
        feedback: submission.feedback,
        status: submission.status,
        isLate: submission.isLate,
      })),
    });
  } catch (error) {
    console.error("Error in getSubmissions:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Update student profile
exports.updateProfile = catchAsyncErrors(async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const { program, semester } = req.body;

    // Find student
    const student = await studentRepository.findByUserId(userId);

    if (!student) {
      await transaction.rollback();
      return next(new ErrorHandler("Student profile not found", 404));
    }

    // Update fields
    if (program) student.program = program;
    if (semester) student.semester = semester;

    await student.save({ transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      student: {
        id: student.id,
        program: student.program,
        semester: student.semester,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in updateProfile:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});
