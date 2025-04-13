const { Lecture, Course } = require("../models");
const { Op } = require("sequelize");

class LectureRepository {
  async create(lectureData) {
    return await Lecture.create(lectureData);
  }

  async findById(id) {
    return await Lecture.findByPk(id, {
      include: [{ model: Course, as: "course" }],
    });
  }

  async findByCourseId(courseId) {
    return await Lecture.findAll({
      where: { courseId },
      order: [["createdAt", "ASC"]],
    });
  }

  async update(id, lectureData) {
    const lecture = await Lecture.findByPk(id);

    if (!lecture) {
      return null;
    }

    return await lecture.update(lectureData);
  }

  async delete(id) {
    const lecture = await Lecture.findByPk(id);

    if (!lecture) {
      return false;
    }

    await lecture.destroy();
    return true;
  }

  async updateReviewStatus(id, isReviewed) {
    const lecture = await Lecture.findByPk(id);

    if (!lecture) {
      return null;
    }

    return await lecture.update({ isReviewed });
  }

  async updateExpiredReviewStatuses(courseId) {
    const now = new Date();

    const result = await Lecture.update(
      { isReviewed: true },
      {
        where: {
          courseId,
          isReviewed: false,
          reviewDeadline: { [Op.lte]: now },
        },
      }
    );

    return result[0]; // Number of updated rows
  }
}

module.exports = new LectureRepository();
