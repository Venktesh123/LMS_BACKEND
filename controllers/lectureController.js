// controllers/lectureController.js
const { Lecture, Course, Teacher, Student, User } = require("../models");
const lectureRepository = require("../repository/lectureRepository");
const courseRepository = require("../repository/courseRepository");
const teacherRepository = require("../repository/teacherRepository");
const studentRepository = require("../repository/studentRepository");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { ErrorHandler } = require("../middleware/errorHandler");
const { sequelize } = require("../config/database");
const { uploadFileToS3, deleteFileFromS3 } = require("../utils/s3Helper");

// Better logging setup - replace with your preferred logging library
const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  error: (message, error) => console.error(`[ERROR] ${message}`, error),
};

// Create a new lecture
const createLecture = catchAsyncErrors(async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { courseId } = req.params;
    const { title, content, reviewDeadline } = req.body;
    const userId = req.user.id;

    logger.info(`Creating lecture for course: ${courseId}`);

    // Find the teacher
    const teacher = await teacherRepository.findByUserId(userId);

    if (!teacher) {
      await transaction.rollback();
      logger.error(`Teacher not found for user ID: ${userId}`);
      return next(new ErrorHandler("Teacher not found", 404));
    }

    // Find the course and check ownership
    const course = await courseRepository.findById(courseId);

    if (!course) {
      await transaction.rollback();
      logger.error(`Course not found with ID: ${courseId}`);
      return next(new ErrorHandler("Course not found", 404));
    }

    if (course.teacherId !== teacher.id) {
      await transaction.rollback();
      logger.error(`Teacher does not own course: ${courseId}`);
      return next(
        new ErrorHandler(
          "You don't have permission to add lectures to this course",
          403
        )
      );
    }

    // Check if video file was uploaded
    let videoUrl = null;
    let videoKey = null;

    if (req.files && req.files.video) {
      const videoFile = req.files.video;

      // Validate file type
      if (!videoFile.mimetype.startsWith("video/")) {
        await transaction.rollback();
        logger.error("Uploaded file is not a video");
        return next(new ErrorHandler("Uploaded file must be a video", 400));
      }

      // Upload to S3
      try {
        const uploadPath = `courses/${courseId}/lectures`;
        const uploadResult = await uploadFileToS3(videoFile, uploadPath);
        videoUrl = uploadResult.url;
        videoKey = uploadResult.key;
        logger.info(`Video uploaded to S3: ${videoKey}`);
      } catch (uploadError) {
        await transaction.rollback();
        logger.error("Error uploading video:", uploadError);
        return next(new ErrorHandler("Failed to upload video", 500));
      }
    }

    // Set default review deadline to 7 days from now if not provided
    const defaultDeadline = new Date();
    defaultDeadline.setDate(defaultDeadline.getDate() + 7);

    // Create the lecture
    const lecture = await Lecture.create(
      {
        title,
        content: content || title,
        videoUrl,
        videoKey,
        courseId,
        isReviewed: false,
        reviewDeadline: reviewDeadline || defaultDeadline,
      },
      { transaction }
    );

    logger.info(`Created lecture with ID: ${lecture.id}`);

    await transaction.commit();
    logger.info("Transaction committed successfully");

    return res.status(201).json({
      success: true,
      lecture: {
        id: lecture.id,
        title: lecture.title,
        content: lecture.content,
        videoUrl: lecture.videoUrl,
        isReviewed: lecture.isReviewed,
        reviewDeadline: lecture.reviewDeadline,
        createdAt: lecture.createdAt,
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Error in createLecture:", error);
    return next(new ErrorHandler(error.message, 400));
  }
});

// Get lecture by ID
const getLectureById = catchAsyncErrors(async (req, res, next) => {
  try {
    logger.info(`Fetching lecture ID: ${req.params.lectureId}`);
    const { courseId, lectureId } = req.params;
    const userId = req.user.id;

    // Find the lecture
    const lecture = await lectureRepository.findById(lectureId);

    if (!lecture || lecture.courseId.toString() !== courseId) {
      logger.error(
        `Lecture not found or does not belong to course ${courseId}`
      );
      return next(new ErrorHandler("Lecture not found", 404));
    }

    // Find the course
    const course = await courseRepository.findById(courseId);

    if (!course) {
      logger.error(`Course not found with ID: ${courseId}`);
      return next(new ErrorHandler("Course not found", 404));
    }

    // Check user access
    let hasAccess = false;

    if (req.user.role === "teacher") {
      // For teacher: check if they're the course teacher
      const teacher = await teacherRepository.findByUserId(userId);
      if (teacher && teacher.id === course.teacherId) {
        hasAccess = true;
      }
    } else if (req.user.role === "student") {
      // For student: check if they're enrolled in the course
      const student = await studentRepository.findByUserId(userId);

      if (student) {
        const enrollment = await sequelize.models.Enrollment.findOne({
          where: {
            studentId: student.id,
            courseId: course.id,
          },
        });

        if (enrollment) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      logger.error(
        `User ${userId} does not have access to lecture ${lectureId}`
      );
      return next(
        new ErrorHandler("You don't have access to this lecture", 403)
      );
    }

    // Auto-update review status if deadline has passed
    const now = new Date();
    if (
      !lecture.isReviewed &&
      lecture.reviewDeadline &&
      now >= lecture.reviewDeadline
    ) {
      lecture.isReviewed = true;
      await lecture.save();
      logger.info(`Auto-updated review status for lecture: ${lectureId}`);
    }

    logger.info(`Found lecture: ${lecture.title}`);

    res.json({
      id: lecture.id,
      title: lecture.title,
      content: lecture.content,
      videoUrl: lecture.videoUrl,
      isReviewed: lecture.isReviewed,
      reviewDeadline: lecture.reviewDeadline,
      createdAt: lecture.createdAt,
      updatedAt: lecture.updatedAt,
    });
  } catch (error) {
    logger.error("Error in getLectureById:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Update a lecture
const updateLecture = catchAsyncErrors(async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    logger.info(`Updating lecture ID: ${req.params.lectureId}`);
    const { courseId, lectureId } = req.params;
    const { title, content, isReviewed, reviewDeadline } = req.body;
    const userId = req.user.id;

    // Find the teacher
    const teacher = await teacherRepository.findByUserId(userId);

    if (!teacher) {
      await transaction.rollback();
      logger.error(`Teacher not found for user ID: ${userId}`);
      return next(new ErrorHandler("Teacher not found", 404));
    }

    // Find the course and check ownership
    const course = await courseRepository.findById(courseId);

    if (!course) {
      await transaction.rollback();
      logger.error(`Course not found with ID: ${courseId}`);
      return next(new ErrorHandler("Course not found", 404));
    }

    if (course.teacherId !== teacher.id) {
      await transaction.rollback();
      logger.error(`Teacher does not own course: ${courseId}`);
      return next(
        new ErrorHandler(
          "You don't have permission to update lectures in this course",
          403
        )
      );
    }

    // Find the lecture
    const lecture = await lectureRepository.findById(lectureId);

    if (!lecture || lecture.courseId.toString() !== courseId) {
      await transaction.rollback();
      logger.error(
        `Lecture not found or does not belong to course ${courseId}`
      );
      return next(new ErrorHandler("Lecture not found", 404));
    }

    // Check if video file was uploaded
    let videoUrl = lecture.videoUrl;
    let videoKey = lecture.videoKey;

    if (req.files && req.files.video) {
      const videoFile = req.files.video;

      // Validate file type
      if (!videoFile.mimetype.startsWith("video/")) {
        await transaction.rollback();
        logger.error("Uploaded file is not a video");
        return next(new ErrorHandler("Uploaded file must be a video", 400));
      }

      // Delete old video if exists
      if (lecture.videoKey) {
        try {
          await deleteFileFromS3(lecture.videoKey);
          logger.info(`Deleted old video from S3: ${lecture.videoKey}`);
        } catch (deleteError) {
          logger.error(
            `Error deleting old video: ${lecture.videoKey}`,
            deleteError
          );
          // Continue with upload even if delete fails
        }
      }

      // Upload new video to S3
      try {
        const uploadPath = `courses/${courseId}/lectures`;
        const uploadResult = await uploadFileToS3(videoFile, uploadPath);
        videoUrl = uploadResult.url;
        videoKey = uploadResult.key;
        logger.info(`New video uploaded to S3: ${videoKey}`);
      } catch (uploadError) {
        await transaction.rollback();
        logger.error("Error uploading video:", uploadError);
        return next(new ErrorHandler("Failed to upload video", 500));
      }
    }

    // Update lecture fields
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (isReviewed !== undefined) updateData.isReviewed = isReviewed;
    if (reviewDeadline !== undefined)
      updateData.reviewDeadline = reviewDeadline;
    if (videoUrl !== lecture.videoUrl) {
      updateData.videoUrl = videoUrl;
      updateData.videoKey = videoKey;
    }

    // Update the lecture
    await lectureRepository.update(lecture.id, updateData, { transaction });
    logger.info(`Updated lecture: ${lectureId}`);

    await transaction.commit();
    logger.info("Transaction committed successfully");

    // Return the updated lecture
    const updatedLecture = await lectureRepository.findById(lecture.id);

    return res.json({
      success: true,
      lecture: {
        id: updatedLecture.id,
        title: updatedLecture.title,
        content: updatedLecture.content,
        videoUrl: updatedLecture.videoUrl,
        isReviewed: updatedLecture.isReviewed,
        reviewDeadline: updatedLecture.reviewDeadline,
        createdAt: updatedLecture.createdAt,
        updatedAt: updatedLecture.updatedAt,
      },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Error in updateLecture:", error);
    return next(new ErrorHandler(error.message, 400));
  }
});

// Delete a lecture
const deleteLecture = catchAsyncErrors(async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    logger.info(`Deleting lecture ID: ${req.params.lectureId}`);
    const { courseId, lectureId } = req.params;
    const userId = req.user.id;

    // Find the teacher
    const teacher = await teacherRepository.findByUserId(userId);

    if (!teacher) {
      await transaction.rollback();
      logger.error(`Teacher not found for user ID: ${userId}`);
      return next(new ErrorHandler("Teacher not found", 404));
    }

    // Find the course and check ownership
    const course = await courseRepository.findById(courseId);

    if (!course) {
      await transaction.rollback();
      logger.error(`Course not found with ID: ${courseId}`);
      return next(new ErrorHandler("Course not found", 404));
    }

    if (course.teacherId !== teacher.id) {
      await transaction.rollback();
      logger.error(`Teacher does not own course: ${courseId}`);
      return next(
        new ErrorHandler(
          "You don't have permission to delete lectures in this course",
          403
        )
      );
    }

    // Find the lecture
    const lecture = await lectureRepository.findById(lectureId);

    if (!lecture || lecture.courseId.toString() !== courseId) {
      await transaction.rollback();
      logger.error(
        `Lecture not found or does not belong to course ${courseId}`
      );
      return next(new ErrorHandler("Lecture not found", 404));
    }

    // Delete video from S3 if exists
    if (lecture.videoKey) {
      try {
        await deleteFileFromS3(lecture.videoKey);
        logger.info(`Deleted video from S3: ${lecture.videoKey}`);
      } catch (deleteError) {
        logger.error(`Error deleting video: ${lecture.videoKey}`, deleteError);
        // Continue with deletion even if S3 delete fails
      }
    }

    // Delete the lecture
    await lectureRepository.delete(lecture.id, { transaction });
    logger.info(`Deleted lecture: ${lectureId}`);

    await transaction.commit();
    logger.info("Transaction committed successfully");

    return res.json({
      success: true,
      message: "Lecture deleted successfully",
    });
  } catch (error) {
    await transaction.rollback();
    logger.error("Error in deleteLecture:", error);
    return next(new ErrorHandler(error.message, 400));
  }
});

// Get all lectures for a course
const getCourseLectures = catchAsyncErrors(async (req, res, next) => {
  try {
    logger.info(`Fetching lectures for course ID: ${req.params.courseId}`);
    const { courseId } = req.params;
    const userId = req.user.id;

    // Find the course
    const course = await courseRepository.findById(courseId);

    if (!course) {
      logger.error(`Course not found with ID: ${courseId}`);
      return next(new ErrorHandler("Course not found", 404));
    }

    // Check user access
    let hasAccess = false;

    if (req.user.role === "teacher") {
      // For teacher: check if they're the course teacher
      const teacher = await teacherRepository.findByUserId(userId);
      if (teacher && teacher.id === course.teacherId) {
        hasAccess = true;
      }
    } else if (req.user.role === "student") {
      // For student: check if they're enrolled in the course
      const student = await studentRepository.findByUserId(userId);

      if (student) {
        const enrollment = await sequelize.models.Enrollment.findOne({
          where: {
            studentId: student.id,
            courseId: course.id,
          },
        });

        if (enrollment) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      logger.error(`User ${userId} does not have access to course ${courseId}`);
      return next(
        new ErrorHandler("You don't have access to this course", 403)
      );
    }

    // Get lectures for this course
    const lectures = await lectureRepository.findByCourseId(courseId);

    logger.info(`Found ${lectures.length} lectures for course: ${courseId}`);

    // Auto-update any lectures that have passed their review deadline
    const now = new Date();
    const updatePromises = lectures
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

    // Format lectures for response
    const formattedLectures = lectures.map((lecture) => ({
      id: lecture.id,
      title: lecture.title,
      content: lecture.content,
      videoUrl: lecture.videoUrl,
      isReviewed: lecture.isReviewed,
      reviewDeadline: lecture.reviewDeadline,
      createdAt: lecture.createdAt,
      updatedAt: lecture.updatedAt,
    }));

    res.json(formattedLectures);
  } catch (error) {
    logger.error("Error in getCourseLectures:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Toggle review status of a lecture
const toggleLectureReview = catchAsyncErrors(async (req, res, next) => {
  try {
    logger.info(
      `Toggling review status for lecture ID: ${req.params.lectureId}`
    );
    const { courseId, lectureId } = req.params;
    const userId = req.user.id;

    // Find the teacher
    const teacher = await teacherRepository.findByUserId(userId);

    if (!teacher) {
      logger.error(`Teacher not found for user ID: ${userId}`);
      return next(new ErrorHandler("Teacher not found", 404));
    }

    // Find the course and check ownership
    const course = await courseRepository.findById(courseId);

    if (!course) {
      logger.error(`Course not found with ID: ${courseId}`);
      return next(new ErrorHandler("Course not found", 404));
    }

    if (course.teacherId !== teacher.id) {
      logger.error(`Teacher does not own course: ${courseId}`);
      return next(
        new ErrorHandler(
          "You don't have permission to update lectures in this course",
          403
        )
      );
    }

    // Find the lecture
    const lecture = await lectureRepository.findById(lectureId);

    if (!lecture || lecture.courseId.toString() !== courseId) {
      logger.error(
        `Lecture not found or does not belong to course ${courseId}`
      );
      return next(new ErrorHandler("Lecture not found", 404));
    }

    // Toggle review status
    lecture.isReviewed = !lecture.isReviewed;
    await lecture.save();

    logger.info(
      `Toggled review status for lecture ${lectureId} to: ${lecture.isReviewed}`
    );

    return res.json({
      success: true,
      lecture: {
        id: lecture.id,
        title: lecture.title,
        isReviewed: lecture.isReviewed,
      },
    });
  } catch (error) {
    logger.error("Error in toggleLectureReview:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

module.exports = {
  createLecture,
  getLectureById,
  updateLecture,
  deleteLecture,
  getCourseLectures,
  toggleLectureReview,
};
